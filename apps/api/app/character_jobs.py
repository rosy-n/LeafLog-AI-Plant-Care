"""Durable character jobs. PostgreSQL owns state; SQS only wakes the school worker."""
from __future__ import annotations

import hashlib
import io
import json
import logging
import secrets
import threading
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import boto3
from fastapi import APIRouter, Depends, Header, HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from botocore.config import Config

from .character_types import CharacterCandidate, CharacterGenerationJob
from .config import settings
from .database import SessionLocal
from .models import CharacterJob
from .storage import _s3

log = logging.getLogger(__name__)
TERMINAL = ("completed", "failed")
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_IMAGE_PIXELS = 24_000_000
STAGES = {"preprocessing", "starting_gpu", "generating", "postprocessing"}
GENERATION_PAUSED_MESSAGE = "캐릭터 생성을 잠시 준비하고 있어요. 기존 식물은 계속 돌볼 수 있어요."
MESSAGES = {
    "queued": "캐릭터 생성 순서를 기다리고 있어요.",
    "preprocessing": "식물과 배경을 분리하고 있어요.",
    "starting_gpu": "이미지 생성 모델을 준비하고 있어요.",
    "generating": "도트 캐릭터를 만들고 있어요.",
    "postprocessing": "캐릭터의 배경과 표정을 정리하고 있어요.",
    "completed": "도트 캐릭터 3명이 준비됐어요.",
    "failed": "캐릭터를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
}


def utcnow():
    return datetime.now(timezone.utc)


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def require_generation_enabled():
    if not settings.character_generation_enabled:
        raise HTTPException(503, GENERATION_PAUSED_MESSAGE)


def validate_image(data: bytes) -> str:
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "사진은 12MB 이하로 올려주세요.")
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.width * im.height > MAX_IMAGE_PIXELS or getattr(im, "n_frames", 1) != 1:
                raise ValueError("Image dimensions or frame count")
            content_type = Image.MIME.get(im.format)
            if content_type not in {"image/jpeg", "image/png", "image/webp"}:
                raise ValueError("Unsupported format")
            im.verify()
        return content_type
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(400, "JPG, PNG 또는 WebP 사진을 올려주세요.") from exc


def output_key(job: CharacterJob, index: int) -> str:
    return f"leaflog/characters/{job.user_id}/{job.job_id}/attempt-{job.attempts}/candidate-{index}.png"


def checksum(digest: str, bounds) -> str:
    return (f"face-v1:{','.join(map(str, bounds))}:" if bounds else "") + digest


class LeaseUpdate(BaseModel):
    lease_token: str = Field(min_length=32, max_length=128)
    status: str | None = None
    progress: int = Field(default=0, ge=0, le=100)
    current_candidate: int = Field(default=0, ge=0, le=3)


class CandidateUpdate(LeaseUpdate):
    index: int = Field(ge=1, le=3)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    seed: int = Field(ge=0, le=2**32 - 1)
    face_bounds: tuple[int, int, int, int] | None = None


class CharacterJobService:
    def __init__(self, session_factory=SessionLocal, s3=None, sqs=None):
        self.sessions = session_factory
        self._s3_client = s3
        self._sqs_client = sqs
        self.stop_event = threading.Event()
        self.thread = None

    @property
    def s3(self):
        if self._s3_client is None:
            self._s3_client = _s3()
        return self._s3_client

    @property
    def sqs(self):
        if self._sqs_client is None:
            self._sqs_client = boto3.client("sqs", region_name=settings.s3_region,
                                           config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 1}))
        return self._sqs_client

    def sign(self, method, job, key, **extra):
        return self.s3.generate_presigned_url(
            method, Params={"Bucket": job.bucket_name, "Key": key, **extra},
            ExpiresIn=min(settings.s3_presign_expire, 3600),
        )

    def view(self, job):
        return CharacterGenerationJob(
            id=job.job_id, user_id=job.user_id, status=job.status, progress=job.progress,
            message=job.message, current_candidate=job.current_candidate, error=job.error,
            created_at=job.created_at, updated_at=job.updated_at,
            candidates=[CharacterCandidate(
                id=c["id"], image_url=self.sign("get_object", job, c["key"]),
                checksum=c["checksum"], seed=c["seed"], face_bounds=c["face_bounds"],
            ) for c in job.candidates] if job.status == "completed" else [],
        )

    def create_job(self, user_id, image_bytes, idempotency_key=None):
        require_generation_enabled()
        content_type = validate_image(image_bytes)
        digest = hashlib.sha256(image_bytes).hexdigest()
        if idempotency_key and (len(idempotency_key) > 100 or not idempotency_key.isascii()):
            raise HTTPException(400, "Invalid Idempotency-Key")
        job_id = uuid4().hex
        key = f"leaflog/characters/{user_id}/{job_id}/input"
        try:
            with self.sessions() as db, db.begin():
                # Serialize admission across API processes, not just across local threads.
                if db.bind.dialect.name == "postgresql":
                    db.execute(text("SELECT pg_advisory_xact_lock(1280067402)"))
                if idempotency_key:
                    existing = db.scalar(select(CharacterJob).where(
                        CharacterJob.user_id == user_id,
                        CharacterJob.idempotency_key == idempotency_key,
                    ))
                    if existing:
                        if existing.input_sha256 != digest:
                            raise HTTPException(409, "같은 요청 번호로 다른 사진을 보낼 수 없어요.")
                        return self.view(existing)
                active = select(CharacterJob).where(CharacterJob.status.not_in(TERMINAL))
                if db.scalar(select(func.count()).select_from(active.subquery())) >= settings.character_queue_limit:
                    raise HTTPException(429, "생성 요청이 많아요. 잠시 후 다시 시도해주세요.")
                running = db.scalar(active.where(CharacterJob.user_id == user_id))
                if running and running.input_sha256 == digest:
                    return self.view(running)
                if running:
                    raise HTTPException(409, "이미 진행 중인 캐릭터 생성이 있어요.")
                self.s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=image_bytes, ContentType=content_type)
                job = CharacterJob(job_id=job_id, user_id=user_id, input_sha256=digest,
                                   input_key=key, bucket_name=settings.s3_bucket,
                                   idempotency_key=idempotency_key or None, candidates=[])
                db.add(job)
                db.flush()
                result = self.view(job)
        except HTTPException:
            raise
        except IntegrityError as exc:
            raise HTTPException(409, "요청이 중복됐어요. 같은 요청 번호로 다시 확인해주세요.") from exc
        except Exception as exc:
            log.error("Character admission failed (%s)", type(exc).__name__)
            raise HTTPException(503, "생성 요청을 저장하지 못했어요. 잠시 후 다시 시도해주세요.") from exc
        # A crash or SQS failure here is recovered by the DB dispatcher.
        try:
            self.dispatch(job_id)
        except Exception as exc:
            log.warning("Character dispatch deferred (%s)", type(exc).__name__)
        return result

    def get_job(self, job_id, user_id):
        with self.sessions() as db:
            job = db.get(CharacterJob, job_id)
            if job is None or job.user_id != user_id:
                raise KeyError(job_id)
            if job.status not in TERMINAL:
                require_generation_enabled()
            return self.view(job)

    def latest_active(self, user_id):
        with self.sessions() as db:
            job = db.scalar(select(CharacterJob).where(
                CharacterJob.user_id == user_id, CharacterJob.status.not_in(TERMINAL),
            ).order_by(CharacterJob.created_at.desc()))
            if job:
                require_generation_enabled()
            return self.view(job) if job else None

    def fail(self, job):
        job.status = "failed"
        job.message = job.error = MESSAGES["failed"]
        job.lease_hash = job.lease_until = None
        job.updated_at = utcnow()

    def dispatch(self, job_id=None):
        if not settings.character_generation_enabled:
            return
        now = utcnow()
        with self.sessions() as db:
            query = select(CharacterJob.job_id).where(
                CharacterJob.status.not_in(TERMINAL),
                or_(CharacterJob.lease_until.is_(None), CharacterJob.lease_until <= now,
                    CharacterJob.created_at < now - timedelta(seconds=settings.character_job_timeout_seconds)),
            ).order_by(CharacterJob.created_at).limit(200)
            if job_id:
                query = query.where(CharacterJob.job_id == job_id)
            ids = db.scalars(query).all()
        # Do not hold active-job locks while sending an entire queue batch.
        for identifier in ids:
            with self.sessions() as db, db.begin():
                job = db.scalar(select(CharacterJob).where(CharacterJob.job_id == identifier).with_for_update(skip_locked=True))
                if job is None or job.status in TERMINAL:
                    continue
                if (now - aware(job.created_at)).total_seconds() > settings.character_job_timeout_seconds:
                    self.fail(job)
                    continue
                if job.lease_until and aware(job.lease_until) > now:
                    continue
                if job.attempts >= settings.character_max_attempts:
                    self.fail(job)
                    continue
                if job.status != "queued":
                    job.status, job.progress = "queued", 0
                    job.message = MESSAGES["queued"]
                    job.candidates = []
                    job.lease_hash = job.lease_until = None
                if job.last_dispatched_at and (now - aware(job.last_dispatched_at)).total_seconds() < settings.character_lease_seconds:
                    continue
                self.sqs.send_message(QueueUrl=settings.character_queue_url,
                                      MessageBody=json.dumps({"job_id": job.job_id}), DelaySeconds=0)
                job.last_dispatched_at = now

    def claim(self, job_id):
        require_generation_enabled()
        with self.sessions() as db, db.begin():
            job = db.scalar(select(CharacterJob).where(CharacterJob.job_id == job_id).with_for_update())
            if job is None or job.status in TERMINAL:
                return {"action": "ack"}
            now = utcnow()
            if job.lease_until and aware(job.lease_until) > now:
                return {"action": "wait"}
            if job.attempts >= settings.character_max_attempts or (now - aware(job.created_at)).total_seconds() > settings.character_job_timeout_seconds:
                self.fail(job)
                return {"action": "ack"}
            token = secrets.token_urlsafe(32)
            job.lease_hash = hashlib.sha256(token.encode()).hexdigest()
            job.lease_until = now + timedelta(seconds=settings.character_lease_seconds)
            job.attempts += 1
            job.candidates, job.progress, job.current_candidate = [], 0, 0
            job.status, job.message, job.updated_at = "preprocessing", MESSAGES["preprocessing"], now
            return {"action": "run", "lease_token": token, "user_id": job.user_id,
                    "lease_seconds": settings.character_lease_seconds,
                    "input_url": self.sign("get_object", job, job.input_key),
                    "input_sha256": job.input_sha256}

    def leased(self, db, job_id, token):
        job = db.scalar(select(CharacterJob).where(CharacterJob.job_id == job_id).with_for_update())
        if (job is None or job.status in TERMINAL or not job.lease_hash or
            not secrets.compare_digest(job.lease_hash, hashlib.sha256(token.encode()).hexdigest()) or
            not job.lease_until or aware(job.lease_until) <= utcnow()):
            raise HTTPException(409, "Character job lease expired")
        if (utcnow() - aware(job.created_at)).total_seconds() > settings.character_job_timeout_seconds:
            raise HTTPException(409, "Character job deadline exceeded")
        return job

    def update(self, job_id, payload: LeaseUpdate):
        with self.sessions() as db, db.begin():
            job = self.leased(db, job_id, payload.lease_token)
            if payload.status is not None:
                if payload.status not in STAGES | set(TERMINAL):
                    raise HTTPException(400, "Invalid job status")
                if payload.status == "completed" and len(job.candidates) != 3:
                    raise HTTPException(409, "Three verified candidates are required")
                if payload.status == "failed":
                    # Bounded retry; do not trust worker exception text with URLs/credentials.
                    if job.attempts < settings.character_max_attempts:
                        job.status, job.message, job.progress = "queued", MESSAGES["queued"], 0
                        job.candidates = []
                        job.last_dispatched_at = None
                    else:
                        self.fail(job)
                    job.lease_hash = job.lease_until = None
                    return {"ok": True}
                job.status, job.message = payload.status, MESSAGES[payload.status]
                job.progress = max(job.progress, payload.progress)
                job.current_candidate = max(job.current_candidate, payload.current_candidate)
            job.updated_at = utcnow()
            job.lease_until = utcnow() + timedelta(seconds=settings.character_lease_seconds)
            if job.status == "completed":
                job.progress = 100
                job.lease_hash = job.lease_until = None
            return {"ok": True}

    def upload_target(self, job_id, payload: CandidateUpdate):
        with self.sessions() as db, db.begin():
            job = self.leased(db, job_id, payload.lease_token)
            return {"url": self.sign("put_object", job, output_key(job, payload.index),
                                     ContentType="image/png", IfNoneMatch="*")}

    def accept_candidate(self, job_id, payload: CandidateUpdate):
        # Verify the actual private object; do not accept client-supplied URLs as assets.
        with self.sessions() as db, db.begin():
            job = self.leased(db, job_id, payload.lease_token)
            key = output_key(job, payload.index)
            obj = self.s3.get_object(Bucket=job.bucket_name, Key=key)
            body = obj["Body"]
            try:
                data = body.read(MAX_IMAGE_BYTES + 1)
            finally:
                body.close()
            if hashlib.sha256(data).hexdigest() != payload.sha256 or validate_image(data) != "image/png":
                raise HTTPException(400, "Invalid candidate object")
            with Image.open(io.BytesIO(data)) as im:
                width, height = im.size
                if width != settings.character_canvas_size or height != settings.character_canvas_size:
                    raise HTTPException(400, "Unexpected candidate dimensions")
                if payload.face_bounds:
                    left, top, right, bottom = payload.face_bounds
                    if not (0 <= left < right <= width and 0 <= top < bottom <= height):
                        raise HTTPException(400, "Invalid face bounds")
            entry = {"id": f"{job_id}-{payload.index}", "index": payload.index, "key": key,
                     "checksum": checksum(payload.sha256, payload.face_bounds), "seed": payload.seed,
                     "face_bounds": payload.face_bounds, "size": len(data), "width": width, "height": height}
            job.candidates = sorted([c for c in job.candidates if c["index"] != payload.index] + [entry], key=lambda c: c["index"])
            job.updated_at = utcnow()
            return {"ok": True}

    def start(self):
        if not settings.character_generation_enabled:
            return
        self.stop_event.clear()
        def run():
            while not self.stop_event.is_set():
                try:
                    self.dispatch()
                except Exception as exc:
                    log.error("Character dispatcher failed (%s)", type(exc).__name__)
                self.stop_event.wait(settings.character_dispatch_seconds)
        self.thread = threading.Thread(target=run, name="character-dispatch", daemon=True)
        self.thread.start()

    def shutdown(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=15)


service = CharacterJobService()


def require_worker(x_leaflog_worker_token: str = Header(default="")):
    if settings.app_role != "api" or not settings.character_worker_token or not secrets.compare_digest(
        x_leaflog_worker_token.encode(), settings.character_worker_token.encode()
    ):
        raise HTTPException(401, "Invalid worker credentials")


router = APIRouter(prefix="/internal/character-jobs", dependencies=[Depends(require_worker)], include_in_schema=False)


@router.post("/{job_id}/claim")
def claim(job_id: str):
    return service.claim(job_id)


@router.post("/{job_id}/update")
def update(job_id: str, payload: LeaseUpdate):
    return service.update(job_id, payload)


@router.post("/{job_id}/upload-target")
def upload_target(job_id: str, payload: CandidateUpdate):
    return service.upload_target(job_id, payload)


@router.post("/{job_id}/candidate")
def candidate(job_id: str, payload: CandidateUpdate):
    return service.accept_candidate(job_id, payload)
