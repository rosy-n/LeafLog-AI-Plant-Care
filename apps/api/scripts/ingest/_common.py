"""종 마스터 적재 공통 유틸 — 학명 정규화, 적재 이력, upsert.

모든 ingest 스크립트는 apps/api 를 sys.path 에 넣고 app.* 을 임포트한다.
실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.<모듈명>
"""
import csv
import re
import sys
import unicodedata
from contextlib import contextmanager
from functools import lru_cache
from datetime import datetime, timezone
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = API_ROOT.parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import DataSource, IngestRun  # noqa: E402

# 리포에 커밋해 두는 스냅샷/원본 파일 위치
DATA_DIR = REPO_ROOT / "data"

DATA_SOURCES = [
    ("NATURE_KNA", "국가생물종지식정보시스템 (국립수목원)", "https://www.nature.go.kr/main/Main.do", "공공누리 — 출처 표시 필요", 10),
    ("KFS_STD", "산림청_표준식물종정보", "https://www.data.go.kr/data/15092915/fileData.do", "공공누리 — 출처 표시 필요", 20),
    ("RDA_INDOOR", "농촌진흥청_실내정원용 식물", "https://www.data.go.kr/data/15059042/openapi.do", "공공누리 — 인증키 필요", 30),
    ("ASPCA", "ASPCA Toxic and Non-Toxic Plants", "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants", "비영리 단체 웹 자료 — 출처 표시, 재배포 주의", 40),
]

# 학명에서 걷어낼 종하위 계급 표기
_INFRA_MARKERS = re.compile(
    r"\b(var|subsp|ssp|subvar|f|forma|cv|cultivar|sect|ser|nothosubsp|nothovar)\.?\b",
    re.IGNORECASE,
)
# 저자명 앞에 붙는 잡음
_NOISE = re.compile(r"\b(sp|spp|aff|cf|ex|hort|nom\.?\s*illeg|sensu)\.?\b", re.IGNORECASE)


_CULTIVAR_RE = re.compile(r"['‘’\"]([^'‘’\"]+)['‘’\"]")

# 학명 별칭 — 소스별 오타·동의어를 정명 쪽으로 모아 매칭시킨다.
# data/scientific-name-aliases.csv 에 근거와 함께 기록하고, 확인된 항목만 넣는다.
ALIAS_CSV = DATA_DIR / "scientific-name-aliases.csv"


@lru_cache(maxsize=1)
def _name_aliases() -> dict[str, str]:
    if not ALIAS_CSV.exists():
        return {}
    table: dict[str, str] = {}
    with ALIAS_CSV.open("r", encoding="utf-8", newline="") as fp:
        for row in csv.DictReader(fp):
            src = (row.get("from_norm") or "").strip().lower()
            dst = (row.get("to_norm") or "").strip().lower()
            if src and dst:
                table[src] = dst
    return table


def apply_name_alias(norm: str) -> str:
    """이미 정규화된 학명에 별칭만 다시 적용. 별칭이 없으면 원본 그대로."""
    return _apply_alias(norm) if norm else norm


def _apply_alias(norm: str) -> str:
    """정규화 학명에 별칭을 적용. 앞쪽 토큰의 최장 일치를 치환한다.

    별칭 키가 속명 한 단어면 속명 치환으로 동작한다.
      'nephrolepsis cordifolia' → 'nephrolepis cordifolia'
    두 단어면 종까지 포함해 치환하고 뒤의 품종 표기는 그대로 남긴다.
      "fittonia verschaffelti 'white star'" → "fittonia verschaffeltii 'white star'"
    """
    table = _name_aliases()
    if not table:
        return norm
    tokens = norm.split()
    for size in range(len(tokens), 0, -1):
        replacement = table.get(" ".join(tokens[:size]))
        if replacement:
            return " ".join([replacement, *tokens[size:]]).strip()
    return norm


def normalize_scientific_name(raw: str | None) -> str | None:
    """학명 → 소스 매칭 키. 속명 + 종소명(+ 재배품종)만 남기고 소문자화.

    'Monstera deliciosa Liebm.'            → 'monstera deliciosa'
    'Sansevieria trifasciata (Prain)'      → 'sansevieria trifasciata'
    "Dracaena sanderiana 'Celes'"          → "dracaena sanderiana 'celes'"
    'Ficus elastica var. decora'           → 'ficus elastica decora'
    'Monstera'                             → 'monstera'
    빈 값/속명조차 없으면 None.

    ※ 재배품종/변종을 남기는 이유: 개운죽·금천죽·세레스 드라세나는 모두
      Dracaena sanderiana 이지만 사용자가 등록할 때 고르는 대상은 서로 다르다.
      품종을 버리면 이 종들이 한 행으로 뭉개져 검색에서 사라진다.
      종 단위 정보(독성 등)를 품종에 물려줄 때는 species_level_norm() 을 쓴다.
    """
    if not raw:
        return None

    text = unicodedata.normalize("NFKC", str(raw))
    # HTML 태그/엔티티 제거 (농사로 원문에 <i> 등이 섞여 있음)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&times;", "x")
    # 재배품종명은 따옴표 안에 온다 — 괄호 저자명 제거 전에 뽑아 둔다
    cultivar_match = _CULTIVAR_RE.search(text)
    cultivar = cultivar_match.group(1).strip() if cultivar_match else ""
    text = _CULTIVAR_RE.sub(" ", text)
    # 괄호 안 저자명 제거
    text = re.sub(r"\([^)]*\)", " ", text)
    # 잡종 기호 통일
    text = text.replace("×", " x ").replace("✕", " x ")
    text = _INFRA_MARKERS.sub(" ", text)
    text = _NOISE.sub(" ", text)
    # 알파벳/공백/하이픈만 남김 (한글 국명이 섞여 들어오는 행 방어)
    text = re.sub(r"[^A-Za-z\s\-]", " ", text)
    tokens = [t for t in text.split() if t and t != "-"]
    # 잡종 표기 'Genus x species' 는 x 를 버린다
    tokens = [t for t in tokens if t.lower() != "x"]

    if not tokens:
        return None

    # 속명은 항상, 이후 소문자로 시작하는 토큰은 종소명·변종명으로 취급 (저자명은 대문자라 걸러짐)
    parts = [tokens[0].lower()]
    for token in tokens[1:]:
        if token.islower() and len(token) > 1:
            parts.append(token)
        else:
            break

    norm = " ".join(parts)
    if cultivar:
        norm = f"{norm} '{cultivar.lower()}'"
    # 소스별 오타·동의어를 정명 쪽으로 모아 준다 (양방향으로 효과가 있다 —
    # 소스 학명도, 우리 종의 학명도 같은 함수를 통과하므로)
    return _apply_alias(norm)


def species_level_norm(norm: str | None) -> str | None:
    """정규화 학명 → 종 단위 키 (속명 + 종소명). 품종/변종을 떼어낸다.

    "dracaena sanderiana 'celes'" → 'dracaena sanderiana'
    'ficus elastica decora'       → 'ficus elastica'
    """
    if not norm:
        return None
    base = norm.split("'")[0].strip()
    tokens = base.split()
    if not tokens:
        return None
    return " ".join(tokens[:2])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def session() -> Session:
    return SessionLocal()


def ensure_data_sources(db: Session) -> None:
    """data_source 카탈로그 시드 — 없을 때만 넣는다."""
    existing = {code for (code,) in db.query(DataSource.source_code).all()}
    for code, name, url, note, priority in DATA_SOURCES:
        if code not in existing:
            db.add(
                DataSource(
                    source_code=code,
                    source_name=name,
                    source_url=url,
                    license_note=note,
                    priority=priority,
                )
            )
    db.commit()


@contextmanager
def ingest_run(db: Session, source_code: str):
    """적재 1회를 ingest_run 에 기록. 예외가 나면 FAILED + 사유를 남기고 그대로 올린다.

    사용:
        with ingest_run(db, 'KFS_STD') as run:
            ...
            run.row_count = n
    """
    ensure_data_sources(db)
    run = IngestRun(source_code=source_code, status="RUNNING")
    db.add(run)
    db.commit()
    try:
        yield run
    except Exception as exc:
        db.rollback()
        run.status = "FAILED"
        run.error_note = f"{type(exc).__name__}: {exc}"[:2000]
        run.finished_at = utc_now()
        db.add(run)
        db.commit()
        raise
    else:
        run.status = "SUCCESS"
        run.finished_at = utc_now()
        db.add(run)
        db.commit()


class Upserter:
    """소스 원본 테이블 upsert — PK 는 단일 컬럼 source_key 를 가정.

    행마다 SELECT 를 날리면 원격 PG 에서 1만 행 적재가 수십 분짜리가 된다.
    기존 행을 시작할 때 한 번만 통째로 읽어 메모리에 들고, 이후 INSERT/UPDATE 만 낸다.
    """

    def __init__(self, db: Session, model):
        self.db = db
        self.model = model
        self.pk_name = model.__mapper__.primary_key[0].name
        self.existing = {getattr(row, self.pk_name): row for row in db.scalars(select(model)).all()}
        # VARCHAR(n) 길이 — SQLite 는 길이를 강제하지 않아 여기서 막지 않으면
        # PostgreSQL 적재에서만 StringDataRightTruncation 으로 터진다.
        self.limits = {
            column.key: column.type.length
            for column in model.__mapper__.columns
            if isinstance(getattr(column.type, "length", None), int)
        }
        self.truncated: dict[str, int] = {}

    def _fit(self, key: str, value):
        limit = self.limits.get(key)
        if limit is not None and isinstance(value, str) and len(value) > limit:
            self.truncated[key] = self.truncated.get(key, 0) + 1
            return value[:limit]
        return value

    def __call__(self, pk_value, values: dict) -> None:
        values = {key: self._fit(key, value) for key, value in values.items()}
        pk_value = self._fit(self.pk_name, pk_value)
        row = self.existing.get(pk_value)
        if row is None:
            row = self.model(**{self.pk_name: pk_value}, **values)
            self.db.add(row)
            self.existing[pk_value] = row
            return
        for key, value in values.items():
            setattr(row, key, value)

    def report(self) -> None:
        """잘린 컬럼이 있으면 조용히 넘기지 않고 알린다."""
        for key, count in sorted(self.truncated.items()):
            log(f"  주의: {self.model.__tablename__}.{key} 값 {count}건이 {self.limits[key]}자로 잘림")


def log(message: str) -> None:
    print(f"[{utc_now():%H:%M:%S}] {message}", flush=True)


# 한글/특수문자 로그가 cp949 콘솔에서 UnicodeEncodeError 로 죽지 않도록
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass