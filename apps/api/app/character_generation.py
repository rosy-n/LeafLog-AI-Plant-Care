from __future__ import annotations

import base64
import hashlib
import logging
import os
import secrets
import shutil
import socket
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import requests

from .config import settings
from .image_preprocessing import (
    ImagePreprocessingError,
    preprocess_plant_photo,
    release_background_removal_sessions,
    remove_character_face,
    remove_background_for_sprite,
)

CharacterJobStatus = Literal[
    "queued",
    "preprocessing",
    "starting_gpu",
    "generating",
    "postprocessing",
    "completed",
    "failed",
]

PROMPT = (
    "<lora:plantpet_sprite_lora_v2:1.0>, plantpet_sprite, "
    "(long vertical rectangular pixel eyes:2.0), blush stickers, closed mouth, "
    "big face, potted plant, cute potted plant character, pixel art sprite, "
    "simple clean outline, front view, centered, white background, Pixel art style, "
    "bold outlines, White background, a simple and symmetrical plant sprite, "
    "clean leaf arrangement, minimal leaf count, bold dark outline, simple iconic silhouette, "
    "minimal shading, retro game sprite, (flat:2.0), transparent background, "
    "looking at viewer, plant, leaf"
)

NEGATIVE_PROMPT = (
    "photorealistic, realistic, 3d render, messy background, text, watermark, blurry, "
    "extra limbs, bad quality, background, stripe, high resolution, colorful outline, "
    "small detail, small dot, no face"
)

logger = logging.getLogger("uvicorn.error")
FACE_REMOVED_CHECKSUM_PREFIX = "face-v1:"
_forge_tunnel_lock = threading.RLock()
_forge_tunnel_process: subprocess.Popen[bytes] | None = None


@dataclass(frozen=True)
class CharacterCandidate:
    id: str
    image_url: str
    checksum: str
    seed: int
    face_bounds: tuple[int, int, int, int] | None = None


@dataclass
class CharacterGenerationJob:
    id: str
    user_id: int
    status: CharacterJobStatus = "queued"
    progress: int = 0
    message: str = "생성 작업을 기다리고 있어요."
    current_candidate: int = 0
    candidate_count: int = 3
    candidates: list[CharacterCandidate] = field(default_factory=list)
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class CharacterGenerationError(RuntimeError):
    pass


class CharacterGenerationManager:
    def __init__(self) -> None:
        self._jobs: dict[str, CharacterGenerationJob] = {}
        self._inputs: dict[str, bytes] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="character-generation")

    def create_job(self, user_id: int, image_bytes: bytes, public_base_url: str) -> CharacterGenerationJob:
        job_id = uuid.uuid4().hex
        job = CharacterGenerationJob(id=job_id, user_id=user_id)
        with self._lock:
            self._prune_jobs()
            self._jobs[job_id] = job
            self._inputs[job_id] = image_bytes
        self._executor.submit(self._run_job, job_id, public_base_url.rstrip("/"))
        return self.get_job(job_id, user_id)

    def get_job(self, job_id: str, user_id: int) -> CharacterGenerationJob:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None or job.user_id != user_id:
                raise KeyError(job_id)
            return _copy_job(job)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
        _stop_managed_forge_tunnel()

    def _update(self, job_id: str, **changes: object) -> None:
        with self._lock:
            job = self._jobs[job_id]
            for name, value in changes.items():
                setattr(job, name, value)
            job.updated_at = datetime.now(timezone.utc)

    def _append_candidate(self, job_id: str, candidate: CharacterCandidate) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.candidates.append(candidate)
            job.updated_at = datetime.now(timezone.utc)

    def _run_job(self, job_id: str, public_base_url: str) -> None:
        with self._lock:
            image_bytes = self._inputs.pop(job_id)

        job_started = time.perf_counter()
        outcome = "failed"
        sdxl_active = False
        try:
            self._update(
                job_id,
                status="preprocessing",
                progress=8,
                message="식물과 배경을 분리하고 있어요.",
            )
            stage_started = time.perf_counter()
            preprocessed = preprocess_plant_photo(
                image_bytes=image_bytes,
                canvas_size=settings.character_canvas_size,
                quality_mode=settings.character_preprocess_quality,
            )
            release_background_removal_sessions()
            _log_timing(job_id, "preprocess", stage_started)

            self._update(
                job_id,
                status="starting_gpu",
                progress=20,
                message="이미지 생성 모델을 준비하고 있어요.",
            )
            if not settings.character_mock_generation:
                stage_started = time.perf_counter()
                _switch_gpu_mode("sdxl")
                sdxl_active = True
                _log_timing(job_id, "gpu_switch_sdxl", stage_started)

                stage_started = time.perf_counter()
                _ensure_forge_tunnel()
                _wait_for_forge()
                _log_timing(job_id, "forge_ready", stage_started)

            job_dir = settings.character_output_dir / job_id
            job_dir.mkdir(parents=True, exist_ok=True)
            base_seed = secrets.randbelow(2_000_000_000)
            accepted_candidates = 0
            generation_attempt = 0
            max_generation_attempts = 6

            while accepted_candidates < 3 and generation_attempt < max_generation_attempts:
                generation_attempt += 1
                index = accepted_candidates + 1
                seed = base_seed + generation_attempt - 1
                progress = 20 + accepted_candidates * 23
                self._update(
                    job_id,
                    status="generating",
                    progress=progress,
                    current_candidate=index,
                    message=f"도트 캐릭터 {index}/3을 만들고 있어요.",
                )

                if settings.character_mock_generation:
                    stage_started = time.perf_counter()
                    generated_bytes = _mock_generated_image(image_bytes, index)
                else:
                    stage_started = time.perf_counter()
                    generated_bytes = _generate_with_forge(
                        input_png_base64=preprocessed.sdxl_input_png_base64,
                        seed=seed,
                    )
                _log_timing(
                    job_id,
                    "generate_candidate",
                    stage_started,
                    candidate=index,
                    seed=seed,
                )
                self._update(
                    job_id,
                    status="postprocessing",
                    progress=min(94, progress + 14),
                    message=f"도트 캐릭터 {index}/3의 배경과 표정을 정리하고 있어요.",
                )
                try:
                    stage_started = time.perf_counter()
                    cutout = remove_background_for_sprite(
                        image_bytes=generated_bytes,
                        canvas_size=settings.character_canvas_size,
                        quality_mode=settings.character_postprocess_quality,
                    )
                    _log_timing(
                        job_id,
                        "remove_background",
                        stage_started,
                        candidate=index,
                        quality=settings.character_postprocess_quality,
                    )
                    cutout_bytes = base64.b64decode(cutout.transparent_png_base64)
                    if settings.character_mock_generation:
                        png_bytes = cutout_bytes
                        checksum_prefix = ""
                        face_bounds = None
                    else:
                        stage_started = time.perf_counter()
                        face_removed = remove_character_face(cutout_bytes)
                        _log_timing(
                            job_id,
                            "remove_face",
                            stage_started,
                            candidate=index,
                        )
                        png_bytes = base64.b64decode(face_removed.face_removed_png_base64)
                        face_bounds = face_removed.face_bounds
                        bounds_text = ",".join(str(value) for value in face_bounds)
                        checksum_prefix = f"{FACE_REMOVED_CHECKSUM_PREFIX}{bounds_text}:"
                except ImagePreprocessingError as exc:
                    logger.warning(
                        "Rejected character candidate job_id=%s attempt=%s seed=%s reason=%s",
                        job_id,
                        generation_attempt,
                        seed,
                        exc,
                    )
                    release_background_removal_sessions()
                    self._update(
                        job_id,
                        status="generating",
                        message=f"표정이 선명한 도트 캐릭터 {index}/3을 다시 만들고 있어요.",
                    )
                    continue

                file_name = f"candidate-{index}.png"
                (job_dir / file_name).write_bytes(png_bytes)

                self._append_candidate(
                    job_id,
                    CharacterCandidate(
                        id=f"{job_id}-{index}",
                        image_url=f"{public_base_url}/generated/characters/{job_id}/{file_name}",
                        checksum=checksum_prefix + hashlib.sha256(png_bytes).hexdigest(),
                        seed=seed,
                        face_bounds=face_bounds,
                    ),
                )
                accepted_candidates += 1

            if accepted_candidates < 3:
                raise CharacterGenerationError(
                    "표정이 선명한 캐릭터 3개를 만들지 못했습니다. 다른 사진으로 다시 시도해주세요."
                )
            release_background_removal_sessions()

            if sdxl_active:
                stage_started = time.perf_counter()
                _switch_gpu_mode("ollama")
                sdxl_active = False
                _log_timing(job_id, "gpu_switch_ollama", stage_started)

            self._update(
                job_id,
                status="completed",
                progress=100,
                current_candidate=3,
                message="도트 캐릭터 3명이 준비됐어요.",
            )
            outcome = "completed"
        except Exception as exc:
            logger.exception("Character generation job %s failed", job_id)
            self._update(
                job_id,
                status="failed",
                message="캐릭터 생성에 실패했어요.",
                error=_public_error_message(exc),
            )
        finally:
            release_background_removal_sessions()
            if sdxl_active and settings.character_restore_ollama:
                try:
                    stage_started = time.perf_counter()
                    _switch_gpu_mode("ollama")
                    _log_timing(job_id, "gpu_switch_ollama_after_failure", stage_started)
                except Exception:
                    pass
            _log_timing(job_id, "total", job_started, outcome=outcome)

    def _prune_jobs(self) -> None:
        if len(self._jobs) < settings.character_max_jobs:
            return
        finished = sorted(
            (job for job in self._jobs.values() if job.status in {"completed", "failed"}),
            key=lambda job: job.updated_at,
        )
        while len(self._jobs) >= settings.character_max_jobs and finished:
            job = finished.pop(0)
            self._jobs.pop(job.id, None)
            self._inputs.pop(job.id, None)
            shutil.rmtree(settings.character_output_dir / job.id, ignore_errors=True)


def _copy_job(job: CharacterGenerationJob) -> CharacterGenerationJob:
    return CharacterGenerationJob(
        id=job.id,
        user_id=job.user_id,
        status=job.status,
        progress=job.progress,
        message=job.message,
        current_candidate=job.current_candidate,
        candidate_count=job.candidate_count,
        candidates=list(job.candidates),
        error=job.error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _switch_gpu_mode(mode: Literal["sdxl", "ollama"]) -> None:
    if settings.character_gpu_ssh_host:
        _switch_remote_gpu_mode(mode)
        return

    command = settings.character_gpu_mode_command.strip()
    if not command:
        return
    try:
        subprocess.run(
            [command, mode],
            check=True,
            capture_output=True,
            text=True,
            timeout=settings.character_gpu_switch_timeout_seconds,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise CharacterGenerationError(f"GPU 모드를 {mode}(으)로 전환하지 못했습니다.") from exc


def _switch_remote_gpu_mode(mode: Literal["sdxl", "ollama"]) -> None:
    remote_command = (
        f'wsl -d {settings.character_gpu_ssh_wsl_distro} '
        f'-u {settings.character_gpu_ssh_wsl_user} '
        f'-- bash -lc "leaflog-gpu {mode}"'
    )
    try:
        subprocess.run(
            [*_ssh_base_command(), remote_command],
            check=True,
            capture_output=True,
            text=True,
            timeout=settings.character_gpu_switch_timeout_seconds,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise CharacterGenerationError(f"학교 GPU를 {mode} 모드로 전환하지 못했습니다.") from exc


def _ssh_base_command() -> list[str]:
    command = [
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        f"ConnectTimeout={settings.character_gpu_ssh_connect_timeout_seconds}",
    ]
    identity_file = settings.character_gpu_ssh_identity_file
    if identity_file:
        command.extend(["-i", str(Path(identity_file).expanduser())])
    target = settings.character_gpu_ssh_host
    if settings.character_gpu_ssh_user:
        target = f"{settings.character_gpu_ssh_user}@{target}"
    command.append(target)
    return command


def _ensure_forge_tunnel() -> None:
    if not settings.character_gpu_ssh_host:
        return

    parsed_url = urlparse(settings.forge_api_url)
    if parsed_url.hostname not in {"127.0.0.1", "localhost", "::1"}:
        return
    local_port = parsed_url.port or (443 if parsed_url.scheme == "https" else 80)
    if _tcp_port_is_open("127.0.0.1", local_port):
        return

    global _forge_tunnel_process
    with _forge_tunnel_lock:
        if _tcp_port_is_open("127.0.0.1", local_port):
            return
        if _forge_tunnel_process is not None and _forge_tunnel_process.poll() is None:
            _forge_tunnel_process.terminate()
            _forge_tunnel_process.wait(timeout=5)

        command = [
            *_ssh_base_command()[:-1],
            "-o",
            "ExitOnForwardFailure=yes",
            "-o",
            "ServerAliveInterval=30",
            "-o",
            "ServerAliveCountMax=3",
            "-N",
            "-L",
            f"127.0.0.1:{local_port}:127.0.0.1:7860",
            _ssh_base_command()[-1],
        ]
        creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        try:
            _forge_tunnel_process = subprocess.Popen(
                command,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creation_flags,
            )
        except OSError as exc:
            raise CharacterGenerationError("학교 Forge 연결 터널을 시작하지 못했습니다.") from exc

        deadline = time.monotonic() + settings.character_gpu_ssh_connect_timeout_seconds
        while time.monotonic() < deadline:
            if _forge_tunnel_process.poll() is not None:
                raise CharacterGenerationError("학교 Forge 연결 터널이 즉시 종료됐습니다.")
            if _tcp_port_is_open("127.0.0.1", local_port):
                return
            time.sleep(0.2)
        _stop_managed_forge_tunnel()
        raise CharacterGenerationError("학교 Forge 연결 터널 준비 시간이 초과됐습니다.")


def _stop_managed_forge_tunnel() -> None:
    global _forge_tunnel_process
    with _forge_tunnel_lock:
        process = _forge_tunnel_process
        _forge_tunnel_process = None
        if process is None or process.poll() is not None:
            return
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def _tcp_port_is_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def _wait_for_forge() -> None:
    if settings.character_mock_generation:
        return
    deadline = time.monotonic() + settings.character_forge_startup_timeout_seconds
    base_url = settings.forge_api_url.rstrip("/")
    options_url = f"{base_url}/sdapi/v1/options"
    scripts_url = f"{base_url}/sdapi/v1/script-info"
    while time.monotonic() < deadline:
        try:
            options_response = requests.get(options_url, timeout=5)
            scripts_response = requests.get(scripts_url, timeout=5)
            scripts = scripts_response.json() if scripts_response.ok else []
            controlnet_ready = any(
                str(script.get("name", "")).lower() == "controlnet"
                and script.get("is_img2img") is True
                and bool(script.get("args"))
                for script in scripts
            )
            if options_response.ok and controlnet_ready:
                return
        except (requests.RequestException, ValueError):
            pass
        time.sleep(2)
    raise CharacterGenerationError("학교 GPU의 Forge 서버가 준비되지 않았습니다.")


def _generate_with_forge(input_png_base64: str, seed: int) -> bytes:
    payload = {
        "prompt": PROMPT,
        "negative_prompt": NEGATIVE_PROMPT,
        "init_images": [input_png_base64],
        "sampler_name": "DPM++ 2M Karras",
        "steps": settings.character_inference_steps,
        "cfg_scale": 7,
        "denoising_strength": 0.8,
        "width": settings.character_canvas_size,
        "height": settings.character_canvas_size,
        "seed": seed,
        "batch_size": 1,
        "n_iter": 1,
        "override_settings": {
            "sd_model_checkpoint": "pixelArtDiffusionXL_spriteShaper.safetensors",
            "sd_vae": "sdxl_vae.safetensors",
            "CLIP_stop_at_last_layers": 2,
        },
        "override_settings_restore_afterwards": True,
        "alwayson_scripts": {
            "ControlNet": {
                "args": [
                    {
                        "enabled": True,
                        "image": input_png_base64,
                        "module": "canny",
                        "model": "diffusers_xl_canny_mid [112a778d]",
                        "weight": 0.45,
                        "resize_mode": "Crop and Resize",
                        "processor_res": 512,
                        "threshold_a": 100,
                        "threshold_b": 200,
                        "guidance_start": 0,
                        "guidance_end": 0.5,
                        "pixel_perfect": False,
                        "control_mode": "Balanced",
                        "hr_option": "Both",
                    }
                ]
            }
        },
    }
    try:
        response = requests.post(
            f"{settings.forge_api_url.rstrip('/')}/sdapi/v1/img2img",
            json=payload,
            timeout=settings.character_generation_timeout_seconds,
        )
        response.raise_for_status()
        images = response.json().get("images") or []
    except (requests.RequestException, ValueError) as exc:
        raise CharacterGenerationError("Forge 이미지 생성 요청에 실패했습니다.") from exc

    if not images:
        raise CharacterGenerationError("Forge가 생성 이미지를 반환하지 않았습니다.")
    return _decode_base64_image(images[0])


def _log_timing(job_id: str, stage: str, started: float, **details: object) -> None:
    detail_text = " ".join(f"{name}={value}" for name, value in details.items())
    logger.info(
        "Character generation timing job_id=%s stage=%s elapsed_seconds=%.2f%s",
        job_id,
        stage,
        time.perf_counter() - started,
        f" {detail_text}" if detail_text else "",
    )


def _decode_base64_image(value: str) -> bytes:
    encoded = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    try:
        return base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as exc:
        raise CharacterGenerationError("Forge 이미지 응답을 해석하지 못했습니다.") from exc


def _mock_generated_image(image_bytes: bytes, index: int) -> bytes:
    # 개발 모드에서는 실제 Forge 대신 입력 사진을 반환해 앱의 작업/후보 흐름만 검증한다.
    del index
    return image_bytes


def _public_error_message(exc: Exception) -> str:
    if isinstance(exc, CharacterGenerationError):
        return str(exc)
    return "이미지 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."


character_generation_manager = CharacterGenerationManager()
