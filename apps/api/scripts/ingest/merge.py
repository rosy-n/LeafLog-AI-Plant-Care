"""src_* → plant_species 병합. 앱이 읽는 정본 한 행을 만든다.

매칭 키는 정규화 학명(scientific_name_norm). 학명이 없는 행은 국명 완전일치로 붙이고,
그것도 안 되면 species_match_review 에 넣어 사람이 확인하게 남긴다.

필드 충돌 우선순위 (docs/database-schema.sql 2-3 주석과 동일):
    분류·이름·자생지·원산지·분포 → NATURE_KNA > KFS_STD > RDA_INDOOR
    크기·개화기·결실기           → KFS_STD > RDA_INDOOR
    광원·물주기·온습도·난이도    → RDA_INDOOR
    독성                         → ASPCA > RDA_INDOOR
구현은 "낮은 우선순위부터 적용하고, 값이 있을 때만 덮어쓴다"로 같은 결과를 만든다.

실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.merge
"""
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.models import (
    PlantSpecies,
    SpeciesMatchReview,
    SpeciesSourceLink,
    SrcAspcaToxicity,
    SrcKfsSpecies,
    SrcNatureTaxon,
    SrcRdaIndoor,
)

from . import nongsaro_codes as codes
from ._common import log, normalize_scientific_name, session, species_level_norm
from .kfs_file import parse_height_cm
from .rda_indoor import reverse_lookup_all

# 낮은 우선순위 → 높은 우선순위 순서. 뒤에 오는 소스가 앞의 값을 덮어쓴다.
APPLY_ORDER = ["RDA_INDOOR", "KFS_STD", "ASPCA", "NATURE_KNA"]

# 새 종 행을 만들 수 있는 소스.
# ASPCA 는 영문 일반명만 있어 새로 만들면 한국어 마스터가 영문 종으로 오염된다.
# 이미 있는 종의 독성 정보만 보강하고, 못 붙은 항목은 species_match_review 로 넘긴다.
CAN_CREATE_SPECIES = {"RDA_INDOOR", "KFS_STD", "NATURE_KNA"}

# 종 단위 자료라서 같은 종의 품종 행에도 전부 물려줘야 하는 소스.
# ASPCA 는 'Dracaena sanderiana' 하나로만 독성을 알려주는데, 우리 마스터에는
# 개운죽·금천죽·세레스 드라세나가 각각 행으로 있다. 반려동물 안전 정보라 빠뜨리면 안 된다.
FAN_OUT_TO_CULTIVARS = {"ASPCA"}


# ---------------------------------------------------------------------------
# 소스별 → plant_species 필드 변환
# ---------------------------------------------------------------------------

def from_rda(row: SrcRdaIndoor) -> dict:
    payload = row.payload or {}
    values: dict = {
        "common_name_ko": row.ko_name,
        "common_name_en": (payload.get("plntzrNm") or "").split(",")[0].strip() or None,
        "scientific_name": row.sci_name,
        "family_name": payload.get("fmlCodeNm") or None,
        "origin_country": payload.get("orgplceInfo") or None,
        "category": payload.get("clCodeNm") or None,
        "description": payload.get("fncltyInfo") or None,
        "bug_info": payload.get("dlthtsCodeNm") or None,
        "image_url": payload.get("_rtnThumbFileUrl") or None,
    }

    # 관리 팁 — 여러 자유 텍스트 필드를 합쳐 보관
    tips = [
        payload.get(key)
        for key in ("adviseInfo", "speclmanageInfo", "frtlzrInfo", "soilInfo")
        if (payload.get(key) or "").strip()
    ]
    values["care_tips"] = "\n".join(tips) or None

    # 난이도
    if row.manage_level_code:
        values["difficulty"] = codes.code_map("MANAGE_LEVEL_CODE").get(row.manage_level_code)

    # 광원 — 코드가 여러 개일 수 있다. 레벨은 가장 낮은 요구 광량 기준,
    # Lux 는 여러 코드의 합집합 범위로 넓힌다.
    light_codes = [c for c in (row.light_code or "").split(",") if c]
    if light_codes:
        values["light_level"] = codes.code_map("LIGHT_LEVEL_MAP").get(light_codes[0])
        ranges = [
            lux
            for lux in (codes.code_map("LIGHT_LUX_RANGE").get(c) for c in light_codes)
            if lux
        ]
        if ranges:
            values["light_min_lux"] = min(lux["min"] for lux in ranges)
            values["light_max_lux"] = max(lux["max"] for lux in ranges)

    # 생육 적정 온도
    if row.growth_temp_code:
        temp = codes.code_map("GROWTH_TEMP_CODE").get(row.growth_temp_code)
        if temp:
            values["temp_min_c"] = temp["min"]
            values["temp_max_c"] = temp["max"]

    # 겨울 최저온도 — 057001(0℃ 이하)은 정확한 값 불명이라 JSON 에서 null
    if row.winter_temp_code:
        winter = codes.code_map("WINTER_LOW_TEMP_CODE").get(row.winter_temp_code)
        if winter is not None:
            values["temp_min_winter_c"] = winter

    # 습도
    if row.humidity_code:
        humidity = codes.code_map("HUMIDITY_CODE").get(row.humidity_code)
        if humidity:
            values["humidity_min_pct"] = humidity["min"]
            values["humidity_max_pct"] = humidity["max"]

    # 물주기 — 봄 기준 대표 일수
    if row.water_cycle_code:
        days = codes.code_map("WATER_CYCLE_INTERVAL_DAYS").get(row.water_cycle_code)
        if days:
            values["watering_interval_days"] = days

    # 개화기 — KFS_STD 가 없을 때만 쓰이는 하위 우선순위 값 (계절 단위)
    if payload.get("ignSeasonCodeNm"):
        values["flowering_period"] = payload["ignSeasonCodeNm"]

    # 꽃색 라벨 → 코드 목록
    found = reverse_lookup_all("FLOWER_COLOR_CODE", payload.get("flclrCodeNm"))
    if found:
        values["flower_color_codes"] = found

    # 독성 — 자유 텍스트만 제공. 동물별 구분은 ASPCA 가 채운다.
    if (row.toxic_desc or "").strip():
        values["toxicity_info"] = row.toxic_desc

    # 크기 — growthHgInfo(cm) 는 KFS_STD 가 없을 때만 쓰이는 하위 우선순위 값
    height = (payload.get("growthHgInfo") or "").strip()
    if height.replace(".", "", 1).isdigit():
        values["size_raw"] = f"높이 {height}cm"
        values["height_min_cm"] = int(float(height))
        values["height_max_cm"] = int(float(height))

    return values


def from_kfs(row: SrcKfsSpecies) -> dict:
    low, high = parse_height_cm(row.size_raw)
    return {
        "common_name_ko": row.ko_name,
        "scientific_name": row.sci_name,
        "family_name": row.family_name,
        "size_raw": row.size_raw,
        "height_min_cm": low,
        "height_max_cm": high,
        "flowering_period": row.flowering_period,
        "fruiting_period": row.fruiting_period,
    }


def from_aspca(row: SrcAspcaToxicity) -> dict:
    # 독성 필드만 반영한다. ASPCA 자료는 종 단위라 품종 행에도 그대로 물려주는데,
    # 이름/학명까지 덮어쓰면 품종 행의 정체성이 기본종 이름으로 뭉개진다.
    return {
        "toxic_to_dogs": row.toxic_to_dogs,
        "toxic_to_cats": row.toxic_to_cats,
        "toxic_to_horses": row.toxic_to_horses,
        "toxicity_info": row.clinical_signs,
    }


def from_nature(row: SrcNatureTaxon) -> dict:
    return {
        "common_name_ko": row.ko_name,
        "common_name_en": row.en_name,
        "scientific_name": row.sci_name,
        "family_name": row.family_name,
        "genus_name": row.genus_name,
        "origin": row.native_habitat,
        "origin_country": row.origin_country,
        "distribution": row.distribution,
    }


SOURCES = {
    "RDA_INDOOR": (SrcRdaIndoor, from_rda),
    "KFS_STD": (SrcKfsSpecies, from_kfs),
    "ASPCA": (SrcAspcaToxicity, from_aspca),
    "NATURE_KNA": (SrcNatureTaxon, from_nature),
}


# ---------------------------------------------------------------------------
# 매칭 / 적용
# ---------------------------------------------------------------------------

def backfill_norms(db) -> int:
    """기존 plant_species(사용자 등록 유래 포함)의 scientific_name_norm 을 채운다.

    이걸 먼저 하지 않으면 마스터 병합이 같은 종을 새 행으로 또 만든다.
    같은 norm 이 이미 있으면(유니크 위반) 건드리지 않고 넘어간다.
    """
    filled = 0
    rows = db.scalars(
        select(PlantSpecies).where(
            PlantSpecies.scientific_name_norm.is_(None),
            PlantSpecies.scientific_name.is_not(None),
        )
    ).all()
    for row in rows:
        norm = normalize_scientific_name(row.scientific_name)
        if not norm:
            continue
        exists = db.scalar(
            select(PlantSpecies.species_id).where(PlantSpecies.scientific_name_norm == norm)
        )
        if exists:
            continue
        row.scientific_name_norm = norm
        try:
            db.flush()
            filled += 1
        except IntegrityError:
            db.rollback()
    db.commit()
    return filled


def find_species_level_matches(db, norm: str | None) -> list[PlantSpecies]:
    """종 단위 키로 기본종 + 그 품종 행을 모두 찾는다 (ASPCA 독성 전파용).

    'dracaena sanderiana' → 기본종 1행 + "dracaena sanderiana 'celes'" 등 품종 행 전부
    """
    base = species_level_norm(norm)
    if not base:
        return []
    return list(
        db.scalars(
            select(PlantSpecies).where(
                or_(
                    PlantSpecies.scientific_name_norm == base,
                    PlantSpecies.scientific_name_norm.like(f"{base} %"),
                    PlantSpecies.scientific_name_norm.like(f"{base} '%"),
                )
            )
        ).all()
    )


def find_or_create(db, norm: str | None, ko_name: str | None, values: dict, can_create: bool):
    """(species, match_method) 반환. 매칭도 생성도 못 하면 (None, None)."""
    if norm:
        species = db.scalar(select(PlantSpecies).where(PlantSpecies.scientific_name_norm == norm))
        if species:
            return species, "SCI_NAME"

    if ko_name:
        species = db.scalar(
            select(PlantSpecies).where(PlantSpecies.common_name_ko == ko_name)
        )
        if species:
            # 학명을 처음 알게 된 경우 매칭 키를 채워 준다
            if norm and not species.scientific_name_norm:
                species.scientific_name_norm = norm
            return species, "KO_NAME"

    if not can_create:
        return None, None

    # 국명이 있어야 새 행을 만들 수 있다 (common_name_ko 는 NOT NULL)
    new_name = (
        ko_name
        or values.get("common_name_ko")
        or values.get("common_name_en")
        or values.get("scientific_name")
    )
    if not new_name:
        return None, None

    species = PlantSpecies(common_name_ko=new_name, scientific_name_norm=norm)
    db.add(species)
    db.flush()
    return species, ("SCI_NAME" if norm else "KO_NAME")


def apply_values(species: PlantSpecies, values: dict) -> None:
    """값이 있을 때만 덮어쓴다. None 은 '이 소스가 모르는 필드'라는 뜻."""
    for field, value in values.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        setattr(species, field, value)


def link(db, species_id: int, source_code: str, source_key: str, method: str) -> None:
    existing = db.scalar(
        select(SpeciesSourceLink).where(
            SpeciesSourceLink.source_code == source_code,
            SpeciesSourceLink.source_key == source_key,
            SpeciesSourceLink.species_id == species_id,
        )
    )
    if existing:
        existing.match_method = method
        return
    db.add(
        SpeciesSourceLink(
            species_id=species_id,
            source_code=source_code,
            source_key=source_key,
            match_method=method,
            confidence=1.0 if method == "SCI_NAME" else 0.7,
        )
    )


def queue_review(db, source_code: str, source_key: str, raw_name: str | None) -> None:
    existing = db.scalar(
        select(SpeciesMatchReview).where(
            SpeciesMatchReview.source_code == source_code,
            SpeciesMatchReview.source_key == source_key,
        )
    )
    if existing:
        return
    db.add(
        SpeciesMatchReview(
            source_code=source_code,
            source_key=source_key,
            raw_name=raw_name,
            candidates=None,
        )
    )


def derive_is_toxic(species: PlantSpecies) -> None:
    flags = [species.toxic_to_dogs, species.toxic_to_cats, species.toxic_to_horses]
    if any(flag is True for flag in flags):
        species.is_toxic = True
    elif any(flag is False for flag in flags):
        # 세 동물 모두 '독성 없음'으로 확인된 경우
        species.is_toxic = False
    else:
        species.is_toxic = bool((species.toxicity_info or "").strip())


def main() -> None:
    # ingest_run 은 source_code CHECK 때문에 4개 소스만 기록할 수 있어 병합은 이력을 남기지 않는다.
    # 병합은 멱등이라 실패하면 그냥 다시 돌리면 된다.
    db = session()
    try:
        filled = backfill_norms(db)
        log(f"기존 종 학명 정규화 backfill: {filled}건")

        touched: set[int] = set()
        total_linked = 0

        for source_code in APPLY_ORDER:
            model, transform = SOURCES[source_code]
            rows = db.scalars(select(model)).all()
            if not rows:
                log(f"{source_code}: 원본 0건 — skip")
                continue

            can_create = source_code in CAN_CREATE_SPECIES
            fan_out = source_code in FAN_OUT_TO_CULTIVARS
            linked = 0
            reviewed = 0
            for index, row in enumerate(rows, start=1):
                values = transform(row)

                if fan_out:
                    # 종 단위 자료 → 기본종과 그 품종 행 전부에 반영
                    matches = find_species_level_matches(db, row.sci_name_norm)
                    method = "SCI_NAME"
                else:
                    # ASPCA 원본에는 국명 컬럼이 없다 (영문 일반명만)
                    species, method = find_or_create(
                        db, row.sci_name_norm, getattr(row, "ko_name", None), values, can_create
                    )
                    matches = [species] if species is not None else []

                if not matches:
                    queue_review(db, source_code, row.source_key, row.sci_name or None)
                    reviewed += 1
                    continue

                for species in matches:
                    apply_values(species, values)
                    link(db, species.species_id, source_code, row.source_key, method)
                    touched.add(species.species_id)
                linked += 1

                if index % 1000 == 0:
                    db.commit()
                    log(f"  {source_code} {index}/{len(rows)}")

            db.commit()
            total_linked += linked
            log(f"{source_code}: {linked}건 반영, 검토 대기 {reviewed}건")

        # is_toxic 파생값 계산 — 동물별 플래그와 독성 텍스트를 종합
        if touched:
            for species in db.scalars(
                select(PlantSpecies).where(PlantSpecies.species_id.in_(touched))
            ).all():
                derive_is_toxic(species)
            db.commit()

        log(f"병합 완료 — plant_species {len(touched)}건 갱신 (연결 {total_linked}건)")
    finally:
        db.close()


if __name__ == "__main__":
    main()