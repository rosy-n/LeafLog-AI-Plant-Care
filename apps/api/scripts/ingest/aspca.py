"""ASPCA 스냅샷 CSV → src_aspca_toxicity.

반려동물(개/고양이/말) 안전 여부의 소스. 네트워크를 타지 않고 커밋된 CSV 만 읽는다.
CSV 는 scripts.ingest.aspca_snapshot 으로 갱신한다.

실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.aspca
"""
import csv

from app.models import SrcAspcaToxicity

from ._common import DATA_DIR, Upserter, ingest_run, log, normalize_scientific_name, session

INPUT_CSV = DATA_DIR / "aspca-toxic-plants.csv"


def _tri_bool(raw: str | None) -> bool | None:
    """'true'/'false'/'' → True/False/None (None = 해당 동물 자료 없음)."""
    value = (raw or "").strip().lower()
    if value in ("true", "1", "y", "yes"):
        return True
    if value in ("false", "0", "n", "no"):
        return False
    return None


def main() -> None:
    if not INPUT_CSV.exists():
        raise SystemExit(
            f"스냅샷 CSV 가 없습니다: {INPUT_CSV}\n"
            "먼저 python -m scripts.ingest.aspca_snapshot 을 1회 실행하세요."
        )

    with INPUT_CSV.open("r", encoding="utf-8", newline="") as fp:
        rows = list(csv.DictReader(fp))
    log(f"  {INPUT_CSV.name} {len(rows)}행")

    db = session()
    try:
        with ingest_run(db, "ASPCA") as run:
            upsert = Upserter(db, SrcAspcaToxicity)
            saved = 0
            for row in rows:
                sci_name = (row.get("sci_name") or "").strip() or None
                norm = (row.get("sci_name_norm") or "").strip() or normalize_scientific_name(
                    sci_name
                )
                common = (row.get("common_name_en") or "").strip() or None
                # 학명이 없는 항목은 일반명을 키로 (스냅샷 생성 규칙과 동일)
                source_key = norm or (common.lower() if common else None)
                if not source_key:
                    continue

                upsert(
                    source_key[:200],
                    {
                        "common_name_en": common,
                        "sci_name": sci_name,
                        "sci_name_norm": norm,
                        "toxic_to_dogs": _tri_bool(row.get("toxic_to_dogs")),
                        "toxic_to_cats": _tri_bool(row.get("toxic_to_cats")),
                        "toxic_to_horses": _tri_bool(row.get("toxic_to_horses")),
                        "clinical_signs": (row.get("clinical_signs") or "").strip() or None,
                        "payload": row,
                        "ingest_run_id": run.run_id,
                    },
                )
                saved += 1

            db.commit()
            upsert.report()
            run.row_count = saved
            log(f"완료 — src_aspca_toxicity {saved}건")
    finally:
        db.close()


if __name__ == "__main__":
    main()