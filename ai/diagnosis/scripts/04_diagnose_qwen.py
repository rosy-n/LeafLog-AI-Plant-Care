"""Qwen(Ollama)으로 답변 생성 (5단계 포맷).

04_diagnose_claude.py와 검색 로직(03_search_similar.py)·SYSTEM_PROMPT·5단계 포맷을 그대로 공유하고,
생성 호출부만 Claude API -> 학교 PC Ollama(qwen3.5:9b)로 바꾼 버전이다.
persona-chat이 이미 쓰고 있는 모델(apps/api/app/persona_chat.py)을 그대로 재사용한다 —
Qwen2.5-VL-7B-Instruct를 별도로 올리면 학교 PC(DB+Ollama+SD/LoRA 동시 구동 중) 리소스 부담이 커진다.
"""
import argparse
import base64
import importlib.util
import os
from pathlib import Path

import requests
from dotenv import load_dotenv
from PIL import Image

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
QWEN_MODEL = "qwen3.5:9b"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/chat")
DEFAULT_TOP_K = 5
REQUEST_TIMEOUT_SECONDS = 180

SYSTEM_PROMPT = """너는 초보 식집사를 돕는 식물 병해충 상담 어시스턴트다.
너는 식물병리 전문가가 아니며, 사진만으로 병명을 확정할 수 없다.
반드시 아래 5단계 구조로만 답변한다. 각 번호를 그대로 제목으로 사용한다.

1. 현재 상태 요약
2. 가능성 높은 원인 2~3가지
3. 사용자가 확인해야 할 점
4. 지금 할 수 있는 조치
5. 주의할 점

금지 표현: "확정적으로 ○○병입니다", "반드시 ~해야 한다"는 단정적 진단/처방 톤은 절대 쓰지 않는다.
대신 "~일 가능성이 있습니다", "~로 보입니다" 같은 가능성 기반 표현을 사용한다.
아래 제공되는 '유사 사례'는 CLIP 임베딩으로 검색된 시각적으로 비슷한 과거 사례이며,
정답이 아니라 참고 자료임을 명심하고, 사용자 사진과 유사 사례가 다를 수 있음을 인지한다."""


def _load_search_module():
    """파일명이 숫자로 시작해 일반 import 구문을 쓸 수 없어 importlib로 03_search_similar.py를 로드한다."""
    spec = importlib.util.spec_from_file_location("search_similar", SCRIPTS_DIR / "03_search_similar.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def encode_image_base64(image_bytes: bytes) -> str:
    # Ollama /api/chat의 images 필드는 media_type 없이 순수 base64 문자열만 받는다
    # (Claude API처럼 image/png 등을 별도로 명시하지 않음).
    with Image.open(__import__("io").BytesIO(image_bytes)) as img:
        img.verify()  # 손상된 이미지를 여기서 미리 걸러낸다
    return base64.standard_b64encode(image_bytes).decode("utf-8")


def format_similar_cases(results: list[dict]) -> str:
    if not results:
        return "(유사 사례 없음)"
    lines = [
        f"{i}. plant_species={r['plant_species']}, symptom_group={r['symptom_group']}, "
        f"suspected_cause={r['suspected_cause']}, plant_part={r['plant_part']}, "
        f"similarity={r['score']:.3f}"
        for i, r in enumerate(results, start=1)
    ]
    return "\n".join(lines)


def generate_diagnosis(
    image_bytes: bytes,
    similar_cases: list[dict],
    plant_species: str | None = None,
    symptom_text: str | None = None,
) -> str:
    """유사 사례 검색 결과(텍스트)와 쿼리 이미지, 사용자가 직접 적은 증상 설명을 근거로 5단계 상담 답변을 생성한다."""
    image_b64 = encode_image_base64(image_bytes)
    species_line = f"식물종: {plant_species}\n" if plant_species else ""
    symptom_line = f"사용자가 직접 적은 증상 설명: {symptom_text}\n" if symptom_text else ""

    user_text = (
        f"{species_line}"
        f"{symptom_line}"
        "아래 사진 속 식물의 상태를 봐줘.\n\n"
        "CLIP 임베딩으로 검색한 시각적으로 유사한 과거 사례들:\n"
        f"{format_similar_cases(similar_cases)}\n\n"
        "위 유사 사례를 참고하되 맹신하지 말고, 사진과 사용자 설명을 직접 보고 5단계 형식으로 답변해줘."
    )

    payload = {
        "model": QWEN_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_text, "images": [image_b64]},
        ],
        "stream": False,
        "think": False,
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
    except requests.ConnectionError as exc:
        raise RuntimeError(
            f"Ollama 서버({OLLAMA_URL})에 연결할 수 없습니다. 터널/서버 실행 상태를 확인하세요."
        ) from exc
    except requests.Timeout as exc:
        raise RuntimeError("Ollama 응답 시간이 초과됐습니다.") from exc
    except requests.RequestException as exc:
        raise RuntimeError(f"Ollama API 요청에 실패했습니다: {exc}") from exc

    try:
        data = response.json()
        text = data["message"]["content"].strip()
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(f"Ollama 응답 형식이 예상과 다릅니다: {response.text[:500]}") from exc

    if not text:
        raise RuntimeError("모델이 빈 답변을 반환했습니다.")
    return text


if __name__ == "__main__":
    load_dotenv(DIAGNOSIS_DIR / ".env")

    parser = argparse.ArgumentParser(description="유사 사례 검색 + Qwen(Ollama) 진단 상담 생성")
    parser.add_argument("--image", type=Path, required=True, help="진단할 이미지 경로")
    parser.add_argument("--species", type=str, default=None, help="plant_species 필터")
    parser.add_argument("--symptom-text", type=str, default=None, help="사용자가 직접 적은 증상 설명")
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    parser.add_argument("--collection", type=str, default=os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis"))
    args = parser.parse_args()

    if not args.image.exists():
        raise FileNotFoundError(f"이미지를 찾을 수 없습니다: {args.image}")

    search = _load_search_module()
    clip_model, clip_processor, clip_device = search.load_clip()
    query_vector = search.embed_image(
        Image.open(args.image).convert("RGB"), clip_model, clip_processor, clip_device
    )

    qdrant = search.get_qdrant_client()
    similar_cases = search.search_similar(qdrant, args.collection, query_vector, top_k=args.top_k)

    diagnosis = generate_diagnosis(
        args.image.read_bytes(), similar_cases,
        plant_species=args.species, symptom_text=args.symptom_text,
    )

    print(diagnosis)
