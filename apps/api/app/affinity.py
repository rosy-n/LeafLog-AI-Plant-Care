"""애정도(호감도) — 돌봄 상호작용에서 계산한다.

점수를 따로 저장하지 않고 care_record(물주기/영양제/분갈이)를 집계한다.
기록이 곧 상호작용이라 별도 컬럼과 어긋날 일이 없고, 기능 도입 전에 쌓인
기록에도 소급 적용된다. (docs/database-schema.sql 의
plant_character.affinity_score 를 쓰게 되면 계산 결과를 그 컬럼에 캐시하면 된다.)

점수 규칙과 하트 환산은 이 모듈이 단일 출처다 — 앱은 값을 다시 정의하지 않고
API 응답(AffinityStatus)을 그대로 표시한다.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import CareRecord
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


def _korea_day(completed_at: datetime) -> date:
    """기록 시각을 한국 날짜로. care_record.completed_at 은 naive UTC로 저장된다."""
    aware = (
        completed_at.replace(tzinfo=timezone.utc)
        if completed_at.tzinfo is None
        else completed_at
    )
    return aware.astimezone(KOREA_TIMEZONE).date()


def scores_for_plants(db: Session, plant_ids: Sequence[int]) -> dict[int, int]:
    """개체별 애정도 점수.

    같은 날 같은 종류의 상호작용은 한 번만 점수를 준다 — 물주기 버튼을 연달아
    눌러서 점수를 올릴 수 없게. (기록 자체는 누른 만큼 그대로 남는다.)
    """
    if not plant_ids:
        return {}

    scored_days: dict[int, set[tuple[str, date]]] = {}
    for plant_id, care_type, completed_at in db.execute(
        select(CareRecord.plant_id, CareRecord.care_type, CareRecord.completed_at).where(
            CareRecord.plant_id.in_(plant_ids)
        )
    ).all():
        if care_type not in CARE_POINTS or completed_at is None:
            continue
        scored_days.setdefault(plant_id, set()).add((care_type, _korea_day(completed_at)))

    return {
        plant_id: min(
            MAX_SCORE,
            sum(CARE_POINTS[care_type] for care_type, _ in scored_days.get(plant_id, ())),
        )
        for plant_id in plant_ids
    }


def score_for_plant(db: Session, plant_id: int) -> int:
    return scores_for_plants(db, [plant_id])[plant_id]


def hearts_for_score(score: int) -> float:
    """0~5, 0.5 단위 — 하트 아이콘이 빈/반/가득 3종뿐이라 반 칸까지만 쪼갠다."""
    half_steps = min(MAX_HEARTS * 2, score // (POINTS_PER_HEART // 2))
    return half_steps / 2


def level_for_score(score: int) -> int:
    """꽉 찬 하트 수(0~5). 꾸미기 아이템 해금 단계와 같은 값이다."""
    return min(MAX_HEARTS, score // POINTS_PER_HEART)


def status_for_score(score: int) -> AffinityStatus:
    level = level_for_score(score)
    at_max = level >= MAX_HEARTS
    return AffinityStatus(
        score=score,
        hearts=hearts_for_score(score),
        level=level,
        max_score=MAX_SCORE,
        max_hearts=MAX_HEARTS,
        points_per_heart=POINTS_PER_HEART,
        next_level_score=None if at_max else (level + 1) * POINTS_PER_HEART,
        level_progress_pct=100 if at_max else round(
            (score - level * POINTS_PER_HEART) / POINTS_PER_HEART * 100
        ),
    )


def status_for_plant(db: Session, plant_id: int) -> AffinityStatus:
    return status_for_score(score_for_plant(db, plant_id))