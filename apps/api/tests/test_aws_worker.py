"""Offline tests: in-memory DB, fake S3/SQS; never contact school/AWS."""
import asyncio
import hashlib
import io
import os
import subprocess
import sys
import unittest
import tempfile
import threading
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from dataclasses import replace
from datetime import timedelta
from unittest.mock import Mock, patch

os.environ.update(APP_ROLE="api", DATABASE_URL="sqlite://", AWS_EC2_METADATA_DISABLED="true")

from fastapi import HTTPException, Request
from botocore.exceptions import ClientError, NoCredentialsError, ProfileNotFound
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import character_jobs as jobs, main, inference_client, ai_worker
from app.config import settings
from app.database import Base
from app.models import AppUser, CharacterJob, MediaAsset, Plant
from app.schemas import PlantCreate


def png(color="green", size=1024):
    data = io.BytesIO()
    Image.new("RGBA", (size, size), color).save(data, format="PNG")
    return data.getvalue()


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.fail = False
        self.sign_count = 0

    def put_object(self, *, Bucket, Key, Body, **kwargs):
        if self.fail:
            raise OSError("Do not expose credentials")
        self.objects[(Bucket, Key)] = bytes(Body)

    def get_object(self, *, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}

    def generate_presigned_url(self, method, *, Params, ExpiresIn):
        self.sign_count += 1
        return f'https://{Params["Bucket"]}.s3.ap-northeast-2.amazonaws.com/{Params["Key"]}?signature={self.sign_count}'


class FakeSQS:
    def __init__(self):
        self.messages = []
        self.fail = False

    def send_message(self, **kwargs):
        if self.fail:
            raise OSError("SQS unavailable")
        self.messages.append(kwargs)


class JobTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)
        with self.sessions.begin() as db:
            db.add_all([AppUser(user_id=i, email=f"{i}@example.test", nickname=f"User {i}") for i in (1, 2)])
        self.config = replace(settings, app_role="api", s3_bucket="test-bucket", s3_presign_enabled=True,
                              character_generation_enabled=True,
                              character_worker_token="w"*40, ai_worker_token="a"*40,
                              character_lease_seconds=180, character_max_attempts=3,
                              character_queue_url="https://sqs.ap-northeast-2.amazonaws.com/000000000000/test")
        for module in (jobs, main, inference_client, ai_worker):
            p = patch.object(module, "settings", self.config)
            p.start()
            self.addCleanup(p.stop)
        self.s3, self.sqs = FakeS3(), FakeSQS()
        self.service = jobs.CharacterJobService(self.sessions, self.s3, self.sqs)
        p = patch.object(jobs, "service", self.service)
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(self.engine.dispose)
        self.request = Request({"type": "http", "scheme": "https", "server": ("api.example.test", 443), "path": "/", "headers": []})

    def create(self, user=1, key="request-1", data=None):
        return self.service.create_job(user, data or png(), key)

    def expire(self, job_id):
        with self.sessions.begin() as db:
            job = db.get(CharacterJob, job_id)
            job.lease_until = jobs.utcnow() - timedelta(seconds=1)
            job.last_dispatched_at = jobs.utcnow() - timedelta(seconds=500)

    def complete(self, job):
        claim = self.service.claim(job.id)
        token = claim["lease_token"]
        with self.sessions() as db:
            row = db.get(CharacterJob, job.id)
            for index in (1, 2, 3):
                data = png()
                self.s3.put_object(Bucket=row.bucket_name, Key=jobs.output_key(row, index), Body=data)
                self.service.accept_candidate(job.id, jobs.CandidateUpdate(
                    lease_token=token, index=index, sha256=hashlib.sha256(data).hexdigest(),
                    seed=index, face_bounds=(300, 600, 700, 800),
                ))
        self.service.update(job.id, jobs.LeaseUpdate(lease_token=token, status="completed", progress=100))
        return token

    def test_admission_is_durable_and_queue_only_contains_job_id(self):
        job = self.create()
        self.assertEqual(self.service.get_job(job.id, 1).status, "queued")
        self.assertEqual(self.sqs.messages[0]["MessageBody"], '{"job_id": "' + job.id + '"}')
        self.assertEqual(len(self.s3.objects), 1)

    def test_dispatch_overrides_queue_delay_for_new_and_retried_jobs(self):
        job = self.create()
        self.assertEqual(self.sqs.messages[0]["DelaySeconds"], 0)
        self.service.claim(job.id)
        self.expire(job.id)
        self.service.dispatch()
        self.assertEqual(len(self.sqs.messages), 2)
        self.assertTrue(all(message["DelaySeconds"] == 0 for message in self.sqs.messages))

    def test_same_key_is_idempotent(self):
        first = self.create()
        self.assertEqual(self.create().id, first.id)
        self.assertEqual(len(self.s3.objects), 1)

    def test_paused_admission_does_not_upload_write_or_dispatch(self):
        with patch.object(jobs, "settings", replace(self.config, character_generation_enabled=False)):
            with self.assertRaises(HTTPException) as caught:
                self.create()
            self.assertEqual(caught.exception.status_code, 503)
            self.service.start()
            self.service.dispatch()
            self.assertFalse(self.s3.objects)
            self.assertFalse(self.sqs.messages)
            with self.sessions() as db:
                self.assertEqual(db.scalar(select(func.count()).select_from(CharacterJob)), 0)

    def test_paused_incomplete_jobs_report_pause_instead_of_waiting(self):
        job = self.create()
        with patch.object(jobs, "settings", replace(self.config, character_generation_enabled=False)):
            for operation in (
                lambda: self.service.get_job(job.id, 1),
                lambda: self.service.latest_active(1),
                lambda: self.service.claim(job.id),
            ):
                with self.assertRaises(HTTPException) as caught:
                    operation()
                self.assertEqual(caught.exception.status_code, 503)
            with self.assertRaises(KeyError):
                self.service.get_job(job.id, 2)

    def test_pausing_does_not_hide_completed_candidates(self):
        job = self.create()
        self.complete(job)
        with patch.object(jobs, "settings", replace(self.config, character_generation_enabled=False)):
            self.assertEqual(len(self.service.get_job(job.id, 1).candidates), 3)

    def test_pause_endpoint_and_upload_require_auth_and_do_not_start_work(self):
        client = TestClient(main.app)
        self.addCleanup(client.close)
        self.assertEqual(client.get('/api/character-generations/availability').status_code, 401)
        main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(user_id=1)
        self.addCleanup(main.app.dependency_overrides.clear)
        with patch.object(main, 'settings', replace(self.config, character_generation_enabled=False)), \
             patch.object(main, '_read_image_upload') as read:
            response = client.get('/api/character-generations/availability')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {'enabled': False, 'message': jobs.GENERATION_PAUSED_MESSAGE})
            response = client.post('/api/character-generations', files={'file': ('plant.png', png(), 'image/png')})
            self.assertEqual(response.status_code, 503)
            read.assert_not_called()
            self.assertFalse(self.sqs.messages)
            self.assertFalse(self.s3.objects)

    def test_same_key_with_different_photo_is_rejected(self):
        self.create()
        with self.assertRaises(HTTPException) as caught:
            self.create(data=png("red"))
        self.assertEqual(caught.exception.status_code, 409)

    def test_same_photo_recovers_active_job_after_client_loses_request_id(self):
        first = self.create()
        self.assertEqual(self.create(key="other-request").id, first.id)

    def test_ownership(self):
        job = self.create()
        with self.assertRaises(KeyError):
            self.service.get_job(job.id, 2)

    def test_only_one_active_job_per_user(self):
        self.create()
        with self.assertRaises(HTTPException):
            self.create(key="other", data=png("red"))
        self.create(user=2)

    def test_s3_failure_does_not_leave_a_job(self):
        self.s3.fail = True
        with self.assertRaises(HTTPException) as caught:
            self.create()
        self.assertEqual(caught.exception.status_code, 503)
        self.assertNotIn("credentials", caught.exception.detail)
        with self.sessions() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(CharacterJob)), 0)

    def test_sqs_failure_is_recovered_after_restart(self):
        self.sqs.fail = True
        job = self.create()
        self.sqs.fail = False
        new_process = jobs.CharacterJobService(self.sessions, self.s3, self.sqs)
        new_process.dispatch()
        self.assertEqual(len(self.sqs.messages), 1)
        self.assertEqual(new_process.get_job(job.id, 1).status, "queued")

    def test_duplicate_delivery_cannot_start_two_attempts(self):
        job = self.create()
        first = self.service.claim(job.id)
        second = self.service.claim(job.id)
        self.assertEqual(first["action"], "run")
        self.assertEqual(second["action"], "wait")
        with self.sessions() as db:
            self.assertEqual(db.get(CharacterJob, job.id).attempts, 1)

    def test_expired_worker_is_fenced_and_attempt_keys_change(self):
        job = self.create()
        first = self.service.claim(job.id)
        with self.sessions() as db:
            key = jobs.output_key(db.get(CharacterJob, job.id), 1)
        self.expire(job.id)
        second = self.service.claim(job.id)
        with self.assertRaises(HTTPException):
            self.service.update(job.id, jobs.LeaseUpdate(lease_token=first["lease_token"]))
        self.service.update(job.id, jobs.LeaseUpdate(lease_token=second["lease_token"]))
        with self.sessions() as db:
            self.assertNotEqual(key, jobs.output_key(db.get(CharacterJob, job.id), 1))

    def test_heartbeat_extends_lease_without_resetting_progress(self):
        job = self.create()
        token = self.service.claim(job.id)["lease_token"]
        self.service.update(job.id, jobs.LeaseUpdate(lease_token=token, status="generating", progress=55))
        self.service.update(job.id, jobs.LeaseUpdate(lease_token=token))
        self.assertEqual(self.service.get_job(job.id, 1).progress, 55)

    def test_completion_requires_three_verified_candidates(self):
        job = self.create()
        token = self.service.claim(job.id)["lease_token"]
        with self.assertRaises(HTTPException):
            self.service.update(job.id, jobs.LeaseUpdate(lease_token=token, status="completed"))

    def test_corrupt_object_is_not_accepted(self):
        job = self.create()
        token = self.service.claim(job.id)["lease_token"]
        with self.sessions() as db:
            key = jobs.output_key(db.get(CharacterJob, job.id), 1)
        self.s3.put_object(Bucket="test-bucket", Key=key, Body=b"corrupt")
        with self.assertRaises(HTTPException):
            self.service.accept_candidate(job.id, jobs.CandidateUpdate(lease_token=token, index=1, sha256="0"*64, seed=1))

    def test_completed_read_refreshes_urls_and_preserves_face_bounds(self):
        job = self.create()
        self.complete(job)
        first, second = self.service.get_job(job.id, 1), self.service.get_job(job.id, 1)
        self.assertEqual(len(first.candidates), 3)
        self.assertNotEqual(first.candidates[0].image_url, second.candidates[0].image_url)
        self.assertTrue(first.candidates[0].checksum.startswith("face-v1:300,600,700,800:"))
        self.assertEqual(self.service.claim(job.id)["action"], "ack")

    def test_max_attempts_and_deadline_are_bounded(self):
        job = self.create()
        for _ in range(3):
            self.assertEqual(self.service.claim(job.id)["action"], "run")
            self.expire(job.id)
        self.service.dispatch()
        self.assertEqual(self.service.get_job(job.id, 1).status, "failed")
        other = self.create(user=2)
        with self.sessions.begin() as db:
            db.get(CharacterJob, other.id).created_at = jobs.utcnow() - timedelta(days=1)
        self.service.dispatch()
        self.assertEqual(self.service.get_job(other.id, 2).status, "failed")

    def test_worker_failure_retries_without_disclosing_error(self):
        job = self.create()
        token = self.service.claim(job.id)["lease_token"]
        self.service.update(job.id, jobs.LeaseUpdate(lease_token=token, status="failed"))
        self.assertEqual(self.service.get_job(job.id, 1).status, "queued")
        with self.assertRaises(HTTPException):
            self.service.update(job.id, jobs.LeaseUpdate(lease_token=token))

    def test_registration_uses_owned_keys_not_client_url_and_is_idempotent(self):
        job = self.create()
        self.complete(job)
        payload = PlantCreate(characterJobId=job.id, characterCandidateId=f"{job.id}-2",
                              capturedPhotoUri="file:///var/mobile/cache/photo.jpg",
                              characterImageUrl="https://untrusted.example/arbitrary.png",
                              characterChecksum="fake", nickname="Plant", commonNameKo="Monstera")
        with self.sessions() as db:
            user = db.get(AppUser, 1)
            result = main.create_plant(payload, self.request, user, db)
            repeated = main.create_plant(payload, self.request, user, db)
            self.assertEqual(result.id, repeated.id)
            self.assertEqual(db.scalar(select(func.count()).select_from(Plant)), 1)
            assets = db.scalars(select(MediaAsset)).all()
            self.assertEqual(len(assets), 2)
            character = next(a for a in assets if a.asset_type == "CHARACTER_IMAGE")
            self.assertEqual(character.bucket_name, "test-bucket")
            self.assertTrue(character.checksum.startswith("face-v1:"))
            self.assertNotIn("untrusted", character.file_url)
            photo = next(a for a in assets if a.asset_type == "PLANT_PHOTO")
            self.assertTrue(photo.file_url.startswith("s3://test-bucket/"))
            self.assertNotIn("file:///", photo.file_url)

    def test_registration_rejects_another_users_job(self):
        job = self.create()
        self.complete(job)
        with self.sessions() as db, self.assertRaises(HTTPException):
            main.create_plant(PlantCreate(characterJobId=job.id, characterCandidateId=f"{job.id}-1",
                                         nickname="Plant", commonNameKo="Monstera"), self.request, db.get(AppUser, 2), db)

    def test_cloud_diary_photo_uses_the_leaflog_policy_prefix(self):
        data = png()
        upload = SimpleNamespace(content_type="image/png", file=io.BytesIO(data))
        def store(body, key, mime):
            self.assertEqual(body, data)
            self.assertEqual(mime, "image/png")
            self.assertTrue(key.startswith("leaflog/diary/1/"))
            return f"https://test-bucket.s3.ap-northeast-2.amazonaws.com/{key}"
        with self.sessions() as db, patch.object(main, "upload_bytes", side_effect=store), \
             patch.object(main, "presigned_get_url", return_value="signed-photo"), \
             patch.object(main, "save_local_file") as local:
            result = asyncio.run(main.upload_diary_photo(self.request, upload, db.get(AppUser, 1), db))
            asset = db.get(MediaAsset, result.asset_id)
            self.assertEqual(asset.asset_type, "GROWTH_DIARY_PHOTO")
            self.assertEqual(asset.bucket_name, "test-bucket")
            self.assertEqual(asset.checksum, hashlib.sha256(data).hexdigest())
            self.assertEqual(result.url, "signed-photo")
            local.assert_not_called()

    def test_cloud_diary_upload_failure_does_not_store_an_unservable_local_url(self):
        upload = SimpleNamespace(content_type="image/png", file=io.BytesIO(png()))
        with self.sessions() as db, patch.object(main, "upload_bytes", return_value=None), \
             patch.object(main, "save_local_file") as local:
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(main.upload_diary_photo(self.request, upload, db.get(AppUser, 1), db))
            self.assertEqual(caught.exception.status_code, 503)
            self.assertEqual(db.scalar(select(func.count()).select_from(MediaAsset)), 0)
            local.assert_not_called()

    def test_standalone_diary_upload_keeps_its_existing_local_fallback(self):
        upload = SimpleNamespace(content_type="image/png", file=io.BytesIO(png()))
        with self.sessions() as db, patch.object(main, "settings", replace(self.config, app_role="standalone")), \
             patch.object(main, "upload_bytes", return_value=None), \
             patch.object(main, "save_local_file", return_value="/static/uploads/diary/test.png") as local:
            result = asyncio.run(main.upload_diary_photo(self.request, upload, db.get(AppUser, 1), db))
            self.assertTrue(local.call_args.args[1].startswith("diary/1/"))
            self.assertEqual(result.url, "https://api.example.test/static/uploads/diary/test.png")
            self.assertIsNone(db.get(MediaAsset, result.asset_id).bucket_name)

    def test_deleted_plants_cannot_be_recreated_from_the_old_job(self):
        job = self.create()
        self.complete(job)
        payload = PlantCreate(characterJobId=job.id, characterCandidateId=f"{job.id}-1",
                              nickname="Plant", commonNameKo="Monstera")
        with self.sessions() as db:
            user = db.get(AppUser, 1)
            plant = main.create_plant(payload, self.request, user, db)
            main.delete_plant(plant.id, user, db)
            self.assertEqual(self.service.get_job(job.id, 1).candidates, [])
            with self.assertRaises(HTTPException):
                main.create_plant(payload, self.request, user, db)

    def test_refresh_cannot_sign_an_arbitrary_key(self):
        with self.sessions() as db, patch.object(main, "presigned_get_url", return_value="fresh-url"):
            user = db.get(AppUser, 1)
            with self.assertRaises(HTTPException):
                main.refresh_media_url(main.MediaRefreshRequest(url="https://test-bucket.s3.amazonaws.com/secret"), user, db)
            job = self.create()
            self.complete(job)
            candidate = self.service.get_job(job.id, 1).candidates[0]
            self.assertEqual(main.refresh_media_url(main.MediaRefreshRequest(url=candidate.image_url), user, db), {"url": "fresh-url"})

    def test_internal_routes_require_service_token(self):
        client = TestClient(main.app)
        self.addCleanup(client.close)
        url = "/internal/character-jobs/" + "a" * 32 + "/claim"
        self.assertEqual(client.post(url).status_code, 401)
        self.assertEqual(client.post(url, headers={"X-LeafLog-Worker-Token": "w"*40}).json(), {"action": "ack"})
        self.assertEqual(client.get("/image-lab").status_code, 404)
        self.assertEqual(client.post("/images/remove-background", files={"file": ("x.png", png(), "image/png")}).status_code, 404)

    def test_school_gateway_requires_auth_before_parsing_body(self):
        client = TestClient(ai_worker.app)
        self.addCleanup(client.close)
        self.assertEqual(client.post("/internal/ai/embed", content=b"bad-json").status_code, 401)
        self.assertEqual(client.post("/internal/ai/embed", json={"image_base64": "bad"},
                                    headers={"X-LeafLog-AI-Token": "a"*40}).status_code, 400)

    def test_worker_uploads_and_acks_only_after_durable_completion(self):
        job = self.create()
        config = self.config
        with tempfile.TemporaryDirectory() as temp:
            config = replace(config, character_output_dir=Path(temp))
            service = self.service
            s3 = self.s3
            class Pipeline:
                def __init__(self, on_update, on_candidate):
                    self.progress, self.candidate = on_update, on_candidate
                def run_inline(self, job_id, user_id, data):
                    folder = Path(temp) / job_id
                    folder.mkdir()
                    self.progress(job_id, {"status": "generating", "progress": 20})
                    for index in (1, 2, 3):
                        (folder / f"candidate-{index}.png").write_bytes(png())
                        self.candidate(job_id, SimpleNamespace(id=f"{job_id}-{index}", seed=index, face_bounds=(300, 600, 700, 800)))
                    self.progress(job_id, {"status": "completed", "progress": 100})
                    return SimpleNamespace(status="completed")
                def shutdown(self):
                    pass
            def api(job_id, action, payload=None):
                if action == "claim": return service.claim(job_id)
                if action == "update": return service.update(job_id, jobs.LeaseUpdate(**payload))
                if action == "upload-target": return service.upload_target(job_id, jobs.CandidateUpdate(**payload))
                return service.accept_candidate(job_id, jobs.CandidateUpdate(**payload))
            def put(url, *, data, **kwargs):
                from urllib.parse import urlparse
                s3.put_object(Bucket="test-bucket", Key=urlparse(url).path.lstrip("/"), Body=data)
                return SimpleNamespace(status_code=200)
            sqs = Mock()
            sqs.delete_message.side_effect = lambda **kwargs: self.assertEqual(service.get_job(job.id, 1).status, "completed")
            fake_module = SimpleNamespace(CharacterGenerationManager=Pipeline)
            with patch.object(ai_worker, "settings", config), patch.object(ai_worker, "gpu_slot", return_value=nullcontext()), \
                 patch.object(ai_worker, "api_call", side_effect=api), \
                 patch.object(ai_worker, "download_input", return_value=png()), \
                 patch.object(ai_worker.requests, "put", side_effect=put), \
                 patch.dict(sys.modules, {"app.character_generation": fake_module}):
                ai_worker.process_message(sqs, {"Body": '{"job_id": "' + job.id + '"}', "ReceiptHandle": "receipt"})
            sqs.delete_message.assert_called_once()
            self.assertFalse((Path(temp) / job.id).exists())

    def test_worker_does_not_ack_when_claim_fails(self):
        sqs = Mock()
        with patch.object(ai_worker, "gpu_slot", return_value=nullcontext()), patch.object(ai_worker, "api_call", side_effect=RuntimeError()):
            with self.assertRaises(RuntimeError):
                ai_worker.process_message(sqs, {"Body": '{"job_id":"' + "a"*32 + '"}', "ReceiptHandle": "receipt"})
        sqs.delete_message.assert_not_called()

    def test_unknown_probe_job_is_acked_without_loading_models(self):
        sqs = Mock()
        with patch.object(ai_worker, "gpu_slot", return_value=nullcontext()), \
             patch.object(ai_worker, "api_call", side_effect=lambda job_id, action: self.service.claim(job_id)), \
             patch.object(ai_worker, "download_input") as download:
            ai_worker.process_message(sqs, {"Body": '{"job_id":"' + "e"*32 + '"}', "ReceiptHandle": "probe"})
            sqs.delete_message.assert_called_once_with(QueueUrl=self.config.character_queue_url, ReceiptHandle="probe")
            download.assert_not_called()
            with self.sessions() as db:
                self.assertEqual(db.scalar(select(func.count()).select_from(CharacterJob)), 0)

    def test_migration_preserves_checksum_and_rejects_changed_rows(self):
        from scripts import migrate_media as media
        with tempfile.TemporaryDirectory() as temp, self.sessions() as db:
            root = Path(temp)
            file = root / "generated/characters/old/candidate.png"
            file.parent.mkdir(parents=True)
            data = png()
            file.write_bytes(data)
            original_checksum = jobs.checksum(hashlib.sha256(data).hexdigest(), (300, 600, 700, 800))
            asset = MediaAsset(user_id=1, object_key="generated/characters/old/candidate.png",
                               file_url="http://old-school.test/generated/characters/old/candidate.png",
                               asset_type="CHARACTER_IMAGE", checksum=original_checksum)
            db.add(asset)
            db.commit()
            manifest = media.plan(db, self.s3, root, "test-bucket")
            self.assertFalse(manifest["skipped"])
            media.upload(manifest, root, self.s3)
            self.assertTrue(file.exists())
            asset.file_url = "http://changed.test/image.png"
            db.commit()
            with self.assertRaises(ValueError):
                media.apply_db(db, manifest, self.s3)
            db.rollback()
            asset.file_url = manifest["entries"][0]["old"]["file_url"]
            db.commit()
            media.apply_db(db, manifest, self.s3)
            db.commit()
            self.assertEqual(asset.checksum, original_checksum)
            self.assertEqual(asset.bucket_name, "test-bucket")
            self.assertTrue(asset.file_url.startswith("s3://"))
            media.apply_db(db, manifest, self.s3)
            db.commit()

    def test_migration_blocks_path_traversal(self):
        from scripts.migrate_media import confined
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(ValueError):
            confined(Path(temp), "../secrets.env")


class ConsumerHealthTests(unittest.TestCase):
    def setUp(self):
        self.config = replace(settings, character_generation_enabled=True, ai_worker_token="a" * 40,
                              character_queue_url="https://sqs.ap-northeast-2.amazonaws.com/000000000000/test")
        self.stop = threading.Event()
        for name, value in (("settings", self.config), ("_stop", self.stop),
                            ("_thread", Mock(is_alive=lambda: True)),
                            ("_queue_failures", {}),
                            ("_queue_state", {"status": "starting", "error": None})):
            patched = patch.object(ai_worker, name, value)
            patched.start()
            self.addCleanup(patched.stop)
        self.client = TestClient(ai_worker.app)
        self.addCleanup(self.client.close)

    def health(self):
        return self.client.get("/health", headers={"X-LeafLog-AI-Token": "a" * 40})

    def finish_poll(self, **kwargs):
        self.stop.set()
        return {"Messages": []}

    def test_live_thread_is_not_ready_before_first_successful_receive(self):
        self.assertEqual(self.health().status_code, 503)
        self.assertEqual(self.health().json()["queue"]["status"], "starting")
        self.assertEqual(self.client.get("/health").status_code, 401)

    def test_empty_receive_confirms_connection_with_no_extra_permissions(self):
        sqs = Mock()
        sqs.receive_message.side_effect = self.finish_poll
        with patch.object(ai_worker.boto3, "client", return_value=sqs):
            ai_worker.consume()
        self.assertEqual(self.health().status_code, 200)
        self.assertEqual(self.health().json()["queue"], {"status": "ready", "error": None})
        sqs.receive_message.assert_called_once_with(QueueUrl=self.config.character_queue_url,
            MaxNumberOfMessages=1, WaitTimeSeconds=20, VisibilityTimeout=self.config.character_lease_seconds)
        sqs.get_queue_attributes.assert_not_called()
        sqs.get_queue_url.assert_not_called()
        sqs.close.assert_called_once()

    def test_missing_credentials_and_access_denial_report_unavailable(self):
        for error, reason in (
            (NoCredentialsError(), "NoCredentialsError"),
            (ClientError({"Error": {"Code": "AccessDenied", "Message": "private-value"}}, "ReceiveMessage"), "AccessDenied"),
            (ClientError({"Error": {"Code": "ExpiredToken", "Message": "private-value"}}, "ReceiveMessage"), "ExpiredToken"),
            (ClientError({"Error": {"Code": "private-value", "Message": "private-value"}}, "ReceiveMessage"), "ClientError"),
        ):
            with self.subTest(reason=reason):
                self.stop.clear()
                sqs = Mock()
                sqs.receive_message.side_effect = error
                with patch.object(ai_worker.boto3, "client", return_value=sqs), \
                     patch.object(self.stop, "wait", side_effect=lambda timeout: self.stop.set()), \
                     self.assertLogs(ai_worker.log, level="ERROR") as logs:
                    ai_worker.consume()
                response = self.health()
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.json()["queue"], {"status": "unavailable", "error": reason})
                self.assertNotIn("private-value", response.text + str(logs.output))
                sqs.delete_message.assert_not_called()
                sqs.close.assert_called_once()

    def test_client_initialization_failure_retries_without_killing_consumer(self):
        sqs = Mock()
        sqs.receive_message.side_effect = self.finish_poll
        observed = []
        with patch.object(ai_worker.boto3, "client", side_effect=[ProfileNotFound(profile="private-profile"), sqs]) as create, \
             patch.object(self.stop, "wait", side_effect=lambda timeout: observed.append(self.health())), \
             self.assertLogs(ai_worker.log, level="ERROR") as logs:
            ai_worker.consume()
        self.assertEqual(create.call_count, 2)
        self.assertEqual(observed[0].status_code, 503)
        self.assertEqual(observed[0].json()["queue"]["error"], "ProfileNotFound")
        self.assertNotIn("private-profile", observed[0].text + str(logs.output))
        self.assertEqual(self.health().status_code, 200)

    def test_receive_failure_recreates_client_and_recovers(self):
        first, second = Mock(), Mock()
        first.receive_message.side_effect = NoCredentialsError()
        second.receive_message.side_effect = self.finish_poll
        observed = []
        with patch.object(ai_worker.boto3, "client", side_effect=[first, second]), \
             patch.object(self.stop, "wait", side_effect=lambda timeout: observed.append(self.health().status_code)), \
             self.assertLogs(ai_worker.log, level="ERROR"):
            ai_worker.consume()
        self.assertEqual(observed, [503])
        self.assertEqual(self.health().status_code, 200)
        first.close.assert_called_once()
        second.close.assert_called_once()

    def test_stopped_consumer_never_looks_ready(self):
        ai_worker._queue_status("ready")
        with patch.object(ai_worker, "_thread", Mock(is_alive=lambda: False)):
            response = self.health()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["queue"]["status"], "stopped")

    def test_receive_does_not_hide_failed_delete_or_visibility_permissions(self):
        for operation in ("delete_message", "change_message_visibility"):
            with self.subTest(operation=operation):
                ai_worker._queue_status("starting")
                sqs = Mock()
                action = getattr(sqs, operation)
                action.side_effect = ClientError({"Error": {"Code": "AccessDenied", "Message": "private-value"}}, operation)
                with self.assertRaises(ClientError):
                    ai_worker.sqs_call(sqs, operation)
                ai_worker.sqs_call(sqs, "receive_message")
                self.assertEqual(self.health().status_code, 503)
                self.assertEqual(self.health().json()["queue"]["error"], "AccessDenied")
                self.assertNotIn("private-value", self.health().text)
                action.side_effect = None
                ai_worker.sqs_call(sqs, operation)
                self.assertEqual(self.health().status_code, 200)

    def test_all_failed_operations_must_recover_before_ready(self):
        error = NoCredentialsError()
        ai_worker._queue_status("unavailable", error, "delete_message")
        ai_worker._queue_status("unavailable", error, "change_message_visibility")
        ai_worker._queue_status("ready", operation="delete_message")
        self.assertEqual(self.health().status_code, 503)
        ai_worker._queue_status("ready", operation="change_message_visibility")
        self.assertEqual(self.health().status_code, 200)

    def test_delete_failure_is_reported_and_does_not_kill_consumer(self):
        sqs = Mock()
        sqs.receive_message.return_value = {"Messages": [{"Body": '{"job_id":"' + "a" * 32 + '"}', "ReceiptHandle": "receipt"}]}
        sqs.delete_message.side_effect = ClientError({"Error": {"Code": "AccessDenied"}}, "DeleteMessage")
        with patch.object(ai_worker.boto3, "client", return_value=sqs), \
             patch.object(ai_worker, "gpu_slot", return_value=nullcontext()), \
             patch.object(ai_worker, "api_call", return_value={"action": "ack"}), \
             patch.object(self.stop, "wait", side_effect=lambda timeout: self.stop.set()), \
             self.assertLogs(ai_worker.log, level="ERROR"):
            ai_worker.consume()
        self.assertEqual(self.health().status_code, 503)
        self.assertEqual(self.health().json()["queue"]["error"], "AccessDenied")
        sqs.delete_message.assert_called_once()
        sqs.close.assert_called_once()

    def test_busy_gpu_visibility_failure_leaves_message_unacknowledged(self):
        sqs = Mock()
        sqs.receive_message.return_value = {"Messages": [{"Body": '{"job_id":"' + "a" * 32 + '"}', "ReceiptHandle": "receipt"}]}
        sqs.change_message_visibility.side_effect = NoCredentialsError()
        with patch.object(ai_worker.boto3, "client", return_value=sqs), \
             patch.object(ai_worker, "process_message", side_effect=ai_worker.GpuBusy()), \
             patch.object(self.stop, "wait", side_effect=lambda timeout: self.stop.set()), \
             self.assertLogs(ai_worker.log, level="ERROR"):
            ai_worker.consume()
        self.assertEqual(self.health().status_code, 503)
        self.assertEqual(self.health().json()["queue"]["error"], "NoCredentialsError")
        sqs.change_message_visibility.assert_called_once_with(QueueUrl=self.config.character_queue_url,
            ReceiptHandle="receipt", VisibilityTimeout=15)
        sqs.delete_message.assert_not_called()

    def test_paused_worker_remains_available_without_aws(self):
        with patch.object(ai_worker, "settings", replace(self.config, character_generation_enabled=False)), \
             patch.object(ai_worker.boto3, "client") as create:
            ai_worker.consume()
            response = self.health()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["queue"], {"status": "paused", "error": None})
        create.assert_not_called()


class BoundaryTests(unittest.TestCase):
    def test_paused_api_requires_storage_and_ai_auth_but_not_sqs(self):
        config = replace(settings, app_role='api', character_generation_enabled=False,
                         database_url='postgresql://test/db', secret_key='s'*40,
                         s3_bucket='test-bucket', s3_presign_enabled=True,
                         ai_worker_url='http://127.0.0.1:8010', ai_worker_token='a'*40,
                         character_queue_url='', character_worker_token='')
        config.validate_runtime('api')
        with self.assertRaises(ValueError):
            replace(config, character_generation_enabled=True).validate_runtime('api')
        with self.assertRaises(ValueError):
            replace(config, ai_worker_token='').validate_runtime('api')

    def test_paused_worker_requires_no_queue_callback_or_aws_credentials(self):
        config = replace(settings, app_role='worker', character_generation_enabled=False,
                         character_queue_url='', character_worker_token='', character_worker_api_url='',
                         ai_worker_token='a'*40, character_gpu_mode_command='/usr/local/bin/leaflog-gpu',
                         character_gpu_ssh_host='', character_restore_ollama=True)
        with patch('app.config.os.name', 'posix'):
            config.validate_runtime('worker')
        with patch.object(ai_worker, 'settings', config), \
             patch.object(type(config), 'validate_runtime'), \
             patch.object(ai_worker, 'gpu_slot', return_value=nullcontext()), \
             patch('app.character_generation._switch_gpu_mode') as switch, \
             patch.object(ai_worker.boto3, 'client') as aws, \
             patch.object(ai_worker.threading, 'Thread') as thread, \
             patch.object(ai_worker, '_thread', None):
            ai_worker.start()
            ai_worker.consume()
            self.assertEqual(ai_worker.health()['status'], 'ok')
            self.assertFalse(ai_worker.health()['character_generation_enabled'])
            switch.assert_called_once_with('ollama')
            thread.assert_not_called()
            aws.assert_not_called()

    def test_upload_reader_is_bounded(self):
        upload = SimpleNamespace(content_type="image/png", file=Mock())
        upload.file.read.return_value = b"x" * (main.MAX_IMAGE_UPLOAD_BYTES + 1)
        with self.assertRaises(HTTPException) as caught:
            main._read_image_upload_sync(upload)
        self.assertEqual(caught.exception.status_code, 413)
        upload.file.read.assert_called_once_with(main.MAX_IMAGE_UPLOAD_BYTES + 1)

    def test_blocking_diagnosis_does_not_run_on_the_asgi_event_loop(self):
        import inspect
        self.assertFalse(inspect.iscoroutinefunction(main.diagnose_plant_photo))

    def test_cloud_import_does_not_load_inference_libraries(self):
        result = subprocess.run([sys.executable, "-c",
            "import app.main,sys; assert not {'torch','transformers','cv2','rembg','onnxruntime'} & sys.modules.keys()"],
            env={**os.environ, "APP_ROLE": "api", "DATABASE_URL": "sqlite://"}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_invalid_image_rejected(self):
        for data in (b"not image", b"", b"x" * (jobs.MAX_IMAGE_BYTES + 1)):
            with self.assertRaises(HTTPException):
                jobs.validate_image(data)

    def test_legacy_external_urls_are_not_signed_as_s3(self):
        with patch.object(main, "presigned_get_url") as sign:
            self.assertEqual(main._asset_url("old.png", "http://old-school.test/old.png"), "http://old-school.test/old.png")
            sign.assert_not_called()

    def test_cloud_chat_uses_service_auth_and_no_redirects(self):
        with patch.object(inference_client, "settings", replace(settings, app_role="api", ai_worker_url="http://127.0.0.1:8010", ai_worker_token="a"*40)):
            with patch.object(inference_client.requests, "post", return_value=Mock(status_code=200, json=lambda: {"message": {"content": "hello"}})) as post:
                self.assertEqual(inference_client.chat({"model": "test"}), "hello")
                self.assertTrue(post.call_args.args[0].endswith("/internal/ai/chat"))
                self.assertEqual(post.call_args.kwargs["headers"]["X-LeafLog-AI-Token"], "a"*40)
                self.assertFalse(post.call_args.kwargs["allow_redirects"])

    def test_standalone_chat_still_uses_ollama(self):
        with patch.object(inference_client, "settings", replace(settings, app_role="standalone")):
            with patch.object(inference_client.requests, "post", return_value=Mock(status_code=200, json=lambda: {"message": {"content": "hello"}})) as post:
                inference_client.chat({})
                self.assertEqual(post.call_args.args[0], settings.ollama_api_url)
                self.assertEqual(post.call_args.kwargs["headers"], {})

    def test_remote_busy_is_clear_and_does_not_leak_response(self):
        with patch.object(inference_client.requests, "post", return_value=Mock(status_code=503)):
            with self.assertRaises(inference_client.InferenceUnavailable):
                inference_client.post_json("http://example.test", {})

    def test_s3_download_only_uses_https_without_credentials(self):
        for url in ("http://bucket.s3.amazonaws.com/test", "https://evil.test/test", "https://user:pass@bucket.s3.amazonaws.com/test"):
            with self.assertRaises(ValueError):
                ai_worker.signed_url(url)

    def test_gpu_slot_rejects_simultaneous_model_work(self):
        with tempfile.TemporaryDirectory() as temp:
            config = replace(settings, ai_gpu_lock_path=Path(temp) / "gpu.lock")
            fake_fcntl = SimpleNamespace(LOCK_EX=1, LOCK_NB=2, flock=Mock())
            with patch.object(ai_worker, "settings", config), patch.dict(sys.modules, {"fcntl": fake_fcntl}):
                with ai_worker.gpu_slot():
                    with self.assertRaises(ai_worker.GpuBusy):
                        with ai_worker.gpu_slot():
                            pass
                with ai_worker.gpu_slot():
                    self.assertTrue(ai_worker._gpu_mutex.locked())
                self.assertFalse(ai_worker._gpu_mutex.locked())


if __name__ == "__main__":
    unittest.main()
