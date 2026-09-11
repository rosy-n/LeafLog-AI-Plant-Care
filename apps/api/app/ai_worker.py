"""School-only AI gateway and SQS consumer. Start with python -m app.ai_worker."""
from __future__ import annotations

import base64
import gc
import hashlib
import io
import json
import logging
import re
import secrets
import shutil
import threading
from contextlib import contextmanager
from urllib.parse import urlparse

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field

from .config import settings
from . import inference_client

log = logging.getLogger(__name__)
app = FastAPI(title="LeafLog school AI", docs_url=None, redoc_url=None, openapi_url=None)
MAX_IMAGE_BYTES = 12 * 1024 * 1024
_gpu_mutex = threading.Lock()
_stop = threading.Event()
_thread = None
_queue_state = {"status": "starting", "error": None}
_queue_failures = {}
_queue_state_lock = threading.Lock()


def _queue_status(status, error=None, operation="receive_message"):
    global _queue_state
    code = None
    if error is not None:
        code = type(error).__name__
        if isinstance(error, ClientError):
            aws_code = error.response.get("Error", {}).get("Code", "")
            if aws_code in {
                "AccessDenied", "AccessDeniedException", "ExpiredToken", "ExpiredTokenException",
                "InvalidClientTokenId", "InvalidSecurity", "SignatureDoesNotMatch",
                "UnrecognizedClientException", "RequestThrottled",
                "AWS.SimpleQueueService.NonExistentQueue",
            }:
                code = aws_code
    with _queue_state_lock:
        if status in {"starting", "paused"}:
            _queue_failures.clear()
        elif error is not None:
            _queue_failures[operation] = code
        elif status == "ready":
            _queue_failures.pop(operation, None)
        # Receiving successfully does not prove a failed delete/heartbeat recovered.
        if _queue_failures:
            status, code = "unavailable", next(iter(_queue_failures.values()))
        _queue_state = {"status": status, "error": code}


def sqs_call(sqs, operation, **kwargs):
    try:
        result = getattr(sqs, operation)(**kwargs)
    except Exception as exc:
        _queue_status("unavailable", exc, operation)
        raise
    _queue_status("ready", operation=operation)
    return result


class GpuBusy(RuntimeError):
    pass


@contextmanager
def gpu_slot():
    if not _gpu_mutex.acquire(blocking=False):
        raise GpuBusy()
    lock_file = None
    try:
        import fcntl
        settings.ai_gpu_lock_path.parent.mkdir(parents=True, exist_ok=True)
        lock_file = settings.ai_gpu_lock_path.open("a")
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise GpuBusy() from exc
        yield
    finally:
        if lock_file:
            lock_file.close()
        _gpu_mutex.release()


def require_ai(x_leaflog_ai_token: str = Header(default="")):
    if not settings.ai_worker_token or not secrets.compare_digest(x_leaflog_ai_token.encode(), settings.ai_worker_token.encode()):
        raise HTTPException(401, "Invalid AI credentials")


@app.middleware("http")
async def limit_body(request: Request, call_next):
    # Authenticate and bound the body before JSON/base64 parsing (including chunked requests).
    token = request.headers.get("X-LeafLog-AI-Token", "")
    if not settings.ai_worker_token or not secrets.compare_digest(token.encode(), settings.ai_worker_token.encode()):
        return JSONResponse({"detail": "Invalid AI credentials"}, status_code=401)
    body = bytearray()
    async for part in request.stream():
        body.extend(part)
        if len(body) > 18 * 1024 * 1024:
            return JSONResponse({"detail": "Request too large"}, status_code=413)
    request._body = bytes(body)
    return await call_next(request)


@app.exception_handler(GpuBusy)
async def busy_handler(request, exc):
    return JSONResponse({"detail": "AI is busy"}, status_code=503, headers={"Retry-After": "30"})


class OllamaOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    num_ctx: int | None = Field(default=None, ge=1, le=8192)
    num_predict: int = Field(default=2048, ge=1, le=4096)
    temperature: float | None = Field(default=None, ge=0, le=2)
    top_p: float | None = Field(default=None, ge=0, le=1)
    top_k: int | None = Field(default=None, ge=0, le=100)
    presence_penalty: float | None = Field(default=None, ge=-2, le=2)


class ChatRequest(BaseModel):
    model: str = Field(max_length=100)
    messages: list[dict] = Field(min_length=1, max_length=32)
    options: OllamaOptions = Field(default_factory=OllamaOptions)
    stream: bool = False
    think: bool = False


class EmbedRequest(BaseModel):
    image_base64: str = Field(max_length=16 * 1024 * 1024)


@app.get("/health", dependencies=[Depends(require_ai)])
def health():
    queue = {"status": "paused", "error": None}
    if settings.character_generation_enabled:
        queue = _queue_state
        if _thread is None or not _thread.is_alive():
            queue = {"status": "stopped", "error": None}
    ready = queue["status"] in {"paused", "ready"}
    body = {"status": "ok" if ready else "unavailable", "busy": _gpu_mutex.locked(),
            "character_generation_enabled": settings.character_generation_enabled, "queue": queue}
    return body if ready else JSONResponse(body, status_code=503)


@app.post("/internal/ai/chat", dependencies=[Depends(require_ai)])
def chat(payload: ChatRequest):
    from .persona_chat import MODEL_NAME
    if payload.model != MODEL_NAME or payload.stream:
        raise HTTPException(400, "Unsupported model or streaming mode")
    options = payload.options.model_dump(exclude_none=True)
    with gpu_slot():
        from .character_generation import _switch_gpu_mode
        try:
            _switch_gpu_mode("ollama")
            result = inference_client.post_json(settings.ollama_api_url, {
                "model": MODEL_NAME, "messages": payload.messages, "stream": False,
                "think": False, "options": options,
            })
            return {"message": {"content": result["message"]["content"]}}
        except Exception as exc:
            # 503은 API가 "학교 AI가 다른 작업을 처리 중"으로 안내한다 — GPU가 실제로 바쁠 때(GpuBusy)만 쓴다.
            log.error("School chat failed (%s)", type(exc).__name__)
            raise HTTPException(502, "School chat failed") from exc


@app.post("/internal/ai/embed", dependencies=[Depends(require_ai)])
def embed(payload: EmbedRequest):
    try:
        data = base64.b64decode(payload.image_base64, validate=True)
        if not data or len(data) > MAX_IMAGE_BYTES:
            raise ValueError()
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 24_000_000:
                raise ValueError()
            image = image.convert("RGB")
    except Exception as exc:
        raise HTTPException(400, "Invalid image") from exc
    with gpu_slot():
        from .diagnosis import _embed_image, _clip
        try:
            return {"vector": _embed_image(image)}
        finally:
            _clip.cache_clear()
            gc.collect()


def api_call(job_id, action, payload=None):
    response = requests.post(
        f"{settings.character_worker_api_url}/internal/character-jobs/{job_id}/{action}",
        json=payload or {}, timeout=(10, 40), allow_redirects=False,
        headers={"X-LeafLog-Worker-Token": settings.character_worker_token},
    )
    if response.status_code != 200:
        # Do not log a response containing signed URLs or authentication headers.
        raise RuntimeError(f"Worker API returned {response.status_code}")
    return response.json()


def signed_url(url):
    parsed = urlparse(url)
    if (parsed.scheme != "https" or not parsed.hostname or
        not parsed.hostname.endswith(".amazonaws.com") or parsed.username or parsed.password):
        raise ValueError("Invalid signed S3 URL")
    return url


def download_input(url, digest):
    with requests.get(signed_url(url), timeout=(10, 60), stream=True, allow_redirects=False) as response:
        if response.status_code != 200:
            raise RuntimeError("Input download failed")
        data = bytearray()
        for chunk in response.iter_content(64 * 1024):
            data.extend(chunk)
            if len(data) > MAX_IMAGE_BYTES:
                raise ValueError("Input too large")
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError("Input checksum mismatch")
    return bytes(data)


def process_message(sqs, message):
    receipt = message["ReceiptHandle"]
    try:
        job_id = json.loads(message["Body"])["job_id"]
        if not isinstance(job_id, str) or not re.fullmatch(r"[0-9a-f]{32}", job_id):
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        # Leave malformed messages for the queue's redrive policy/DLQ.
        log.error("Malformed character queue message")
        return

    with gpu_slot():
        claim = api_call(job_id, "claim")
        if claim["action"] == "ack":
            sqs_call(sqs, "delete_message", QueueUrl=settings.character_queue_url, ReceiptHandle=receipt)
            return
        if claim["action"] == "wait":
            return
        token = claim["lease_token"]
        finished, lost_lease = threading.Event(), threading.Event()
        def heartbeat():
            while not finished.wait(max(10, claim["lease_seconds"] // 3)):
                try:
                    api_call(job_id, "update", {"lease_token": token})
                    sqs_call(sqs, "change_message_visibility", QueueUrl=settings.character_queue_url,
                             ReceiptHandle=receipt, VisibilityTimeout=claim["lease_seconds"])
                except Exception:
                    lost_lease.set()
                    return
        heart = threading.Thread(target=heartbeat, name="character-heartbeat", daemon=True)
        heart.start()
        manager = None
        try:
            image_bytes = download_input(claim["input_url"], claim["input_sha256"])
            def progress(_job_id, changes):
                if lost_lease.is_set():
                    raise RuntimeError("Character lease lost")
                api_call(job_id, "update", {"lease_token": token, **{
                    k: v for k, v in changes.items() if k in {"status", "progress", "current_candidate"}
                }})

            def candidate(_job_id, result):
                if lost_lease.is_set():
                    raise RuntimeError("Character lease lost")
                index = int(result.id.rsplit("-", 1)[1])
                path = settings.character_output_dir / job_id / f"candidate-{index}.png"
                data = path.read_bytes()
                payload = {"lease_token": token, "index": index, "seed": result.seed,
                           "sha256": hashlib.sha256(data).hexdigest(), "face_bounds": result.face_bounds}
                target = api_call(job_id, "upload-target", payload)
                try:
                    response = requests.put(signed_url(target["url"]), data=data,
                                            headers={"Content-Type": "image/png", "If-None-Match": "*"},
                                            timeout=(10, 90), allow_redirects=False)
                except requests.RequestException:
                    # The shared pipeline logs exceptions; never pass it a signed URL.
                    raise RuntimeError("Candidate upload failed") from None
                if response.status_code not in {200, 412}:
                    raise RuntimeError("Candidate upload failed")
                api_call(job_id, "candidate", payload)

            from .character_generation import CharacterGenerationManager
            manager = CharacterGenerationManager(on_update=progress, on_candidate=candidate)
            result = manager.run_inline(job_id, claim["user_id"], image_bytes)
            # A successful update is durable before this delivery is acknowledged.
            if result.status == "completed":
                sqs_call(sqs, "delete_message", QueueUrl=settings.character_queue_url, ReceiptHandle=receipt)
        finally:
            finished.set()
            heart.join(timeout=55)
            if manager:
                manager.shutdown()
            root = settings.character_output_dir.resolve()
            original = root / job_id
            folder = original.resolve()
            if folder.parent == root and folder.is_dir() and not original.is_symlink():
                shutil.rmtree(folder)


def consume():
    if not settings.character_generation_enabled:
        return
    sqs = None
    try:
        while not _stop.is_set():
            if _gpu_mutex.locked():
                _stop.wait(2)
                continue
            try:
                if sqs is None:
                    sqs = boto3.client("sqs", region_name=settings.s3_region,
                                       config=Config(connect_timeout=10, read_timeout=30, retries={"max_attempts": 2}))
                result = sqs_call(sqs, "receive_message", QueueUrl=settings.character_queue_url,
                                  MaxNumberOfMessages=1, WaitTimeSeconds=20,
                                  VisibilityTimeout=settings.character_lease_seconds)
            except Exception as exc:
                _queue_status("unavailable", exc)
                log.error("School queue receive deferred (%s)", _queue_state["error"])
                if sqs is not None:
                    sqs.close()
                    sqs = None
                _stop.wait(10)
                continue
            for message in result.get("Messages", []):
                if _stop.is_set():
                    break
                try:
                    process_message(sqs, message)
                except GpuBusy:
                    try:
                        sqs_call(sqs, "change_message_visibility", QueueUrl=settings.character_queue_url,
                                 ReceiptHandle=message["ReceiptHandle"], VisibilityTimeout=15)
                    except Exception:
                        log.error("School queue visibility update failed (%s)", _queue_state["error"])
                        _stop.wait(10)
                except (BotoCoreError, ClientError):
                    log.error("School queue delivery deferred (%s)", _queue_state["error"])
                    _stop.wait(10)
                except Exception as exc:
                    log.error("School job processing deferred (%s)", type(exc).__name__)
                    _stop.wait(10)
    finally:
        if sqs is not None:
            sqs.close()


@app.on_event("startup")
def start():
    global _thread
    settings.validate_runtime("worker")
    # Recover the default mode after a process crash during SDXL inference.
    with gpu_slot():
        from .character_generation import _switch_gpu_mode
        _switch_gpu_mode("ollama")
    _stop.clear()
    _thread = None
    _queue_status("starting" if settings.character_generation_enabled else "paused")
    if settings.character_generation_enabled:
        _thread = threading.Thread(target=consume, name="character-consumer", daemon=False)
        _thread.start()


@app.on_event("shutdown")
def stop():
    _stop.set()
    if _thread:
        _thread.join()  # Finish/restore Ollama before shutting down the process.


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.ai_worker_host, port=settings.ai_worker_port, access_log=False)
