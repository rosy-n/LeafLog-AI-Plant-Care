"""애정도(호감도) — plant.affinity_score 에 쌓고, 단계는 코드가 나눈다.

돌봄 상호작용(물주기/영양제/분갈이)이 기록될 때마다 plant.affinity_score 에
점수를 더한다. 하트 수와 해금 단계는 저장하지 않고 이 숫자에서 계산한다 —
기준을 바꾸면 저장된 점수 그대로 새 기준이 적용된다.

점수 규칙과 하트 환산은 이 모듈이 단일 출처다. 앱은 값을 다시 정의하지 않고
API 응답(AffinityStatus)을 그대로 표시한다.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import CareRecord, Plant
from .schemas import AffinityStatus

KOREA_TIMEZONE = ZoneInfo("Asia/Seoul")

# 상호작용 1회당 애정도 — 손이 더 많이 가는 돌봄에 더 많은 점수.
# care_record.care_type 과 같은 값이어야 한다.
CARE_POINTS: dict[str, int] = {
    "WATERING": 10,
    "FERTILIZING": 20,
    "REPOTTING": 30,
}

# 캐릭터를 문질러 얻는 점수 — 하루 1회, 돌봄보다 훨씬 작게.
# 매일 문지르면 월 60점이 더 쌓여 만점(800점) 도달이 약 12개월 → 약 7개월로 빨라진다.
PETTING_POINTS = 2

# 단계(=꽉 찬 하트 수)별 누적 기준 점수. 단계가 올라갈수록 다음 단계까지의
# 간격이 넓어져서 뒤로 갈수록 오래 걸린다:
#
#   단계   누적 기준   이 단계에 필요한 점수   목표 기간   기준 돌봄으로 실제 도달
#   Lv1        25점            25점             2주            14일
#   Lv2        60점            35점             1개월          30일
#   Lv3       180점           120점             3개월          90일
#   Lv4       400점           220점             6개월         189일
#   Lv5       800점           400점             1년           365일
#
# 기준 돌봄 = 물주기 7일마다(앱 기본 주기) + 영양제 월 1회 + 분갈이 연 1회 → 월 약 61점.
# 기준보다 부지런하면 더 빨리, 자주 빠뜨리면 더 늦게 올라간다.
LEVEL_THRESHOLDS: tuple[int, ...] = (25, 60, 180, 400, 800)

MAX_HEARTS = len(LEVEL_THRESHOLDS)
MAX_SCORE = LEVEL_THRESHOLDS[-1]


# ---------------------------------------------------------------------------
# 점수 → 단계 (저장된 숫자를 나누기만 한다)
# ---------------------------------------------------------------------------

def level_for_score(score: int) -> int:
    """꽉 찬 하트 수(0~5). 꾸미기 아이템 해금 단계와 같은 값이다."""
    return sum(1 for threshold in LEVEL_THRESHOLDS if max(0, score) >= threshold)


def _level_band(score: int) -> tuple[int, int, int]:
    """(단계, 이 단계 시작 점수, 다음 단계 기준 점수). 만점이면 다음 기준은 시작 점수와 같다."""
    level = level_for_score(score)
    start = LEVEL_THRESHOLDS[level - 1] if level > 0 else 0
    nxt = LEVEL_THRESHOLDS[level] if level < MAX_HEARTS else start
    return level, start, nxt


def level_progress_pct(score: int) -> int:
    """현재 단계에서 다음 단계까지의 진행률(0~100). 만점이면 100.

    올림하지 않는다 — 다음 단계에 1점 모자란 상태가 100%로 보이면 안 된다.
    """
    capped = min(MAX_SCORE, max(0, score))
    level, start, nxt = _level_band(capped)
    if level >= MAX_HEARTS:
        return 100
    return int((capped - start) / (nxt - start) * 100)


def hearts_for_score(score: int) -> float:
    """0~5, 0.5 단위 — 하트 아이콘이 빈/반/가득 3종뿐이라 반 칸까지만 쪼갠다.

    단계 간격이 균일하지 않으므로 반 칸은 "고정 점수"가 아니라
    "현재 단계에서 다음 단계까지 절반 이상 왔음"을 뜻한다.
    """
    level = level_for_score(score)
    if level >= MAX_HEARTS:
        return float(MAX_HEARTS)
    return level + (0.5 if level_progress_pct(score) >= 50 else 0)


def status_for_score(score: int) -> AffinityStatus:
    capped = min(MAX_SCORE, max(0, score))
    level = level_for_score(capped)
    at_max = level >= MAX_HEARTS
    return AffinityStatus(
        score=capped,
        hearts=hearts_for_score(capped),
        level=level,
        max_score=MAX_SCORE,
        max_hearts=MAX_HEARTS,
        level_thresholds=list(LEVEL_THRESHOLDS),
        next_level_score=None if at_max else LEVEL_THRESHOLDS[level],
        level_progress_pct=level_progress_pct(capped),
    )


def status_for_plant(plant: Plant) -> AffinityStatus:
    return status_for_score(plant.affinity_score or 0)


# ---------------------------------------------------------------------------
# 점수 적립
# ---------------------------------------------------------------------------

def _korea_day(completed_at: datetime) -> date:
    """기록 시각을 한국 날짜로. care_record.completed_at 은 naive UTC로 저장된다."""
    aware = (
        completed_at.replace(tzinfo=timezone.utc)
        if completed_at.tzinfo is None
        else completed_at
    )
    return aware.astimezone(KOREA_TIMEZONE).date()


def today_in_korea() -> date:
    return datetime.now(timezone.utc).astimezone(KOREA_TIMEZONE).date()


def initial_score(care_types: Iterable[str]) -> int:
    """개체 등록 시 함께 남기는 최초 기록(마지막 물준 날/분갈이한 날)의 점수."""
    return min(MAX_SCORE, sum(CARE_POINTS.get(care_type, 0) for care_type in care_types))


def award_for_care(
    db: Session, plant: Plant, care_type: str, completed_at: datetime
) -> int:
    """plant.affinity_score 를 올리고 이번에 오른 점수를 돌려준다.

    같은 날 같은 종류의 상호작용은 한 번만 점수를 준다 — 물주기 버튼을 연달아
    눌러 점수를 올릴 수 없게. (기록 자체는 누른 만큼 그대로 남는다.)
    판정에서 이번 기록을 제외해야 하므로 새 care_record 를 db.add 하기 전에 호출한다.

    만점을 넘기지 않으며, 기록을 지워도 이미 얻은 점수는 되돌리지 않는다.
    """
    points = CARE_POINTS.get(care_type, 0)
    current = plant.affinity_score or 0
    if points == 0 or current >= MAX_SCORE:
        return 0

    day = _korea_day(completed_at)
    already_today = any(
        _korea_day(recorded_at) == day
        for recorded_at in db.scalars(
            select(CareRecord.completed_at).where(
                CareRecord.plant_id == plant.plant_id,
                CareRecord.care_type == care_type,
            )
        ).all()
    )
    if already_today:
        return 0

    awarded = min(points, MAX_SCORE - current)
    plant.affinity_score = current + awarded
    return awarded


def award_for_petting(plant: Plant) -> int:
    """캐릭터를 문질렀을 때의 애정도 — 하루에 한 번만(한국 날짜 기준) 준다.

    이미 오늘 받았거나 만점이면 0. 돌봄과 달리 기록(care_record)은 남기지 않고
    plant.last_petted_on 으로만 하루 1회를 판정한다.
    """
    today = today_in_korea()
    current = plant.affinity_score or 0
    if plant.last_petted_on == today or current >= MAX_SCORE:
        return 0

    awarded = min(PETTING_POINTS, MAX_SCORE - current)
    plant.affinity_score = current + awarded
    plant.last_petted_on = today
    return awarded