"""병해충/증상 상담 Visual RAG: 이미지 임베딩 -> Qdrant 검색 -> Qwen(Ollama) 진단 생성.

ai/diagnosis/scripts/03_search_similar.py, 04_diagnose_qwen.py의 CLI 프로토타입 로직을
API 엔드포인트용으로 옮긴 것이다. 5단계 답변 포맷과 시스템 프롬프트는
ai/diagnosis/CLAUDE.md에 정의된 것과 동일하게 유지한다 (그쪽 문서가 포맷의 기준).

생성 모델은 persona_chat.py가 이미 쓰는 로컬 Ollama(qwen3.5:9b)를 그대로 재사용한다 —
Qwen2.5-VL을 별도로 올리면 학교 PC(DB+Ollama+SD/LoRA 동시 구동 중) 리소스 부담이 커진다.
"""

from __future__ import annotations

import base64
import io
import re
from dataclasses import dataclass
from datetime import date
from functools import lru_cache

import requests
import torch
from PIL import Image
from qdrant_client import QdrantClient
from transformers import CLIPModel, CLIPProcessor

from .config import settings
from .persona_chat import MODEL_NAME as OLLAMA_MODEL_NAME
from .persona_chat import (
    OLLAMA_URL,
    WateringSchedule,
    WeatherAirQuality,
    build_watering_schedule_status,
    build_weather_air_quality_context,
    format_korean_date,
)

CLIP_MODEL_NAME = "openai/clip-vit-large-patch14"
DEFAULT_TOP_K = 5
# 코사인 유사도(L2-정규화 CLIP 임베딩, Qdrant Distance.COSINE) 컷오프 — 이 아래 사례는
# 유사도가 낮아 근거로 부적합하다고 보고 프롬프트/응답에서 제외한다.
# 실측 점수 분포 데이터가 아직 없는 잠정값이라, ai/diagnosis/scripts/03_search_similar.py로
# 실제 쿼리 이미지들의 점수 분포를 확인한 뒤 조정할 것.
MIN_SIMILARITY_SCORE = 0.75
REQUEST_TIMEOUT_SECONDS = 180
MAX_GENERATION_ATTEMPTS = 2

# 세션에 쌓인 이전 대화(chat_message)를 여기까지만 잘라서 컨텍스트에 넣는다.
# persona_chat의 10(5턴)보다 보수적으로 잡은 이유: 이미지 토큰 + 5단계 형식의 긴 답변이
# 겹치면 OLLAMA_NUM_CTX=8192를 금방 채운다. 이전 턴의 이미지는 다시 첨부하지 않고
# 텍스트(content)만 이어붙인다 — chat_message 스키마에 이미지 참조 컬럼이 없다.
DIAGNOSIS_MAX_HISTORY_MESSAGES = 6

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
정답이 아니라 참고 자료임을 명심하고, 사용자 사진과 유사 사례가 다를 수 있음을 인지한다.

아래에 '등록된 식물 정보'나 '날씨 및 대기질 정보' 섹션이 주어지면 다음 규칙을 따른다.
- 등록된 식물 정보(광량/온도/습도/물주기 기준)는 사용자의 실제 관리 습관과 비교해서
  원인을 더 구체적으로 짚는 데에만 사용하고, 섹션이 없으면 언급하지 않는다.
- 날씨/대기질 정보는 증상과 관련 있어 보일 때만 짧게 참고하고, 관련 없으면 언급하지 않는다.
- 두 섹션 모두 제공된 값만 사용하고 세부 수치를 지어내지 않는다.

답변은 마크다운 문법으로 작성한다.
- 5단계 제목은 "## 1. 현재 상태 요약"처럼 ## 헤더로 쓴다.
- 병해충 이름, 핵심 원인, 중요한 조치는 **굵게** 표시한다.
- 방치하면 식물이 더 상하거나 즉시 조치가 필요한 시급한 경고는 ==하이라이트==로 감싼다.
  (**굵게**보다 강한 표시이니 남발하지 말고, 정말 시급한 경고에만 쓴다.)
- 나열되는 확인 사항이나 조치는 "- "로 시작하는 목록으로 정리한다.

언어 규칙: 반드시 한국어 문장으로만 답한다. "provided image", "may be caused by"처럼
영어 문장이나 구를 그대로 섞어 쓰지 않는다 — 모든 설명은 자연스러운 한국어 문장으로 쓴다.
예외적으로 병해충의 학명·영문 통용명처럼 한국어로 옮기기 어려운 고유명사만 "Spider Mite"처럼
단어 하나로 인용할 수 있다. 그 외 한자, 일본어, 그리스어, 러시아어 등 다른 외국어는 절대 쓰지 않는다."""

TEXT_ONLY_SYSTEM_PROMPT = """너는 초보 식집사를 돕는 식물 상담 어시스턴트다.
너는 식물병리 전문가가 아니며, 사진 없이 글만으로는 상태를 확정할 수 없다.
반드시 아래 5단계 구조로만 답변한다. 각 번호를 그대로 제목으로 사용한다.

1. 현재 상태 요약
2. 가능성 높은 원인 2~3가지
3. 사용자가 확인해야 할 점
4. 지금 할 수 있는 조치
5. 주의할 점

금지 표현: "확정적으로 ○○병입니다", "반드시 ~해야 한다"는 단정적 진단/처방 톤은 절대 쓰지 않는다.
대신 "~일 가능성이 있습니다", "~로 보입니다" 같은 가능성 기반 표현을 사용한다.
사진이 없어 사용자의 글만으로 판단하는 상황이니, 증상 설명이 모호하면 어떤 부분을
더 구체적으로 알려주면 좋을지, 또는 사진을 찍어 올리면 더 정확한 진단이 가능하다는 점을
자연스럽게 안내한다.

아래에 '등록된 식물 정보'나 '날씨 및 대기질 정보' 섹션이 주어지면 다음 규칙을 따른다.
- 등록된 식물 정보(광량/온도/습도/물주기 기준)는 사용자의 실제 관리 습관과 비교해서
  원인을 더 구체적으로 짚는 데에만 사용하고, 섹션이 없으면 언급하지 않는다.
- 날씨/대기질 정보는 증상과 관련 있어 보일 때만 짧게 참고하고, 관련 없으면 언급하지 않는다.
- 두 섹션 모두 제공된 값만 사용하고 세부 수치를 지어내지 않는다.

답변은 마크다운 문법으로 작성한다.
- 5단계 제목은 "## 1. 현재 상태 요약"처럼 ## 헤더로 쓴다.
- 병해충 이름, 핵심 원인, 중요한 조치는 **굵게** 표시한다.
- 방치하면 식물이 더 상하거나 즉시 조치가 필요한 시급한 경고는 ==하이라이트==로 감싼다.
  (**굵게**보다 강한 표시이니 남발하지 말고, 정말 시급한 경고에만 쓴다.)
- 나열되는 확인 사항이나 조치는 "- "로 시작하는 목록으로 정리한다.

언어 규칙: 반드시 한국어 문장으로만 답한다. "provided image", "may be caused by"처럼
영어 문장이나 구를 그대로 섞어 쓰지 않는다 — 모든 설명은 자연스러운 한국어 문장으로 쓴다.
예외적으로 병해충의 학명·영문 통용명처럼 한국어로 옮기기 어려운 고유명사만 "Spider Mite"처럼
단어 하나로 인용할 수 있다. 그 외 한자, 일본어, 그리스어, 러시아어 등 다른 외국어는 절대 쓰지 않는다."""

LANGUAGE_RETRY_MESSAGE = (
    "방금 답변에 외국어가 섞여 있다. 한국어 문장으로만 다시 답변해라. 병해충의 학명·영문 "
    "통용명처럼 한국어로 옮기기 어려운 고유명사 단어 하나 정도만 예외로 허용되고, "
    "\"provided image\"처럼 영어 문장이나 구를 섞어 쓰거나 한자·일본어·그리스어·러시아어 등"
    "을 쓰면 안 된다."
)

# 한국어/영어가 아닌 다른 문자 체계 검출 (그리스, 키릴, 히브리, 아랍, 태국, CJK 한자/가나).
# 영어는 병해충 학명 등에 필요해서 허용하고, 그 외 외국어만 걸러낸다.
FOREIGN_SCRIPT_PATTERN = re.compile(
    "["
    "一-鿿"  # CJK 통합 한자
    "぀-ヿ"  # 히라가나 + 가타카나
    "Ͱ-Ͽ"  # 그리스 문자
    "Ѐ-ӿ"  # 키릴 문자
    "֐-׿"  # 히브리 문자
    "؀-ۿ"  # 아랍 문자
    "฀-๿"  # 태국 문자
    "]"
)

# 소문자로 시작하는 영단어가 2개 이상 연속되면 "provided image 처럼" 번역이 새어나온
# 영어 문장 조각일 가능성이 높다. 학명·고유명사는 보통 "Spider Mite"처럼 대문자로
# 시작하므로 이 패턴에 걸리지 않는다 — 오탐을 줄이기 위해 소문자 연속만 잡는다.
STRAY_ENGLISH_PHRASE_PATTERN = re.compile(r"\b[a-z]+(?:\s+[a-z]+)+\b")

LIGHT_LEVEL_LABELS = {
    "LOW": "약한 빛(음지)",
    "MEDIUM": "보통 빛(반양지)",
    "HIGH": "강한 빛(양지)",
    "UNKNOWN": "정보 없음",
}


@dataclass(frozen=True)
class SimilarCase:
    score: float
    plant_species: str | None
    symptom_group: str | None
    suspected_cause: str | None
    plant_part: str | None
    # Qdrant 포인트 ID(02_build_index.py가 라벨 엑셀의 image_id를 그대로 씀) — 레퍼런스 이미지
    # 조회 키. file_name/source_url은 인덱싱 시점 payload 원본 값(둘 다 참고용, 비어있을 수 있음).
    image_id: int
    file_name: str | None
    source_url: str | None


@dataclass(frozen=True)
class SpeciesCareInfo:
    """plant_species 마스터 테이블에서 가져온 종 표준 관리 기준 (실측값이 아니라 참고용)."""

    common_name_ko: str
    light_level: str
    temp_min_c: float | None
    temp_max_c: float | None
    humidity_min_pct: float | None
    humidity_max_pct: float | None
    watering_interval_days: int | None


@lru_cache(maxsize=1)
def _clip() -> tuple[CLIPModel, CLIPProcessor, torch.device]:
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(device).eval()
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
    return model, processor, device


@lru_cache(maxsize=1)
def _qdrant() -> QdrantClient:
    return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)


@lru_cache(maxsize=1)
def reference_dataset_size() -> int:
    """RAG 코퍼스 전체 크기 — "전체 N장 중 몇 건 매칭"을 앱에 보여주기 위함.
    재인덱싱은 API 재시작을 동반하므로 프로세스 생애주기 동안 캐시해도 무방하다."""
    return _qdrant().count(collection_name=settings.qdrant_collection, exact=True).count


@torch.no_grad()
def _embed_image(image: Image.Image) -> list[float]:
    model, processor, device = _clip()
    inputs = processor(images=[image], return_tensors="pt").to(device)
    output = model.get_image_features(**inputs)
    # transformers>=5: get_image_features가 raw tensor 대신 BaseModelOutputWithPooling을 반환
    features = output.pooler_output if hasattr(output, "pooler_output") else output
    features = features / features.norm(p=2, dim=-1, keepdim=True)
    return features[0].cpu().tolist()


def search_similar_cases(
    image_bytes: bytes,
    top_k: int = DEFAULT_TOP_K,
    min_score: float = MIN_SIMILARITY_SCORE,
) -> list[SimilarCase]:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    vector = _embed_image(image)
    points = _qdrant().query_points(
        collection_name=settings.qdrant_collection,
        query=vector,
        limit=top_k,
        score_threshold=min_score,
    ).points
    return [
        SimilarCase(
            score=point.score,
            plant_species=(point.payload or {}).get("plant_species"),
            symptom_group=(point.payload or {}).get("symptom_group"),
            suspected_cause=(point.payload or {}).get("suspected_cause"),
            plant_part=(point.payload or {}).get("plant_part"),
            image_id=int(point.id),
            file_name=(point.payload or {}).get("file_name"),
            source_url=(point.payload or {}).get("source_url"),
        )
        for point in points
    ]


def _format_similar_cases(cases: list[SimilarCase]) -> str:
    if not cases:
        return "(유사 사례 없음)"
    lines = [
        f"{i}. plant_species={c.plant_species}, symptom_group={c.symptom_group}, "
        f"suspected_cause={c.suspected_cause}, plant_part={c.plant_part}, similarity={c.score:.3f}"
        for i, c in enumerate(cases, start=1)
    ]
    return "\n".join(lines)


def _format_range(min_value: float | None, max_value: float | None, unit: str) -> str:
    if min_value is None and max_value is None:
        return "정보 없음"
    if min_value is None:
        return f"~{max_value}{unit}"
    if max_value is None:
        return f"{min_value}{unit}~"
    return f"{min_value}~{max_value}{unit}"


def build_plant_care_context(
    species_care: SpeciesCareInfo | None,
    watering_schedule: WateringSchedule | None,
    *,
    plant_name: str | None,
    reference_date: date,
) -> str | None:
    """등록된 개체(plant_id)가 있을 때만 값이 온다 — 없으면 섹션 자체를 프롬프트에 넣지 않는다."""
    if species_care is None:
        return None

    watering_status = (
        build_watering_schedule_status(watering_schedule, reference_date=reference_date)
        if watering_schedule is not None
        else "등록된 물주기 일정 없음"
    )
    interval_line = (
        f"{species_care.watering_interval_days}일"
        if species_care.watering_interval_days is not None
        else "정보 없음"
    )

    lines = ["[등록된 식물 정보]"]
    if plant_name:
        lines.append(f"식물 이름: {plant_name}")
    lines.append(f"식물 종: {species_care.common_name_ko}")
    lines.append("이 종의 표준 관리 기준 (참고용, 실측값 아님):")
    lines.append(f"- 광량: {LIGHT_LEVEL_LABELS.get(species_care.light_level, '정보 없음')}")
    lines.append(f"- 적정 온도: {_format_range(species_care.temp_min_c, species_care.temp_max_c, '°C')}")
    lines.append(f"- 적정 습도: {_format_range(species_care.humidity_min_pct, species_care.humidity_max_pct, '%')}")
    lines.append(f"- 표준 물주기 간격: {interval_line}")
    lines.append(f"사용자가 등록한 실제 물주기 일정 상태 ({format_korean_date(reference_date)} 기준): {watering_status}")
    return "\n".join(lines)


def _detect_foreign_script(text: str) -> bool:
    return bool(FOREIGN_SCRIPT_PATTERN.search(text))


def _detect_language_violation(text: str) -> bool:
    return bool(FOREIGN_SCRIPT_PATTERN.search(text)) or bool(STRAY_ENGLISH_PHRASE_PATTERN.search(text))


def _strip_foreign_script(text: str) -> str:
    cleaned = FOREIGN_SCRIPT_PATTERN.sub("", text)
    return re.sub(r"[ \t]{2,}", " ", cleaned)


# Qwen 응답이 이미지 토큰 + 시스템 프롬프트(등록된 식물 정보·날씨 섹션 포함)만으로도
# 기본 4096 컨텍스트를 넘기는 경우가 있어 (실측: 4663 토큰에서 400 에러), 여유 있게 늘려둔다.
OLLAMA_NUM_CTX = 8192


def _call_ollama(messages: list[dict], *, options: dict | None = None) -> str:
    payload = {
        "model": OLLAMA_MODEL_NAME,
        "messages": messages,
        "stream": False,
        "think": False,
        "options": options or {"num_ctx": OLLAMA_NUM_CTX},
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
    except requests.ConnectionError as exc:
        raise RuntimeError("Ollama 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.") from exc
    except requests.Timeout as exc:
        raise RuntimeError("답변 생성 시간이 초과됐어요.") from exc
    except requests.RequestException as exc:
        raise RuntimeError(f"진단 생성에 실패했어요: {exc}") from exc

    try:
        text = response.json()["message"]["content"].strip()
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError("모델 응답 형식이 올바르지 않아요.") from exc

    if not text:
        raise RuntimeError("모델이 빈 답변을 반환했어요.")
    return text


def _call_ollama_with_language_retry(messages: list[dict]) -> str:
    text = _call_ollama(messages)

    if _detect_language_violation(text):
        messages = [
            *messages,
            {"role": "assistant", "content": text},
            {"role": "user", "content": LANGUAGE_RETRY_MESSAGE},
        ]
        text = _call_ollama(messages)
        # 그리스어/한자 등 외국 문자는 눈에 띄게 어색해서 최후 수단으로 제거하지만,
        # 영어 문장 조각은 지우면 문장이 더 부자연스러워질 수 있어 재시도 결과를 그대로 둔다.
        if _detect_foreign_script(text):
            text = _strip_foreign_script(text)

    return text


def generate_diagnosis(
    image_bytes: bytes,
    similar_cases: list[SimilarCase],
    *,
    plant_species: str | None = None,
    symptom_text: str | None = None,
    plant_care_context: str | None = None,
    weather_air_quality: WeatherAirQuality | None = None,
    conversation_history: list[dict] | None = None,
) -> str:
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    species_line = f"식물종: {plant_species}\n" if plant_species else ""
    symptom_line = f"사용자가 직접 적은 증상 설명: {symptom_text}\n" if symptom_text else ""

    user_text = (
        f"{species_line}"
        f"{symptom_line}"
        "아래 사진 속 식물의 상태를 봐줘.\n\n"
        "CLIP 임베딩으로 검색한 시각적으로 유사한 과거 사례들:\n"
        f"{_format_similar_cases(similar_cases)}\n\n"
        "위 유사 사례를 참고하되 맹신하지 말고, 사진과 사용자 설명을 직접 보고 5단계 형식으로 답변해줘."
    )

    system_sections = [SYSTEM_PROMPT]
    if plant_care_context:
        system_sections.append(plant_care_context)
    if weather_air_quality is not None:
        system_sections.append("[날씨 및 대기질 정보]\n" + build_weather_air_quality_context(weather_air_quality))
    system_prompt = "\n\n".join(system_sections)

    recent_history = (conversation_history or [])[-DIAGNOSIS_MAX_HISTORY_MESSAGES:]
    messages = [
        {"role": "system", "content": system_prompt},
        *recent_history,
        {"role": "user", "content": user_text, "images": [image_b64]},
    ]

    return _call_ollama_with_language_retry(messages)


def diagnose(
    image_bytes: bytes,
    *,
    plant_species: str | None = None,
    symptom_text: str | None = None,
    plant_care_context: str | None = None,
    weather_air_quality: WeatherAirQuality | None = None,
    conversation_history: list[dict] | None = None,
    top_k: int = DEFAULT_TOP_K,
    min_score: float = MIN_SIMILARITY_SCORE,
) -> tuple[str, list[SimilarCase]]:
    """검색(Qdrant)과 생성(Qwen)을 한 번에 묶은 엔드포인트용 진입점.

    similar_cases도 함께 돌려주는 이유: 호출부(main.py)가 이 값을 응답에 실어 보내면
    앱에서 "RAG 검색 결과" 토글로 Qwen이 참고한 근거를 그대로 보여줄 수 있기 때문.
    """
    similar_cases = search_similar_cases(image_bytes, top_k=top_k, min_score=min_score)
    diagnosis_text = generate_diagnosis(
        image_bytes,
        similar_cases,
        plant_species=plant_species,
        symptom_text=symptom_text,
        plant_care_context=plant_care_context,
        weather_air_quality=weather_air_quality,
        conversation_history=conversation_history,
    )
    return diagnosis_text, similar_cases


def generate_text_diagnosis(
    symptom_text: str,
    *,
    plant_species: str | None = None,
    plant_care_context: str | None = None,
    weather_air_quality: WeatherAirQuality | None = None,
    conversation_history: list[dict] | None = None,
) -> str:
    species_line = f"식물종: {plant_species}\n" if plant_species else ""

    user_text = (
        f"{species_line}"
        f"사용자가 적은 증상 설명: {symptom_text}\n\n"
        "사진 없이 위 설명만으로 식물 상태를 봐줘. 5단계 형식으로 답변해줘."
    )

    system_sections = [TEXT_ONLY_SYSTEM_PROMPT]
    if plant_care_context:
        system_sections.append(plant_care_context)
    if weather_air_quality is not None:
        system_sections.append("[날씨 및 대기질 정보]\n" + build_weather_air_quality_context(weather_air_quality))
    system_prompt = "\n\n".join(system_sections)

    recent_history = (conversation_history or [])[-DIAGNOSIS_MAX_HISTORY_MESSAGES:]
    messages = [
        {"role": "system", "content": system_prompt},
        *recent_history,
        {"role": "user", "content": user_text},
    ]

    return _call_ollama_with_language_retry(messages)


def diagnose_text_only(
    symptom_text: str,
    *,
    plant_species: str | None = None,
    plant_care_context: str | None = None,
    weather_air_quality: WeatherAirQuality | None = None,
    conversation_history: list[dict] | None = None,
) -> str:
    """이미지 없이 자연어 증상 설명만으로 상담하는 진입점 — CLIP/Qdrant 검색을 건너뛴다."""
    return generate_text_diagnosis(
        symptom_text,
        plant_species=plant_species,
        plant_care_context=plant_care_context,
        weather_air_quality=weather_air_quality,
        conversation_history=conversation_history,
    )


TITLE_SYSTEM_PROMPT = """다음은 식물 병해충 상담의 사용자 질문과 그에 대한 답변이다.
이 상담이 무엇에 대한 것인지 반드시 15자 이내의 아주 짧은 한국어 제목 한 줄로 요약해라.

규칙:
- 반드시 15자를 넘기지 않는다. 넘길 것 같으면 더 줄인다.
- 명사구 형태로 끝내고(예: "잎 끝 갈변 원인", "총채벌레 피해") 완전한 문장으로 쓰지 않는다.
- 따옴표, 마침표, 마크다운 기호(#, *, ==), 번호를 쓰지 않는다.
- 제목 한 줄만 출력하고 다른 설명은 절대 덧붙이지 않는다."""

# 답변 앞부분("1. 현재 상태 요약" 섹션)만으로도 제목을 뽑기엔 충분해 토큰을 아낀다.
TITLE_INPUT_MAX_CHARS = 600
# 모델이 규칙을 어기고 길게 쓸 때의 최후 안전장치 — 실제 표시 상한은 이 값.
TITLE_MAX_LENGTH = 15
# 짧고 일관된 제목이 목적이라 진단 생성보다 훨씬 보수적인 옵션을 쓴다.
TITLE_GENERATION_OPTIONS = {"num_ctx": OLLAMA_NUM_CTX, "num_predict": 32, "temperature": 0.3}


def _fallback_consultation_title(symptom_text: str | None) -> str:
    """Qwen 제목 생성이 실패했을 때만 쓰는 대체값 — 첫 질문을 그대로 잘라 쓴다."""
    source = symptom_text or "사진으로 상담"
    return " ".join(source.split())[:TITLE_MAX_LENGTH]


def generate_consultation_title(*, symptom_text: str | None, diagnosis_text: str) -> str:
    """세션의 첫 턴에서만 호출 — 상담 기록 목록 카드에 쓸 짧은 제목을 Qwen에게 요약시킨다.
    실패(Ollama 다운 등)해도 진단 응답 자체를 막으면 안 되므로 조용히 대체값으로 넘어간다."""
    parts = []
    if symptom_text:
        parts.append(f"사용자 질문: {symptom_text}")
    parts.append(f"상담 답변 일부: {diagnosis_text[:TITLE_INPUT_MAX_CHARS]}")
    messages = [
        {"role": "system", "content": TITLE_SYSTEM_PROMPT},
        {"role": "user", "content": "\n".join(parts)},
    ]

    try:
        raw_title = _call_ollama(messages, options=TITLE_GENERATION_OPTIONS)
    except RuntimeError:
        return _fallback_consultation_title(symptom_text)

    cleaned = raw_title.strip().strip('"').strip("'")
    first_line = cleaned.splitlines()[0].strip() if cleaned else ""
    return first_line[:TITLE_MAX_LENGTH] or _fallback_consultation_title(symptom_text)
