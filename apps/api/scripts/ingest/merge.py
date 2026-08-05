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
     특정 소스만: python -m scripts.ingest.merge ASPCA
       원격 PG 에서는 소스 하나 병합에도 수 분이 걸려서, 한 소스만 다시 적재했을 때
       전체를 다시 돌리지 않도록 범위를 좁힌다. 단 두 가지 제약이 있다.
         - 요청한 소스보다 우선순위가 높은(APPLY_ORDER 에서 뒤에 오는) 소스는 자동으로
           함께 처리된다. 안 그러면 낮은 우선순위 소스가 상위 값을 덮어쓴다.
           그래서 맨 뒤인 ASPCA 만 지정할 때가 가장 싸고, RDA_INDOOR 지정은 전체와 같다.
         - 종을 만드는 소스(RDA_INDOOR/KFS_STD/NATURE_KNA)를 건너뛰면 그 소스가 만들
           종에는 값이 붙지 않는다. 새 소스를 처음 넣을 때는 인자 없이 전체를 돌려야 한다.
"""
import re
import sys
from collections import defaultdict

from sqlalchemy import select

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
#
# ASPCA 가 맨 뒤인 이유는 우선순위(독성: ASPCA > RDA_INDOOR) 때문만이 아니다.
# ASPCA 는 종을 만들지 않고 이미 있는 종에만 붙으므로, 종을 만드는 세 소스가
# 모두 끝난 뒤에 돌아야 붙을 수 있는 종을 다 붙인다. 앞에 두면 1회차에 대부분 놓친다.
# (ASPCA 는 독성 필드만 쓰고 NATURE_KNA 는 독성을 안 써서 순서를 바꿔도 우선순위는 그대로다)
APPLY_ORDER = ["RDA_INDOOR", "KFS_STD", "NATURE_KNA", "ASPCA"]

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

_BLANK_RUN = re.compile(r"\n{2,}")


def tidy_text(raw: str | None) -> str | None:
    """농사로 자유 텍스트 정리 — 줄 끝 공백 제거, 빈 줄 연속 축약.

    원문에 개행이 수십 줄 붙어 오는 필드가 있어(speclmanageInfo) 그대로 두면 화면이 비어 보인다.
    """
    if not raw:
        return None
    lines = [line.rstrip() for line in str(raw).splitlines()]
    return _BLANK_RUN.sub("\n", "\n".join(lines)).strip() or None


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
        # 목록 API 의 rtnThumbFileUrl 은 여러 URL 을 '|' 로 이어 내려준다. 대표 1장만 쓴다.
        "image_url": (payload.get("_rtnThumbFileUrl") or "").split("|")[0].strip() or None,
    }

    # 관리 팁 — 여러 자유 텍스트 필드를 합친 사람이 읽는 요약
    tips = [
        payload.get(key)
        for key in ("adviseInfo", "speclmanageInfo", "frtlzrInfo", "soilInfo")
        if (payload.get(key) or "").strip()
    ]
    values["care_tips"] = "\n".join(tips) or None

    # 화면이 항목별로 나눠 보여줄 수 있게 원문을 metadata 에 따로 보관.
    # (돌보기 정보 화면의 비료주기 / 토양&분갈이 카드가 care_tips 한 덩어리로는 채워지지 않는다)
    extra = {
        "cntntsNo": row.source_key,
        # 물주기 대표 일수는 팀이 정한 추정값이라, 원문 라벨을 함께 보여줄 수 있게 보관
        "water_cycle_label": codes.code_map("WATER_CYCLE_CODE").get(row.water_cycle_code or ""),
        # 광량도 LOW/MEDIUM/HIGH 보다 원문 라벨이 구체적이다
        "light_label": tidy_text(payload.get("lighttdemanddoCodeNm")),
        "fertilizer_info": tidy_text(payload.get("frtlzrInfo")),
        "soil_info": tidy_text(payload.get("soilInfo")),
        "special_manage_info": tidy_text(payload.get("speclmanageInfo")),
        "use_info": tidy_text(payload.get("adviseInfo")),
        "placement": tidy_text(payload.get("postngplaceCodeNm")),
        "propagation": tidy_text(payload.get("prpgtmthCodeNm")),
        "growth_rate": tidy_text(payload.get("grwtveCodeNm")),
        "growth_style": tidy_text(payload.get("grwhstleCodeNm")),
        "flower_color_names": tidy_text(payload.get("flclrCodeNm")),
        "leaf_style": tidy_text(payload.get("lefStleInfo")),
    }
    values["extra_metadata"] = {k: v for k, v in extra.items() if v}

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
# 매칭 인덱스
#
# 소스 행마다 SELECT 를 날리면 원격 PG 에서 행당 왕복이 3~4회 발생해
# 2만 행 병합이 몇 시간짜리가 된다. 그래서 시작할 때 plant_species / 링크 /
# 검토큐를 한 번씩 통째로 읽어 메모리 인덱스로 만들고, 이후 조회는 전부 메모리에서 한다.
# 쓰기는 소스 단위로 flush/commit 하여 INSERT·UPDATE 가 배치로 나가게 한다.
# ---------------------------------------------------------------------------

class SpeciesIndex:
    def __init__(self, db):
        self.db = db
        self.by_norm: dict[str, PlantSpecies] = {}
        self.by_ko: dict[str, PlantSpecies] = {}
        # 종 단위 키 → 기본종 + 품종 행들 (ASPCA 독성 전파용)
        self.by_base: dict[str, list[PlantSpecies]] = defaultdict(list)
        # 속명 → 그 속의 모든 종. ASPCA 는 'Spathiphyllum', 'Begonia spp.' 처럼
        # 속 단위로만 독성을 주는 항목이 많아, 종 단위 인덱스로는 대부분 놓친다.
        self.by_genus: dict[str, list[PlantSpecies]] = defaultdict(list)
        self.created = 0

        self.existing: list[PlantSpecies] = list(db.scalars(select(PlantSpecies)).all())
        # 1차 — 식별 키(scientific_name_norm) 기준 등록. 항상 이쪽이 우선이다.
        for species in self.existing:
            self._register(species)
        # 2차 — 현재 scientific_name 에서 파생한 키도 추가 등록.
        #
        # scientific_name_norm 은 행이 처음 만들어질 때 정해지는 식별 키라,
        # 이후 상위 소스가 scientific_name 을 교정해도 갱신되지 않는다.
        # 그래서 협죽도처럼 학명이 'Nerium oleander L.' 로 교정됐는데도
        # norm 은 'nerium indicum' 으로 남아 ASPCA 와 매칭되지 않는 종이 2,488개 있었다.
        # (독성 강한 식물의 안전 정보가 빠지는 문제)
        #
        # 식별 키를 다시 쓰는 건 UNIQUE 충돌·기존 링크 파손 위험이 있어 하지 않고,
        # 대신 한 종을 여러 이름 키로 찾을 수 있게만 만든다.
        self.alias_keys = 0
        for species in self.existing:
            alt = normalize_scientific_name(species.scientific_name)
            if alt and alt != species.scientific_name_norm:
                self._register_alias(species, alt)

        self.by_id: dict[int, PlantSpecies] = {
            s.species_id: s for s in self.existing if s.species_id is not None
        }

        self.link_keys: set[tuple[str, str, int]] = set(
            db.execute(
                select(
                    SpeciesSourceLink.source_code,
                    SpeciesSourceLink.source_key,
                    SpeciesSourceLink.species_id,
                )
            ).all()
        )
        # 이전 적재에서 이 소스 행이 어느 종에 붙었는지 — 재적재의 1순위 기준.
        # 이름이 나중에 상위 소스 값으로 바뀌어도 같은 종에 다시 붙게 해준다.
        self.prior: dict[tuple[str, str], list[PlantSpecies]] = defaultdict(list)
        for source_code, source_key, species_id in self.link_keys:
            species = self.by_id.get(species_id)
            if species is not None:
                self.prior[(source_code, source_key)].append(species)
        # 검토 큐는 행째로 들고 있는다 — 나중에 매칭에 성공하면 지워야 하기 때문
        self.review_rows: dict[tuple[str, str], SpeciesMatchReview] = {
            (row.source_code, row.source_key): row
            for row in db.scalars(select(SpeciesMatchReview)).all()
        }
        self.resolved_reviews = 0

    def _index_keys(self, species: PlantSpecies, norm: str) -> None:
        base = species_level_norm(norm)
        if base and species not in self.by_base[base]:
            self.by_base[base].append(species)
        genus = norm.split()[0].split("'")[0] if norm.split() else ""
        if genus and species not in self.by_genus[genus]:
            self.by_genus[genus].append(species)

    def _register_alias(self, species: PlantSpecies, alt: str) -> None:
        """식별 키와 다른 이름 키를 추가로 등록. 식별 키가 이미 차지한 자리는 건드리지 않는다."""
        self.by_norm.setdefault(alt, species)
        self._index_keys(species, alt)
        self.alias_keys += 1

    def _register(self, species: PlantSpecies) -> None:
        norm = species.scientific_name_norm
        if norm:
            self.by_norm.setdefault(norm, species)
            self._index_keys(species, norm)
        if species.common_name_ko:
            self.by_ko.setdefault(species.common_name_ko, species)

    def set_norm(self, species: PlantSpecies, norm: str) -> None:
        """학명을 처음 알게 된 기존 행에 매칭 키를 채우고 인덱스도 갱신."""
        species.scientific_name_norm = norm
        self.by_norm.setdefault(norm, species)
        self._index_keys(species, norm)

    def species_level_matches(self, norm: str | None) -> list[PlantSpecies]:
        """종 단위 자료를 붙일 대상 종 목록.

        소스 학명이 속명만 있으면(ASPCA 의 'Spathiphyllum', 'Begonia spp.')
        그 속의 모든 종에 붙인다. 속 단위로 유효한 자료라 그게 원래 의미다.
        종소명까지 있으면 그 종과 그 품종 행들에만 붙인다.
        """
        base = species_level_norm(norm)
        if not base:
            return []
        if " " in base:
            return self.by_base.get(base, [])
        return self.by_genus.get(base, [])

    def find_or_create(
        self, norm: str | None, ko_name: str | None, values: dict, can_create: bool
    ) -> tuple[PlantSpecies | None, str | None]:
        if norm:
            species = self.by_norm.get(norm)
            if species is not None:
                return species, "SCI_NAME"

        if ko_name:
            species = self.by_ko.get(ko_name)
            if species is not None:
                if norm and not species.scientific_name_norm:
                    self.set_norm(species, norm)
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
        self.db.add(species)
        self._register(species)
        self.created += 1
        return species, ("SCI_NAME" if norm else "KO_NAME")

    def link(self, species_id: int, source_code: str, source_key: str, method: str) -> None:
        """새 종은 flush 후에야 species_id 가 생기므로, 반드시 flush 뒤에 호출한다."""
        key = (source_code, source_key, species_id)
        if key in self.link_keys:
            return
        self.link_keys.add(key)
        self.db.add(
            SpeciesSourceLink(
                species_id=species_id,
                source_code=source_code,
                source_key=source_key,
                match_method=method,
                confidence=1.0 if method == "SCI_NAME" else 0.7,
            )
        )

    def queue_review(self, source_code: str, source_key: str, raw_name: str | None) -> None:
        key = (source_code, source_key)
        if key in self.review_rows:
            return
        row = SpeciesMatchReview(
            source_code=source_code,
            source_key=source_key,
            raw_name=raw_name,
            candidates=None,
        )
        self.review_rows[key] = row
        self.db.add(row)

    def clear_review(self, source_code: str, source_key: str) -> None:
        """이번 실행에서 붙은 소스 행은 검토 큐에서 뺀다.

        이걸 안 하면 매칭 규칙을 개선해 붙인 뒤에도 큐에 남아
        '아직 확인이 필요한 항목'으로 잘못 보인다.
        """
        row = self.review_rows.pop((source_code, source_key), None)
        if row is not None:
            self.db.delete(row)
            self.resolved_reviews += 1


def backfill_norms(db, index: "SpeciesIndex") -> int:
    """기존 plant_species(사용자 등록 유래 포함)의 scientific_name_norm 을 채운다.

    이걸 먼저 하지 않으면 마스터 병합이 같은 종을 새 행으로 또 만든다.
    같은 norm 이 이미 있으면(유니크 위반) 건드리지 않고 넘어간다.
    """
    filled = 0
    for species in index.existing:
        if species.scientific_name_norm or not species.scientific_name:
            continue
        norm = normalize_scientific_name(species.scientific_name)
        if not norm or norm in index.by_norm:
            continue
        index.set_norm(species, norm)
        filled += 1
    db.commit()
    return filled


def apply_values(species: PlantSpecies, values: dict) -> None:
    """값이 있을 때만 덮어쓴다. None 은 '이 소스가 모르는 필드'라는 뜻."""
    for field, value in values.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        setattr(species, field, value)


def derive_is_toxic(species: PlantSpecies) -> None:
    flags = [species.toxic_to_dogs, species.toxic_to_cats, species.toxic_to_horses]
    if any(flag is True for flag in flags):
        species.is_toxic = True
    elif any(flag is False for flag in flags):
        # 세 동물 모두 '독성 없음'으로 확인된 경우
        species.is_toxic = False
    else:
        species.is_toxic = bool((species.toxicity_info or "").strip())


def main(argv: list[str] | None = None) -> None:
    # ingest_run 은 source_code CHECK 때문에 4개 소스만 기록할 수 있어 병합은 이력을 남기지 않는다.
    # 병합은 멱등이라 실패하면 그냥 다시 돌리면 된다.
    requested = [arg.upper() for arg in (argv if argv is not None else sys.argv[1:])]
    unknown = [code for code in requested if code not in APPLY_ORDER]
    if unknown:
        raise SystemExit(f"알 수 없는 소스: {unknown}\n사용 가능: {APPLY_ORDER}")

    if requested:
        # 요청한 소스보다 우선순위가 높은(뒤에 오는) 소스는 반드시 함께 다시 적용해야 한다.
        # 그러지 않으면 낮은 우선순위 소스가 상위 소스의 값을 덮어쓴다.
        # (예: RDA_INDOOR 만 돌리면 toxicity_info 가 ASPCA 증상 텍스트 → 농사로 텍스트로 되돌아간다)
        start = min(APPLY_ORDER.index(code) for code in requested)
        order = APPLY_ORDER[start:]
        if order != requested:
            log(f"요청: {requested} → 우선순위 유지를 위해 함께 처리: {order}")
        else:
            log(f"병합 대상 소스만 처리: {order}")
    else:
        order = list(APPLY_ORDER)

    db = session()
    try:
        log("기존 종/링크 인덱스 적재")
        index = SpeciesIndex(db)
        log(
            f"  종 {len(index.by_norm)}(학명키, 이름 별칭 {index.alias_keys}건 포함)"
            f" / 링크 {len(index.link_keys)} / 검토큐 {len(index.review_rows)}"
        )

        filled = backfill_norms(db, index)
        log(f"기존 종 학명 정규화 backfill: {filled}건")

        touched: set[PlantSpecies] = set()
        total_linked = 0

        for source_code in order:
            model, transform = SOURCES[source_code]
            rows = db.scalars(select(model)).all()
            if not rows:
                log(f"{source_code}: 원본 0건 — skip")
                continue

            can_create = source_code in CAN_CREATE_SPECIES
            fan_out = source_code in FAN_OUT_TO_CULTIVARS
            reviewed = 0

            if fan_out:
                # 덜 구체적인 행(속 단위)을 먼저 적용해서, 같은 종을 가리키는
                # 더 구체적인 행(종·품종 단위)이 뒤에 와서 덮어쓰게 한다.
                rows = sorted(rows, key=lambda r: len((r.sci_name_norm or "").split()))

            log(f"{source_code}: 원본 {len(rows)}건 매칭 시작")

            # 1단계 — 매칭/생성만. 조회는 전부 메모리 인덱스에서.
            plans: list[tuple[str, dict, list[PlantSpecies], str]] = []
            for row in rows:
                values = transform(row)

                if fan_out:
                    # 종 단위 자료 → 기본종과 그 품종 행 전부에 반영.
                    # 정규화 학명 기준이라 재실행해도 같은 집합이 나온다.
                    matches = index.species_level_matches(row.sci_name_norm)
                    method = "SCI_NAME"
                else:
                    # 지난 적재에서 붙은 종이 있으면 그대로 재사용 (멱등성)
                    matches = index.prior.get((source_code, row.source_key), [])
                    method = "SCI_NAME" if row.sci_name_norm else "KO_NAME"
                    if not matches:
                        # ASPCA 원본에는 국명 컬럼이 없다 (영문 일반명만)
                        species, method = index.find_or_create(
                            row.sci_name_norm, getattr(row, "ko_name", None), values, can_create
                        )
                        matches = [species] if species is not None else []

                if not matches:
                    index.queue_review(source_code, row.source_key, row.sci_name or None)
                    reviewed += 1
                    continue
                # 붙었으면 지난 실행에서 남은 검토 항목을 해제
                index.clear_review(source_code, row.source_key)
                plans.append((row.source_key, values, matches, method))

            # 2단계 — 새 종을 한 번에 INSERT 해서 species_id 를 확보
            log(f"  신규 종 flush ({index.created}건 누적)")
            db.flush()

            # 3단계 — 값 반영 + 링크 (UPDATE/INSERT 가 배치로 나간다)
            log(f"  값 반영/링크 {len(plans)}건")
            for source_key, values, matches, method in plans:
                for species in matches:
                    apply_values(species, values)
                    index.link(species.species_id, source_code, source_key, method)
                    touched.add(species)

            log("  commit")
            db.commit()
            total_linked += len(plans)
            log(f"{source_code}: {len(plans)}건 반영, 검토 대기 {reviewed}건")

        # is_toxic 파생값 계산 — 동물별 플래그와 독성 텍스트를 종합
        for species in touched:
            derive_is_toxic(species)
        db.commit()

        log(
            f"병합 완료 — plant_species {len(touched)}건 갱신 "
            f"(신규 {index.created}건, 연결 {total_linked}건)"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()