"""ASPCA 스냅샷 CSV → src_aspca_toxicity.

반려동물(개/고양이/말) 안전 여부의 소스. 네트워크를 타지 않고 커밋된 CSV 만 읽는다.
CSV 는 scripts.ingest.aspca_snapshot 으로 갱신한다.

실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.aspca
"""
import csv

from sqlalchemy import delete

from app.models import SpeciesMatchReview, SpeciesSourceLink, SrcAspcaToxicity

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
            seen_keys: set[str] = set()
            for row in rows:
                sci_name = (row.get("sci_name") or "").strip() or None
                # CSV 의 sci_name_norm 은 스냅샷 시점에 계산해 둔 파생값이라 신뢰하지 않는다.
                # 그 값을 쓰면 학명 별칭(scientific-name-aliases.csv)을 추가해도
                # 재적재에 반영되지 않는다. 항상 지금 규칙으로 다시 계산한다.
                norm = normalize_scientific_name(sci_name) or (
                    row.get("sci_name_norm") or ""
                ).strip() or None
                common = (row.get("common_name_en") or "").strip() or None
                # 학명이 없는 항목은 일반명을 키로 (스냅샷 생성 규칙과 동일)
                source_key = norm or (common.lower() if common else None)
                if not source_key:
                    continue
                seen_keys.add(source_key[:200])

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

            # ASPCA 는 전체 스냅샷이라 이번 CSV 에 없는 행은 더 이상 유효하지 않다.
            # 남겨두면 학명 별칭·스냅샷 갱신으로 source_key 가 바뀔 때마다 유령 행이 쌓이고,
            # 그 행에 걸린 species_source_link 가 과거 독성 정보를 붙여 둔 채로 남는다.
            stale = [key for key in upsert.existing if key not in seen_keys]
            if stale:
                for key in stale:
                    db.delete(upsert.existing[key])
                db.execute(
                    delete(SpeciesSourceLink).where(
                        SpeciesSourceLink.source_code == "ASPCA",
                        SpeciesSourceLink.source_key.in_(stale),
                    )
                )
                db.execute(
                    delete(SpeciesMatchReview).where(
                        SpeciesMatchReview.source_code == "ASPCA",
                        SpeciesMatchReview.source_key.in_(stale),
                    )
                )
                log(f"  스냅샷에서 사라진 {len(stale)}행 + 연결/검토항목 제거")

            db.commit()
            upsert.report()
            run.row_count = saved
            log(f"완료 — src_aspca_toxicity {saved}건")
    finally:
        db.close()


if __name__ == "__main__":
    main()