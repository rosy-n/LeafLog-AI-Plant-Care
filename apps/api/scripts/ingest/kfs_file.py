"""산림청_표준식물종정보 CSV → src_kfs_species.

크기 / 개화기 / 결실기의 소스. data.go.kr 파일데이터라 API 가 없어 CSV 를 직접 내려받아야 한다.

준비:
  1. https://www.data.go.kr/data/15092915/fileData.do 에서 CSV 내려받기
  2. data/kfs-standard-plants.csv 로 저장 (xlsx 로 받았으면 CSV 로 변환)
실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.kfs_file

컬럼명이 배포본마다 조금씩 달라서 아래 별칭 목록으로 헤더를 찾는다.
못 찾으면 실제 헤더를 그대로 출력하고 중단하니, 그때 별칭만 추가하면 된다.
"""
import csv
import re
import unicodedata

from app.models import SrcKfsSpecies

from ._common import DATA_DIR, ingest_run, log, normalize_scientific_name, session, upsert

INPUT_CSV = DATA_DIR / "kfs-standard-plants.csv"

# 필드 → 허용 헤더 별칭 (공백/괄호 제거 후 비교)
# 2025-11-20 배포본의 실제 헤더:
#   연번, 국명, 학명, 과국명, 과명, 개화기시작(월), 결실기(월), 보호식물여부, 특산식물여부, 크기
HEADER_ALIASES = {
    "source_key": ["연번", "식물아이디", "국가표준식물목록id", "id", "번호", "일련번호", "종id"],
    "ko_name": ["국명", "정명국명", "한글명", "국명한글", "식물명"],
    "sci_name": ["학명", "정명학명", "학명전체"],
    "family_name": ["과국명", "과명국문", "과명"],
    "size_raw": ["크기", "높이", "수고", "생육형태크기", "규격"],
    "flowering_period": ["개화기시작(월)", "개화기", "개화시기", "꽃피는시기"],
    "fruiting_period": ["결실기(월)", "결실기", "결실시기", "열매시기"],
}

# 월 숫자만 들어오는 컬럼 — '7' → '7월'
MONTH_ONLY_FIELDS = {"flowering_period", "fruiting_period"}

# 인코딩 후보 — 공공데이터 CSV 는 cp949 가 흔하다 (이 배포본도 cp949, BOM 없음)
ENCODINGS = ["utf-8-sig", "cp949", "utf-8"]

_MEASURE = r"(?P<low>\d+(?:\.\d+)?)\s*(?:~|-|∼|—)?\s*(?P<high>\d+(?:\.\d+)?)?\s*(?P<unit>cm|m|mm)"
# '크기' 는 문장형이라 잎/지름 수치가 섞여 있다. 높이·수고·키 뒤의 값을 먼저 찾는다.
_HEIGHT_LABELED_RE = re.compile(r"(?:높이|수고|키가|키는|키)\s*" + _MEASURE, re.IGNORECASE)
_HEIGHT_RE = re.compile(_MEASURE, re.IGNORECASE)


def _norm_header(header: str) -> str:
    return re.sub(r"[\s()\[\]_·]", "", header or "").lower()


def resolve_headers(fieldnames: list[str]) -> dict[str, str]:
    """CSV 헤더 → 내부 필드명 매핑. ko_name/sci_name 중 하나도 못 찾으면 중단."""
    normalized = {_norm_header(name): name for name in fieldnames}
    mapping: dict[str, str] = {}
    for field, aliases in HEADER_ALIASES.items():
        for alias in aliases:
            actual = normalized.get(_norm_header(alias))
            if actual:
                mapping[field] = actual
                break

    if "ko_name" not in mapping and "sci_name" not in mapping:
        raise SystemExit(
            "국명/학명 컬럼을 찾지 못했습니다. HEADER_ALIASES 에 별칭을 추가하세요.\n"
            f"실제 헤더: {fieldnames}"
        )
    log(f"  헤더 매핑: { {k: v for k, v in mapping.items()} }")
    missing = [f for f in HEADER_ALIASES if f not in mapping]
    if missing:
        log(f"  못 찾은 컬럼(빈 값으로 적재): {missing}")
    return mapping


def format_month(raw: str | None) -> str | None:
    """'7' → '7월'. 이미 '월'이 붙어 있거나 숫자가 아니면 원문 그대로."""
    if not raw:
        return None
    value = raw.strip()
    return f"{value}월" if value.isdigit() else value or None


def parse_height_cm(size_raw: str | None) -> tuple[int | None, int | None]:
    """'높이 2~3m' → (200, 300). 값이 없거나 못 읽으면 (None, None).

    '높이 15m, 지름 30cm' 처럼 다른 부위 수치가 섞인 문장이 많아
    높이·수고·키 뒤의 값을 먼저 찾고, 없을 때만 첫 측정값을 쓴다.
    """
    if not size_raw:
        return None, None
    # 원문에 전각 단위기호가 섞여 있다 ('높이 30-90㎝'). NFKC 로 ㎝→cm, ㎜→mm 로 펴준다.
    text = unicodedata.normalize("NFKC", size_raw)
    match = _HEIGHT_LABELED_RE.search(text) or _HEIGHT_RE.search(text)
    if match is None:
        # '높이가 70-90(140)cm' 처럼 범위와 단위 사이에 예외값 괄호가 끼면 위 패턴이 안 걸린다.
        # 괄호를 걷어낸 문장으로 한 번 더 시도 (원문 매칭이 실패했을 때만)
        stripped = re.sub(r"\([^)]*\)", " ", text)
        match = _HEIGHT_LABELED_RE.search(stripped) or _HEIGHT_RE.search(stripped)
    if match is None:
        return None, None

    unit = match.group("unit").lower()
    factor = {"cm": 1.0, "m": 100.0, "mm": 0.1}[unit]
    low = float(match.group("low")) * factor
    high = float(match.group("high")) * factor if match.group("high") else low
    if low > high:
        low, high = high, low
    return int(round(low)), int(round(high))


def read_rows() -> tuple[list[dict], list[str]]:
    if not INPUT_CSV.exists():
        raise SystemExit(
            f"CSV 가 없습니다: {INPUT_CSV}\n"
            "https://www.data.go.kr/data/15092915/fileData.do 에서 내려받아 이 경로에 두세요."
        )
    last_error: Exception | None = None
    for encoding in ENCODINGS:
        try:
            with INPUT_CSV.open("r", encoding=encoding, newline="") as fp:
                reader = csv.DictReader(fp)
                rows = list(reader)
                log(f"  인코딩 {encoding} 으로 {len(rows)}행 읽음")
                return rows, list(reader.fieldnames or [])
        except UnicodeDecodeError as exc:
            last_error = exc
    raise SystemExit(f"CSV 인코딩을 판별할 수 없습니다: {last_error}")


def main() -> None:
    rows, fieldnames = read_rows()
    if not rows:
        raise SystemExit("CSV 에 데이터 행이 없습니다.")
    mapping = resolve_headers(fieldnames)

    db = session()
    try:
        with ingest_run(db, "KFS_STD") as run:
            saved = 0
            for index, row in enumerate(rows, start=1):
                def value(field: str) -> str | None:
                    column = mapping.get(field)
                    if not column:
                        return None
                    raw = (row.get(column) or "").strip() or None
                    return format_month(raw) if field in MONTH_ONLY_FIELDS else raw

                sci_name = value("sci_name")
                ko_name = value("ko_name")
                if not sci_name and not ko_name:
                    continue

                # source_key 컬럼이 없는 배포본은 학명(없으면 국명)을 키로 사용
                source_key = value("source_key") or sci_name or ko_name
                size_raw = value("size_raw")

                upsert(
                    db,
                    SrcKfsSpecies,
                    source_key,
                    {
                        "ko_name": ko_name,
                        "sci_name": sci_name,
                        "sci_name_norm": normalize_scientific_name(sci_name),
                        "family_name": value("family_name"),
                        "size_raw": size_raw,
                        "flowering_period": value("flowering_period"),
                        "fruiting_period": value("fruiting_period"),
                        "payload": row,
                        "ingest_run_id": run.run_id,
                    },
                )
                saved += 1
                if index % 2000 == 0:
                    db.commit()
                    log(f"  {index}/{len(rows)}")

            db.commit()
            run.row_count = saved
            log(f"완료 — src_kfs_species {saved}건")
    finally:
        db.close()


if __name__ == "__main__":
    main()