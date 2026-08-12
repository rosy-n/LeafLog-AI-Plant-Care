"""애정도 컬럼(plant.affinity_score) 초기값 채우기 — 이미 쌓인 care_record 기준.

이 컬럼 도입 전에 남긴 물주기/영양제/분갈이 기록도 애정도로 인정한다.
점수표를 다시 적지 않도록 app/affinity.py 의 규칙(하루 같은 종류 1회, 만점 상한)을
그대로 사용한다. 여러 번 실행해도 같은 결과가 나온다(멱등).

실행: cd apps/api && ./.venv/Scripts/python.exe scripts/backfill-affinity.py
      (--dry-run 을 주면 계산만 하고 저장하지 않는다)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.affinity import CARE_POINTS, MAX_SCORE, _korea_day
from app.database import SessionLocal
from app.models import CareRecord, Plant

dry_run = "--dry-run" in sys.argv

db = SessionLocal()
try:
    # (개체, 종류, 한국날짜) 조합 하나당 한 번만 점수를 준다
    scored: dict[int, set[tuple[str, object]]] = {}
    for plant_id, care_type, completed_at in db.execute(
        select(CareRecord.plant_id, CareRecord.care_type, CareRecord.completed_at)
    ).all():
        if care_type not in CARE_POINTS or completed_at is None:
            continue
        scored.setdefault(plant_id, set()).add((care_type, _korea_day(completed_at)))

    for plant in db.scalars(select(Plant).order_by(Plant.plant_id)).all():
        computed = min(
            MAX_SCORE,
            sum(CARE_POINTS[care_type] for care_type, _ in scored.get(plant.plant_id, ())),
        )
        before = plant.affinity_score or 0
        # 이미 쌓인 점수가 더 크면(컬럼 도입 후 적립분) 내리지 않는다
        target = max(before, computed)
        mark = "" if target == before else f"  ->  {target}"
        print(f"  plant {plant.plant_id:>3} {plant.nickname:<10} 기록 계산 {computed:>3}점 / 현재 {before:>3}점{mark}")
        plant.affinity_score = target

    if dry_run:
        db.rollback()
        print("\n--dry-run: 저장하지 않았습니다.")
    else:
        db.commit()
        print("\n완료 — plant.affinity_score 갱신")
finally:
    db.close()