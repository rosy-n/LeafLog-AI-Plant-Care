from __future__ import annotations

import argparse
import importlib.util
import sys
from datetime import date, timedelta
from pathlib import Path
from types import ModuleType
from typing import Any

BASE_DIR = Path(__file__).resolve().parent

# 프롬프트 조립/말투 검증/Ollama 호출 로직은 apps/api/app/persona_chat.py로 옮겨서
# FastAPI 엔드포인트와 이 로컬 CLI가 같은 코드를 공유한다 (규칙이 두 곳에서 따로
# 관리되지 않게). apps/api를 별도 패키지로 설치하지 않고도 쓸 수 있도록 파일
# 경로 기준으로 직접 로드한다.
_PERSONA_CHAT_MODULE_PATH = (
    BASE_DIR.parent.parent / "apps" / "api" / "app" / "persona_chat.py"
)


def _load_persona_chat_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "leaflog_persona_chat", _PERSONA_CHAT_MODULE_PATH
    )
    if spec is None or spec.loader is None:
        raise ImportError(f"persona_chat 모듈을 찾을 수 없어: {_PERSONA_CHAT_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    # dataclass가 `from __future__ import annotations` 문자열 어노테이션을 풀려면
    # 자기 모듈을 sys.modules에서 찾을 수 있어야 한다 — exec 전에 등록해둔다.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


persona_chat = _load_persona_chat_module()


# 테스트용 기본 정보. 아직 백엔드 인증 흐름을 CLI에 붙이지 않았으므로 고정값을 쓴다.
# 실제 서비스에서는 FastAPI의 POST /api/plants/{plant_id}/persona-chat 엔드포인트가
# 로그인한 사용자/개체 기준으로 이 값들을 DB에서 조회한다 (apps/api/app/main.py 참고).
PLANT_CONTEXT = {
    "plant_name": "몽이",
    "species_name": "몬스테라",
    "user_name": "미나",
}

DEFAULT_TEST_WATERING_SCHEDULE = persona_chat.WateringSchedule(
    interval_days=7,
    next_due_date=persona_chat.today_in_korea() + timedelta(days=2),
)

DEFAULT_TEST_WEATHER_AIR_QUALITY = persona_chat.WeatherAirQuality(
    weather_status="맑음",
    air_quality_status="좋음",
)


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("날짜는 YYYY-MM-DD 형식으로 입력해야 해.") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="LeafLog 식물 페르소나 최근 대화 기억 테스트"
    )
    parser.add_argument("--persona", default="sunshine.txt")
    parser.add_argument(
        "--plant-name",
        default=PLANT_CONTEXT["plant_name"],
        help="실제 서비스에서는 plant.nickname으로 대체됨",
    )
    parser.add_argument(
        "--species-name",
        default=PLANT_CONTEXT["species_name"],
        help="실제 서비스에서는 plant_species.common_name_ko로 대체됨",
    )
    parser.add_argument(
        "--user-name",
        default=PLANT_CONTEXT["user_name"],
        help="실제 서비스에서는 app_user.nickname으로 대체됨",
    )
    parser.add_argument(
        "--watering-interval-days",
        type=int,
        default=DEFAULT_TEST_WATERING_SCHEDULE.interval_days,
    )
    parser.add_argument(
        "--next-watering-date",
        type=parse_iso_date,
        default=DEFAULT_TEST_WATERING_SCHEDULE.next_due_date,
    )
    parser.add_argument("--no-watering-schedule", action="store_true")
    parser.add_argument(
        "--weather-status",
        default=DEFAULT_TEST_WEATHER_AIR_QUALITY.weather_status,
        help="예: 맑음 / 구름많음 / 흐림 / 비 / 눈",
    )
    parser.add_argument(
        "--air-quality-status",
        default=DEFAULT_TEST_WEATHER_AIR_QUALITY.air_quality_status,
        help="예: 좋음 / 보통 / 나쁨 / 매우나쁨",
    )
    parser.add_argument("--no-weather-air-quality", action="store_true")
    return parser.parse_args()


def build_test_watering_schedule(args: argparse.Namespace) -> Any | None:
    if args.no_watering_schedule:
        return None
    if args.watering_interval_days <= 0:
        raise ValueError("물주기 주기는 1일 이상이어야 해.")
    return persona_chat.WateringSchedule(
        interval_days=args.watering_interval_days,
        next_due_date=args.next_watering_date,
    )


def build_test_weather_air_quality(args: argparse.Namespace) -> Any | None:
    # 실제 API 연동 전이므로, 지금은 명령행 인자로 받은 고정 상태값만 사용한다.
    if args.no_weather_air_quality:
        return None
    return persona_chat.WeatherAirQuality(
        weather_status=args.weather_status,
        air_quality_status=args.air_quality_status,
    )


def main() -> None:
    args = parse_args()
    reference_date = persona_chat.today_in_korea()
    plant_context = {
        "plant_name": args.plant_name,
        "species_name": args.species_name,
        "user_name": args.user_name,
    }

    try:
        persona_chat.read_text_file(persona_chat.COMMON_PROMPT_PATH)
        persona_chat.read_text_file(persona_chat.PERSONAS_DIR / args.persona)
        watering_schedule = build_test_watering_schedule(args)
        weather_air_quality = build_test_weather_air_quality(args)
    except (FileNotFoundError, ValueError) as exc:
        print(f"[설정 오류] {exc}", file=sys.stderr)
        sys.exit(1)

    conversation_history: list[dict[str, str]] = []
    persona_name = persona_chat.PERSONA_NAMES.get(args.persona, Path(args.persona).stem)

    print("LeafLog 페르소나 대화 테스트를 시작해.")
    print(f"모델: {persona_chat.MODEL_NAME}")
    print(f"페르소나: {persona_name} ({args.persona})")
    print(persona_chat.build_watering_context(watering_schedule, reference_date=reference_date))
    print(persona_chat.build_weather_air_quality_context(weather_air_quality))
    print("현재 대화창의 최근 5턴만 기억하고, 프로그램을 종료하면 기록은 사라져.")
    print("캐릭터 답변은 최대 2문장으로 제한돼.")
    print("명령어: /reset = 현재 대화 기억 초기화, /exit = 종료")
    print("-" * 60)

    while True:
        try:
            user_message = input(f"{plant_context['user_name']}: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n테스트를 종료할게.")
            break

        if not user_message:
            continue
        if user_message.lower() in {"/reset", "reset", "초기화"}:
            conversation_history.clear()
            print("현재 대화 기억을 초기화했어.")
            continue
        if user_message.lower() in {"/exit", "exit", "quit", "종료"}:
            print("테스트를 종료할게.")
            break

        try:
            answer = persona_chat.chat_with_ollama(
                persona_file_name=args.persona,
                watering_schedule=watering_schedule,
                weather_air_quality=weather_air_quality,
                conversation_history=conversation_history,
                user_message=user_message,
                reference_date=reference_date,
                plant_context=plant_context,
            )
        except RuntimeError as exc:
            print(f"[오류] {exc}")
            continue

        print(f"{plant_context['plant_name']}: {answer}")

        conversation_history.extend(
            [
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": answer},
            ]
        )
        conversation_history[:] = conversation_history[-persona_chat.MAX_HISTORY_MESSAGES:]


if __name__ == "__main__":
    main()
