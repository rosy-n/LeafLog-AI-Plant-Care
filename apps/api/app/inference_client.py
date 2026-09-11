"""Cloud callers use the private school gateway; standalone keeps local Ollama."""
import base64
import math

import requests

from .config import settings


class InferenceUnavailable(RuntimeError):
    pass


def post_json(url, payload, *, remote=False, timeout=180):
    try:
        response = requests.post(
            url, json=payload, timeout=(10, timeout), allow_redirects=False,
            headers={"X-LeafLog-AI-Token": settings.ai_worker_token} if remote else {},
        )
        if response.status_code in {409, 429, 503}:
            raise InferenceUnavailable("학교 AI가 다른 작업을 처리 중이에요. 잠시 후 다시 시도해주세요.")
        if response.status_code != 200:
            raise InferenceUnavailable("AI 서버 요청에 실패했어요. 잠시 후 다시 시도해주세요.")
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise InferenceUnavailable("AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.") from exc


def chat(payload, timeout=180):
    remote = settings.app_role == "api"
    url = f"{settings.ai_worker_url}/internal/ai/chat" if remote else settings.ollama_api_url
    data = post_json(url, payload, remote=remote,
                     timeout=timeout + settings.character_gpu_switch_timeout_seconds if remote else timeout)
    try:
        answer = data["message"]["content"].strip()
        if not answer:
            raise ValueError("Empty response")
        return answer
    except (KeyError, TypeError, AttributeError, ValueError) as exc:
        raise InferenceUnavailable("모델 응답 형식이 올바르지 않아요.") from exc


def embed(image_bytes):
    data = post_json(f"{settings.ai_worker_url}/internal/ai/embed", {
        "image_base64": base64.b64encode(image_bytes).decode("ascii"),
    }, remote=True)
    vector = data.get("vector")
    if (not isinstance(vector, list) or len(vector) != 768 or
        any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in vector)):
        raise InferenceUnavailable("이미지 분석 응답이 올바르지 않아요.")
    return vector
