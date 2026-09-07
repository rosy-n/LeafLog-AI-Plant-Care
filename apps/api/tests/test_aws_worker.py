"""Offline tests: in-memory DB, fake S3/SQS; never contact school/AWS."""
import hashlib
import io
import os
import subprocess
import sys
import unittest
import tempfile
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from dataclasses import replace
from datetime import timedelta
from unittest.mock import Mock, patch

os.environ.update(APP_ROLE="api", DATABASE_URL="sqlite://", AWS_EC2_METADATA_DISABLED="true")

from fastapi import HTTPException
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

    def test_same_key_is_idempotent(self):
        first = self.create()
        self.assertEqual(self.create().id, first.id)
        self.assertEqual(len(self.s3.objects), 1)

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
                              characterImageUrl="https://untrusted.example/arbitrary.png",
                              characterChecksum="fake", nickname="Plant", commonNameKo="Monstera")
        with self.sessions() as db:
            user = db.get(AppUser, 1)
            result = main.create_plant(payload, user, db)
            repeated = main.create_plant(payload, user, db)
            self.assertEqual(result.id, repeated.id)
            self.assertEqual(db.scalar(select(func.count()).select_from(Plant)), 1)
            assets = db.scalars(select(MediaAsset)).all()
            self.assertEqual(len(assets), 2)
            character = next(a for a in assets if a.asset_type == "CHARACTER_IMAGE")
            self.assertEqual(character.bucket_name, "test-bucket")
            self.assertTrue(character.checksum.startswith("face-v1:"))
            self.assertNotIn("untrusted", character.file_url)

    def test_registration_rejects_another_users_job(self):
        job = self.create()
        self.complete(job)
        with self.sessions() as db, self.assertRaises(HTTPException):
            main.create_plant(PlantCreate(characterJobId=job.id, characterCandidateId=f"{job.id}-1",
                                         nickname="Plant", commonNameKo="Monstera"), db.get(AppUser, 2), db)

    def test_deleted_plants_cannot_be_recreated_from_the_old_job(self):
        job = self.create()
        self.complete(job)
        payload = PlantCreate(characterJobId=job.id, characterCandidateId=f"{job.id}-1",
                              nickname="Plant", commonNameKo="Monstera")
        with self.sessions() as db:
            user = db.get(AppUser, 1)
            plant = main.create_plant(payload, user, db)
            main.delete_plant(plant.id, user, db)
            self.assertEqual(self.service.get_job(job.id, 1).candidates, [])
            with self.assertRaises(HTTPException):
                main.create_plant(payload, user, db)

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


class BoundaryTests(unittest.TestCase):
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
