"""Claude API로 답변 생성 (5단계 포맷)."""
import argparse
import base64
import importlib.util
import os
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv
from PIL import Image

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
CLAUDE_MODEL = "claude-sonnet-5"
DEFAULT_TOP_K = 5

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


FORMAT_TO_MEDIA_TYPE = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
    "GIF": "image/gif",
}


def encode_image(path: Path) -> tuple[str, str]:
    # 파일 확장자는 실제 포맷과 다를 수 있어서(예: 웹에서 저장한 webp가 .jpg로 저장됨)
    # 확장자 대신 Pillow로 디코딩한 실제 포맷을 기준으로 media_type을 정한다.
    with Image.open(path) as img:
        image_format = img.format
    media_type = FORMAT_TO_MEDIA_TYPE.get(image_format)
    if media_type is None:
        raise ValueError(f"Claude API가 지원하지 않는 이미지 포맷입니다: {image_format} ({path})")
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    return media_type, data


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
    anthropic_client: Anthropic,
    image_path: Path,
    similar_cases: list[dict],
    plant_species: str | None = None,
) -> str:
    """유사 사례 검색 결과(텍스트)와 쿼리 이미지를 근거로 5단계 상담 답변을 생성한다."""
    media_type, image_b64 = encode_image(image_path)
    species_line = f"식물종: {plant_species}\n" if plant_species else ""

    user_text = (
        f"{species_line}"
        "아래 사진 속 식물의 상태를 봐줘.\n\n"
        "CLIP 임베딩으로 검색한 시각적으로 유사한 과거 사례들:\n"
        f"{format_similar_cases(similar_cases)}\n\n"
        "위 유사 사례를 참고하되 맹신하지 말고, 사진을 직접 보고 5단계 형식으로 답변해줘."
    )

    message = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_b64},
                    },
                    {"type": "text", "text": user_text},
                ],
            }
        ],
    )
    text = "".join(block.text for block in message.content if block.type == "text")
    if message.stop_reason == "max_tokens":
        text += "\n\n[경고] max_tokens 제한으로 답변이 중간에 잘렸습니다. max_tokens 값을 늘려주세요."
    return text


if __name__ == "__main__":
    load_dotenv(DIAGNOSIS_DIR / ".env")

    parser = argparse.ArgumentParser(description="유사 사례 검색 + Claude API 진단 상담 생성")
    parser.add_argument("--image", type=Path, required=True, help="진단할 이미지 경로")
    parser.add_argument("--species", type=str, default=None, help="plant_species 필터")
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    parser.add_argument("--collection", type=str, default=os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis"))
    args = parser.parse_args()

    if not args.image.exists():
        raise FileNotFoundError(f"이미지를 찾을 수 없습니다: {args.image}")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY가 .env에 설정되어 있지 않습니다.")

    search = _load_search_module()
    clip_model, clip_processor, clip_device = search.load_clip()
    query_vector = search.embed_image(
        Image.open(args.image).convert("RGB"), clip_model, clip_processor, clip_device
    )

    qdrant = search.get_qdrant_client()
    similar_cases = search.search_similar(
        qdrant, args.collection, query_vector, species=args.species, top_k=args.top_k
    )

    anthropic_client = Anthropic(api_key=api_key)
    diagnosis = generate_diagnosis(anthropic_client, args.image, similar_cases, plant_species=args.species)

    print(diagnosis)
