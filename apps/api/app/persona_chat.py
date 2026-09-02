"""식물 페르소나 대화 로직 (프롬프트 조립 + 말투 규칙 검증 + Ollama 호출).

원래 ai/persona-chat/test_persona.py의 CLI 도구 안에 있던 로직을 이곳으로 옮긴 것이다.
FastAPI 엔드포인트(main.py)와 로컬 테스트 CLI(ai/persona-chat/test_persona.py)가
이 모듈을 공유해서 프롬프트/검증 규칙이 두 곳에서 따로 관리되지 않게 한다.

프롬프트 원본(ai/persona-chat/prompts/)은 옮기지 않고 그 자리에 그대로 둔다 —
ai/persona-chat/CLAUDE.md의 절대 규칙과 파일 구조 설명이 그 경로를 가정하고 있다.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests

# apps/api/app/persona_chat.py -> apps/api/app -> apps/api -> apps -> 레포 루트
REPO_ROOT = Path(__file__).resolve().parents[3]
PROMPTS_DIR = REPO_ROOT / "ai" / "persona-chat" / "prompts"
COMMON_PROMPT_PATH = PROMPTS_DIR / "common.txt"
PERSONAS_DIR = PROMPTS_DIR / "personas"

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "qwen3.5:9b"

# 클라이언트가 보내는 대화 기록도 이 개수로 잘라서 사용한다 (사용자 5 + 캐릭터 5, 최근 5턴).
MAX_HISTORY_MESSAGES = 10

REQUEST_TIMEOUT_SECONDS = 180

# UI상 캐릭터 답변은 최대 2문장으로 제한한다.
MAX_RESPONSE_SENTENCES = 2
MAX_GENERATION_ATTEMPTS = 3

# 재시도 시에는 무작위성을 줄여서 규칙 위반(존댓말/한자/영어 등) 확률을 낮춘다.
RETRY_TEMPERATURE = 0.3

KOREA_TIMEZONE = ZoneInfo("Asia/Seoul")

GENERATION_OPTIONS: dict[str, Any] = {
    "temperature": 0.6,
    "top_p": 0.8,
    "top_k": 20,
    "presence_penalty": 0.1,
    "num_predict": 96,
}

PERSONA_NAMES = {
    "sunshine.txt": "햇살형",
    "chic.txt": "새침형",
    "relaxed.txt": "느긋형",
    "timid.txt": "소심형",
    "sage.txt": "현자형",
    "playful.txt": "장난꾸러기형",
    "diligent.txt": "성실형",
    "dreamer.txt": "몽상가형",
}

# DB(plant.persona)/API에 노출되는 값 — 프롬프트 파일 경로(persona_file_name)는 서버 내부에서만 쓰고
# 클라이언트/DB에는 이 slug만 오간다 (plant 테이블 ck_plant_persona 제약과 반드시 일치해야 함).
PERSONA_SLUG_TO_FILE = {
    "SUNSHINE": "sunshine.txt",
    "CHIC": "chic.txt",
    "RELAXED": "relaxed.txt",
    "TIMID": "timid.txt",
    "SAGE": "sage.txt",
    "PLAYFUL": "playful.txt",
    "DILIGENT": "diligent.txt",
    "DREAMER": "dreamer.txt",
}


def list_persona_options() -> list[dict[str, str]]:
    """모바일 선택 UI용 (slug, label) 목록. PERSONA_NAMES가 표시 이름의 단일 출처다."""
    return [
        {"slug": slug, "label": PERSONA_NAMES[file_name]}
        for slug, file_name in PERSONA_SLUG_TO_FILE.items()
    ]


def today_in_korea() -> date:
    return datetime.now(KOREA_TIMEZONE).date()


@dataclass(frozen=True)
class WateringSchedule:
    interval_days: int
    next_due_date: date


# 날씨/대기질은 아직 실제 API 연동 전이므로, 연동 이후 API 응답을 이 값으로
# 매핑해서 넣어줄 예정이다. 지금은 None으로 넘기면 "등록되지 않음"으로 처리된다.
@dataclass(frozen=True)
class WeatherAirQuality:
    weather_status: str  # 예: 맑음 / 구름많음 / 흐림 / 비 / 눈
    air_quality_status: str  # 예: 좋음 / 보통 / 나쁨 / 매우나쁨


def read_text_file(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"프롬프트 파일을 찾을 수 없어: {path}")

    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"프롬프트 파일이 비어 있어: {path}")
    return text


def replace_prompt_variables(prompt: str, values: dict[str, str]) -> str:
    result = prompt
    for key, value in values.items():
        result = result.replace(f"{{{key}}}", value)
    return result


def format_korean_date(value: date) -> str:
    return f"{value.year}년 {value.month}월 {value.day}일"


def build_watering_schedule_status(
    watering_schedule: WateringSchedule | None,
    *,
    reference_date: date,
) -> str:
    if watering_schedule is None:
        return "등록된 물주기 일정이 없음"

    days_until_due = (watering_schedule.next_due_date - reference_date).days
    if days_until_due > 0:
        return f"물주기 예정일까지 {days_until_due}일 남음"
    if days_until_due == 0:
        return "오늘이 물주기 예정일임"
    return f"물주기 예정일이 {abs(days_until_due)}일 지남"


def build_watering_context(
    watering_schedule: WateringSchedule | None,
    *,
    reference_date: date,
) -> str:
    if watering_schedule is None:
        return (
            f"기준 날짜: {format_korean_date(reference_date)}\n"
            "물주기 주기: 등록되지 않음\n"
            "다음 물주기 예정일: 등록되지 않음\n"
            "현재 일정 상태: 등록된 물주기 일정이 없음"
        )

    return (
        f"기준 날짜: {format_korean_date(reference_date)}\n"
        f"물주기 주기: {watering_schedule.interval_days}일\n"
        f"다음 물주기 예정일: {format_korean_date(watering_schedule.next_due_date)}\n"
        "현재 일정 상태: "
        f"{build_watering_schedule_status(watering_schedule, reference_date=reference_date)}"
    )


def build_weather_air_quality_context(
    weather_air_quality: WeatherAirQuality | None,
) -> str:
    if weather_air_quality is None:
        return "날씨 상태: 등록되지 않음\n대기질 상태: 등록되지 않음"

    return (
        f"날씨 상태: {weather_air_quality.weather_status}\n"
        f"대기질 상태: {weather_air_quality.air_quality_status}"
    )


def build_system_prompt(
    persona_file_name: str,
    watering_schedule: WateringSchedule | None,
    weather_air_quality: WeatherAirQuality | None,
    *,
    reference_date: date,
    plant_context: dict[str, str],
) -> str:
    common_prompt = read_text_file(COMMON_PROMPT_PATH)
    persona_prompt = read_text_file(PERSONAS_DIR / persona_file_name)
    persona_name = PERSONA_NAMES.get(persona_file_name, Path(persona_file_name).stem)

    combined_prompt = (
        f"{common_prompt}\n\n"
        "[선택된 페르소나 설정]\n"
        f"{persona_prompt}\n\n"
        "[캐릭터 기본 정보]\n"
        "식물 이름: {plant_name}\n"
        "식물 종: {species_name}\n"
        "페르소나: {persona_name}\n"
        "사용자 이름: {user_name}\n\n"
        "[물주기 일정 정보]\n"
        f"{build_watering_context(watering_schedule, reference_date=reference_date)}\n\n"
        "[물주기 답변 규칙]\n"
        "- 물주기 질문에는 위 일정 정보만 참고한다.\n"
        "- 예정일은 관리 계획일이며 현재 흙의 실제 수분 측정값이 아니다.\n"
        "- 예정일까지 남은 기간이나 지난 기간을 짧게 알려준다.\n"
        "- 물주기까지 남은 기간을 말할 때 \"내일\", \"모레\", \"글피\" 같은 상대 명칭 을 "
        "절대 쓰지 않는다. 반드시 위에 제공된 숫자 그대로 \"N일 남았어\"처럼 표현한다. "
        "상대 명칭으로 바꾸려고 스스로 계산하지 않는다.\n"
        "- 오늘이 예정일이거나 예정일이 지났다면 흙이 말랐는지 확인한 뒤 물을 주도록  안내한다.\n"
        "- 실제로 목마르다고 단정하거나 물을 주면 안 된다고 단정하지 않는다.\n"
        "- 물주기와 관계없는 대화에서는 물주기 일정을 먼저 꺼내지 않는다.\n\n"
        "[날씨 및 대기질 정보]\n"
        f"{build_weather_air_quality_context(weather_air_quality)}\n\n"
        "[날씨 및 대기질 답변 규칙]\n"
        "- 홈 화면에 이미 날씨/대기질이 아이콘으로 표시되므로, 사용자가 이를 직접 묻는 경우는 드물다.\n"
        "- 위 상태값은 주로 인사나 스몰토크, 캐릭터의 기분/하루 표현에서 배경 소재로  자연스럽게 녹여 쓴다.\n"
        "- 언급할 때는 제공된 상태값만 참고하고, 정확한 온도나 미세먼지 농도 같은 세부 수치는 지어내지 않는다.\n"
        "- 날씨나 대기질을 매 답변마다 언급하지 않는다. 대화 흐름에 자연스럽게 어울릴 때만 짧게 넣는다.\n"
        "- 사용자가 직접 날씨나 대기질을 물으면 제공된 상태값으로 짧게 답한다.\n"
        "- 정보가 등록되지 않은 경우, 모른다고 짧게만 답하고 지어내지 않는다."
    )

    return replace_prompt_variables(
        combined_prompt,
        {**plant_context, "persona_name": persona_name},
    )


def make_request_messages(
    system_prompt: str,
    conversation_history: list[dict[str, str]],
    user_message: str,
) -> list[dict[str, str]]:
    recent_history = conversation_history[-MAX_HISTORY_MESSAGES:]
    return [
        {"role": "system", "content": system_prompt},
        *recent_history,
        {"role": "user", "content": user_message},
    ]


def split_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text.strip())
    if not normalized:
        return []
    sentences = re.findall(r".+?(?:[.!?。！？]+|$)", normalized)
    return [sentence.strip() for sentence in sentences if sentence.strip()]


def strip_markdown_syntax(text: str) -> str:
    return MARKDOWN_SYNTAX_PATTERN.sub("", text)


def limit_to_max_sentences(text: str) -> str:
    sentences = split_sentences(text)
    if not sentences:
        return text.strip()
    return " ".join(sentences[:MAX_RESPONSE_SENTENCES]).strip()


# --- 말투 규칙(반말/한자/영어/이모지) 위반 감지 -----------------------------
#
# 프롬프트만으로는 Qwen이 가끔(특히 소심형처럼 조심스러운 어조를 요구하는
# 페르소나에서) 존댓말이나 한자를 섞어 쓰는 걸 완전히 막지 못한다.
# 이건 확률적으로 튀는 문제라서, 코드 레벨에서 한 번 더 검사하고
# 필요하면 재생성을 시도하는 안전장치를 둔다.

HONORIFIC_ENDING_PATTERN = re.compile(
    r"(습니다|합니다|입니다|십니다|"
    r"해요|이에요|예요|세요|어요|아요|"
    r"드려요|드릴게요|드릴까요|줄게요|줄까요|"
    r"네요|군요|더라구요|거예요)"
)

# 위 리스트는 어미를 문자열 그대로 나열한 것이라, "봐요"(보다+아요), "될까요"처럼
# 어간이 다른 활용형은 놓칠 수 있다. 한국어에서 문장이 "요"로 끝나는 경우는
# 거의 예외 없이 존댓말(해요체/합쇼체 계열)이므로, 문장부호 직전이나 문장 끝에
# "요"가 오면 어간에 상관없이 폴리트체로 간주하는 포괄 규칙을 추가한다.
POLITE_YO_ENDING_PATTERN = re.compile(r"[가-힣]요\s*(?=[.!?~]|$)")

# 위 두 패턴은 모두 "문장이 어떻게 끝나는지"만 본다. 그런데 "미나가 잘 돌봐주셔서
# 기분이 좋아"처럼 -시- 높임 선어말어미가 문장 중간에 끼어 있고 문장 자체는
# 반말로 끝나는 경우는 둘 다 놓친다. -시-는 주로 "주시다/하시다/가시다/오시다/
# 보시다/드시다/계시다/되시다" 같은 동사가 활용될 때 나타나므로, 이 조합의
# 흔한 활용형만 목록으로 잡아낸다 (완전한 문법 분석기는 아니라서 나열식이다).
HONORIFIC_INFIX_PATTERN = re.compile(
    r"(주셔|주셨|하셔|하셨|가셔|가셨|오셔|오셨|보셔|보셨|드셔|드셨|계셔|계셨|되셔|되셨)"
)

# 대사창은 마크다운 렌더러 없이 텍스트를 그대로 찍으므로, **강조**나 # 제목 같은
# 마크다운 기호가 그대로 노출되지 않도록 항상 제거한다 (prompt만으로는 100% 막지 못함).
MARKDOWN_SYNTAX_PATTERN = re.compile(r"(\*\*|__|[*_`#]|^\s*[-•]\s+)", re.MULTILINE)

HANJA_PATTERN = re.compile(r"[一-鿿]")

# 영문 2자 이상 연속 (단발성 대문자 이니셜 등은 허용하되, 단어 단위 영어는 잡아낸다)
ENGLISH_WORD_PATTERN = re.compile(r"[A-Za-z]{2,}")

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001FAFF"  # 각종 이모지
    "\U00002600-\U000027BF"  # 기타 기호/딩뱃
    "\U0001F1E6-\U0001F1FF"  # 국기
    "]"
)

# 사용자 이름/호칭 뒤 높임 호칭 금지 (예: "미나님", "미나 씨").
# "씨앗", "씨름"처럼 "씨"가 다른 단어의 일부인 경우는 걸러내기 위해,
# 뒤에 조사·공백·문장부호·문장끝이 오는 경우만 높임 호칭으로 판단한다.
_HONORIFIC_TITLE_PARTICLES = r"이|가|는|은|을|를|와|과|도|만|랑|의|에게|한테|께서|부터|까지"
HONORIFIC_TITLE_PATTERN = re.compile(
    rf"(?<=[가-힣\s])(님|씨)(?=$|[\s,.!?~]|{_HONORIFIC_TITLE_PARTICLES})"
)


def detect_speech_rule_violations(text: str) -> list[str]:
    """반말/한자/영어/이모지/높임호칭 규칙 위반 여부를 검사해 위반 항목 이름 목록을 반환한다."""
    violations: list[str] = []
    if (
        HONORIFIC_ENDING_PATTERN.search(text)
        or POLITE_YO_ENDING_PATTERN.search(text)
        or HONORIFIC_INFIX_PATTERN.search(text)
    ):
        violations.append("존댓말 어미")
    if HANJA_PATTERN.search(text):
        violations.append("한자")
    if ENGLISH_WORD_PATTERN.search(text):
        violations.append("영어")
    if EMOJI_PATTERN.search(text):
        violations.append("이모지")
    if HONORIFIC_TITLE_PATTERN.search(text):
        violations.append("높임 호칭(님/씨)")
    return violations


# 최종 시도에서도 규칙을 어기면, 최소한의 사후 보정으로 눈에 띄는 문제만 제거한다.
# 존댓말 어미를 완벽하게 반말로 바꾸는 건 언어학적으로 정교하게 하기 어려우므로,
# 여기서는 가장 흔한 어미 몇 개만 대략적으로 치환하는 "최후의 방어선"으로만 쓴다.
# 근본적인 해결책은 프롬프트 개선과 재생성이며, 이 치환은 임시방편임을 유의한다.
HONORIFIC_TO_CASUAL_ROUGH_MAP: list[tuple[re.Pattern[str], str]] = [
    # -시- 중간 높임 표현 (더 구체적인 패턴이므로 아래 종결어미 치환보다 먼저 처리)
    (re.compile(r"주셔서"), "줘서"),
    (re.compile(r"주셨"), "줬"),
    (re.compile(r"주셔"), "줘"),
    (re.compile(r"하셔서"), "해서"),
    (re.compile(r"하셨"), "했"),
    (re.compile(r"하셔"), "해"),
    (re.compile(r"가셔서"), "가서"),
    (re.compile(r"가셨"), "갔"),
    (re.compile(r"가셔"), "가"),
    (re.compile(r"오셔서"), "와서"),
    (re.compile(r"오셨"), "왔"),
    (re.compile(r"오셔"), "와"),
    (re.compile(r"보셔서"), "봐서"),
    (re.compile(r"보셨"), "봤"),
    (re.compile(r"보셔"), "봐"),
    (re.compile(r"드셔서"), "먹어서"),
    (re.compile(r"드셨"), "먹었"),
    (re.compile(r"드셔"), "먹어"),
    (re.compile(r"계셔서"), "있어서"),
    (re.compile(r"계셨"), "있었"),
    (re.compile(r"계셔"), "있어"),
    (re.compile(r"되셔서"), "돼서"),
    (re.compile(r"되셨"), "됐"),
    (re.compile(r"되셔"), "돼"),
    # 종결어미
    (re.compile(r"습니다"), "어"),
    (re.compile(r"합니다"), "해"),
    (re.compile(r"입니다"), "이야"),
    (re.compile(r"십니다"), "셔"),
    (re.compile(r"해요"), "해"),
    (re.compile(r"이에요"), "이야"),
    (re.compile(r"예요"), "이야"),
    (re.compile(r"드릴게요"), "줄게"),
    (re.compile(r"드릴까요"), "줄까"),
    (re.compile(r"드려요"), "줘"),
    (re.compile(r"줄게요"), "줄게"),
    (re.compile(r"줄까요"), "줄까"),
    (re.compile(r"세요"), "해"),
    (re.compile(r"어요"), "어"),
    (re.compile(r"아요"), "아"),
    (re.compile(r"네요"), "네"),
    (re.compile(r"군요"), "군"),
    (re.compile(r"거예요"), "거야"),
]


# 한자를 지우고 나면 "？！……？"처럼 문장부호만 남거나, 영어 단어를 지우고 나면
# "가 나를 보고 웃으면..."처럼 조사만 덩그러니 남는 경우가 있다.
# 이런 깨진 결과를 그대로 사용자에게 보여주면 안 되므로, 최소한의 한글이
# 남지 않거나 문장이 조사로 시작해버리면 안전 문구로 완전히 대체한다.
MIN_KOREAN_CHARS_AFTER_SANITIZE = 4
FALLBACK_SAFE_REPLY = "음... 지금은 뭐라고 해야 할지 잘 모르겠어. 다시 한번 말해줄래?"

# 조사는 문장 맨 앞에 단독으로 올 수 없다. 한자나 영어를 지우고 남은 자리에
# 조사만 뎅그러니 남으면(예: "가 나를 보고...") 문장이 깨졌다는 신호로 본다.
DANGLING_PARTICLE_START_PATTERN = re.compile(
    r"^(가|는|을|를|이|의|와|과|도|만|에게|한테|께서|랑)(?=\s|[,.!?~]|$)"
)


def sanitize_speech_rule_violations(text: str) -> str:
    """최종 방어선: 존댓말 어미를 대략 반말로 치환하고, 한자/영어/이모지/높임호칭을 제거한다."""
    had_hanja = bool(HANJA_PATTERN.search(text))
    had_english = bool(ENGLISH_WORD_PATTERN.search(text))

    sanitized = text
    for pattern, replacement in HONORIFIC_TO_CASUAL_ROUGH_MAP:
        sanitized = pattern.sub(replacement, sanitized)

    # 위 목록에 없는 "-아/어 계열 + 요" 활용형(봐요, 될까요 등)은 어간이 제각각이라
    # 일일이 나열할 수 없다. 이 계열은 마지막 "요"만 떼어내면 자연스러운 반말이 되므로
    # (예: "봐요" -> "봐", "될까요" -> "될까") 남아있는 것들을 일괄 처리한다.
    sanitized = POLITE_YO_ENDING_PATTERN.sub(lambda m: m.group(0)[:-1], sanitized)

    sanitized = HANJA_PATTERN.sub("", sanitized)
    sanitized = ENGLISH_WORD_PATTERN.sub("", sanitized)
    sanitized = EMOJI_PATTERN.sub("", sanitized)
    sanitized = HONORIFIC_TITLE_PATTERN.sub("", sanitized)
    sanitized = re.sub(r"\s{2,}", " ", sanitized).strip()

    # 짧은 문장은 원래도 한글 글자 수가 적을 수 있으므로(예: "그럴까?"), 길이만으로
    # 판단하면 정상적인 짧은 답변까지 안전 문구로 덮어써버린다. 문장이 심하게
    # 깨지는 건 한자나 영어 비중이 컸던 경우이므로, 원문에 그런 내용이
    # 있었을 때만 "지우고 나니 내용이 거의 안 남았는지 / 문장이 깨졌는지"를 검사한다.
    if had_hanja or had_english:
        korean_char_count = len(re.findall(r"[가-힣]", sanitized))
        looks_broken = (
            korean_char_count < MIN_KOREAN_CHARS_AFTER_SANITIZE
            or bool(DANGLING_PARTICLE_START_PATTERN.match(sanitized))
        )
        if looks_broken:
            return FALLBACK_SAFE_REPLY

    return sanitized


def build_retry_reinforcement(
    *,
    sentence_violated: bool,
    speech_violations: list[str],
) -> str:
    lines = ["\n\n[이번 응답 재강조]"]
    if sentence_violated:
        lines.append("방금 답변은 너무 길었다. 반드시 자연스러운 한 문장 또는 두 문장 만 출력한다.")
    if "존댓말 어미" in speech_violations:
        lines.append(
            "방금 답변에 존댓말이 섞였다. 반드시 자연스러운 반말만 사용하고, "
            "\"습니다/해요/세요/이에요/예요\" 같은 존댓말 어미를 쓰지 않는다."
        )
    if "한자" in speech_violations:
        lines.append("방금 답변에 한자가 섞였다. 한자를 절대 출력하지 않는다.")
    if "영어" in speech_violations:
        lines.append("방금 답변에 영어가 섞였다. 영어나 로마자를 절대 출력하지 않는다.")
    if "이모지" in speech_violations:
        lines.append("방금 답변에 이모지가 섞였다. 이모지나 이모티콘을 절대 출력하지  않는다.")
    if "높임 호칭(님/씨)" in speech_violations:
        lines.append("방금 답변에 높임 호칭이 섞였다. 사용자 이름 뒤에 \"님\", \"씨\" 를 붙이지 않는다.")
    return "\n".join(lines)


def request_ollama(
    messages: list[dict[str, str]],
    *,
    generation_options: dict[str, Any] | None = None,
) -> str:
    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "stream": False,
        "think": False,
        "options": generation_options or GENERATION_OPTIONS,
    }

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.ConnectionError as exc:
        raise RuntimeError(
            "Ollama 서버에 연결할 수 없어. 먼저 'ollama serve'가 실행 중인지 확인해줘."
        ) from exc
    except requests.Timeout as exc:
        raise RuntimeError("Ollama 응답 시간이 초과됐어.") from exc
    except requests.RequestException as exc:
        raise RuntimeError(f"Ollama API 요청에 실패했어: {exc}") from exc

    try:
        data = response.json()
        answer = data["message"]["content"].strip()
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(
            f"Ollama 응답 형식이 예상과 달라: {response.text[:500]}"
        ) from exc

    if not answer:
        raise RuntimeError("모델이 빈 답변을 반환했어.")
    return answer


def chat_with_ollama(
    persona_file_name: str,
    watering_schedule: WateringSchedule | None,
    weather_air_quality: WeatherAirQuality | None,
    conversation_history: list[dict[str, str]],
    user_message: str,
    *,
    reference_date: date,
    plant_context: dict[str, str],
) -> str:
    system_prompt = build_system_prompt(
        persona_file_name=persona_file_name,
        watering_schedule=watering_schedule,
        weather_air_quality=weather_air_quality,
        reference_date=reference_date,
        plant_context=plant_context,
    )

    answer = ""
    sentence_violated = False
    speech_violations: list[str] = []

    for attempt in range(MAX_GENERATION_ATTEMPTS):
        retry_rule = ""
        if attempt > 0:
            retry_rule = build_retry_reinforcement(
                sentence_violated=sentence_violated,
                speech_violations=speech_violations,
            )

        answer = request_ollama(
            make_request_messages(
                system_prompt=system_prompt + retry_rule,
                conversation_history=conversation_history,
                user_message=user_message,
            ),
            generation_options=(
                {**GENERATION_OPTIONS, "temperature": RETRY_TEMPERATURE}
                if attempt > 0
                else None
            ),
        )
        answer = strip_markdown_syntax(answer)

        sentence_violated = len(split_sentences(answer)) > MAX_RESPONSE_SENTENCES
        speech_violations = detect_speech_rule_violations(answer)

        if not sentence_violated and not speech_violations:
            return answer

    # MAX_GENERATION_ATTEMPTS번을 다 써도 규칙을 못 지키면, 최후의 방어선으로
    # 문장 수 제한과 말투 규칙 위반 항목을 코드에서 직접 정리한다.
    final_answer = answer
    if speech_violations:
        print(
            f"[경고] {MAX_GENERATION_ATTEMPTS}번 재생성해도 말투 규칙 위반이 남아 "
            f"코드에서 보정함: {', '.join(speech_violations)}",
            file=sys.stderr,
        )
        final_answer = sanitize_speech_rule_violations(final_answer)
    if len(split_sentences(final_answer)) > MAX_RESPONSE_SENTENCES:
        final_answer = limit_to_max_sentences(final_answer)
    return final_answer
