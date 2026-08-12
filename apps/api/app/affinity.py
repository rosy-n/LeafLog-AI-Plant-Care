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

# 하트 1칸 = 60점, 반 칸 = 30점, 5칸이 만점.
# 물주기 주 1회 + 영양제 월 1회 정도의 실제 돌봄 주기로 5~6개월에 만점이 되는 속도.
POINTS_PER_HEART = 60
MAX_HEARTS = 5
MAX_SCORE = POINTS_PER_HEART * MAX_HEARTS


# ---------------------------------------------------------------------------
# 점수 → 단계 (저장된 숫자를 나누기만 한다)
# ---------------------------------------------------------------------------

def hearts_for_score(score: int) -> float:
    """0~5, 0.5 단위 — 하트 아이콘이 빈/반/가득 3종뿐이라 반 칸까지만 쪼갠다."""
    half_steps = min(MAX_HEARTS * 2, max(0, score) // (POINTS_PER_HEART // 2))
    return half_steps / 2


def level_for_score(score: int) -> int:
    """꽉 찬 하트 수(0~5). 꾸미기 아이템 해금 단계와 같은 값이다."""
    return min(MAX_HEARTS, max(0, score) // POINTS_PER_HEART)


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
        points_per_heart=POINTS_PER_HEART,
        next_level_score=None if at_max else (level + 1) * POINTS_PER_HEART,
        level_progress_pct=100 if at_max else round(
            (capped - level * POINTS_PER_HEART) / POINTS_PER_HEART * 100
        ),
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