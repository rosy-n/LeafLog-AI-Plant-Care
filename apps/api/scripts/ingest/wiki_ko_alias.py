"""위키 한글 이름 → plant_species_alias 사전 적재.

등록 화면 검색이 마스터 국명만으로는 못 받아내는 한글 입력을 미리 채워 둔다.
  · 국명 자리가 영문명인 행    'parlour palm'  → '테이블야자'
  · 위키/유통명이 다른 종      '부채파초'      → '여인초', '여행자나무'
값은 app/wiki_names.py 가 Wikidata(한국어 라벨·별칭)와 ko.wikipedia(표제어·넘겨주기)에서
가져온다. 사진(plant_species_image)과 같은 결로 배치 병합(merge.py) 대상이 아니고
data_source/ingest_run 에도 기록하지 않는다 — 마스터 필드를 건드리지 않는 보조 표라서다.

기본 대상은 '등록될 가능성이 있는 종'으로 좁힌다 (--all 로 전체 지정 가능).
  · 돌봄 정보가 있는 종 (RDA_INDOOR 유래, watering_interval_days IS NOT NULL)
  · 국명 자리에 한글이 없는 종
전체 17,665종을 돌리면 SPARQL 호출이 350여 회라 오래 걸리는데, 위키의 한국어 분류군
문서는 관엽식물 위주로만 있어 야생종 쪽 수확이 거의 없다.

실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.wiki_ko_alias [--all]
재실행 안전 — 이미 있는 별칭은 건너뛴다.
"""
import sys

from sqlalchemy import delete, select

from app.models import PlantSpecies, PlantSpeciesAlias
from app.wiki_names import alias_norm, fetch_ko_aliases, has_hangul, probe_name

from ._common import log, session


def _targets(db, everything: bool) -> list[PlantSpecies]:
    query = select(PlantSpecies).where(PlantSpecies.scientific_name_norm.is_not(None))
    rows = list(db.scalars(query).all())
    if everything:
        return rows
    return [
        row
        for row in rows
        if row.watering_interval_days is not None or not has_hangul(row.common_name_ko)
    ]


def main() -> None:
    everything = "--all" in sys.argv

    db = session()
    try:
        targets = _targets(db, everything)
        log(f"대상 종 {len(targets)}건 (--all={'예' if everything else '아니오'})")

        # 학명 하나에 여러 품종 행이 걸린다 — 위키에는 종 단위로 한 번만 묻는다
        by_probe: dict[str, list[PlantSpecies]] = {}
        for row in targets:
            probe = probe_name(row.scientific_name_norm)
            if probe:
                by_probe.setdefault(probe, []).append(row)
        log(f"위키에 물어볼 학명 {len(by_probe)}건")

        aliases = fetch_ko_aliases(list(by_probe))
        log(f"한국어 이름을 찾은 학명 {len(aliases)}건")

        # 이미 있는 별칭 (재실행 시 중복 방지)
        existing = {
            (species_id, norm)
            for species_id, norm in db.execute(
                select(PlantSpeciesAlias.species_id, PlantSpeciesAlias.alias_norm)
            )
        }

        added = 0
        for probe, names in aliases.items():
            for row in by_probe.get(probe, []):
                for alias, source in names:
                    norm = alias_norm(alias)
                    # 마스터 국명과 같은 말이면 별칭으로 둘 이유가 없다
                    if not norm or norm == alias_norm(row.common_name_ko):
                        continue
                    if (row.species_id, norm) in existing:
                        continue
                    db.add(
                        PlantSpeciesAlias(
                            species_id=row.species_id,
                            alias=alias[:150],
                            alias_norm=norm[:150],
                            source=source,
                        )
                    )
                    existing.add((row.species_id, norm))
                    added += 1

        # 음성 캐시(위키에도 없던 검색어)는 여기서 비운다 —
        # 마스터/별칭이 늘어난 뒤에는 다시 물어볼 값어치가 있다
        cleared = db.execute(
            delete(PlantSpeciesAlias).where(PlantSpeciesAlias.species_id.is_(None))
        ).rowcount
        db.commit()
        log(f"별칭 {added}건 추가, 음성 캐시 {cleared}건 삭제")
    finally:
        db.close()


if __name__ == "__main__":
    main()
