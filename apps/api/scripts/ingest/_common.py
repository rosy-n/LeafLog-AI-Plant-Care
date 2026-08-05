"""종 마스터 적재 공통 유틸 — 학명 정규화, 적재 이력, upsert.

모든 ingest 스크립트는 apps/api 를 sys.path 에 넣고 app.* 을 임포트한다.
실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.<모듈명>
"""
import re
import sys
import unicodedata
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = API_ROOT.parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

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
    return norm


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


def upsert(db: Session, model, pk_value, values: dict) -> None:
    """소스 원본 테이블 upsert — PK 는 단일 컬럼 source_key 를 가정."""
    pk_name = model.__mapper__.primary_key[0].name
    row = db.get(model, pk_value)
    if row is None:
        db.add(model(**{pk_name: pk_value}, **values))
        return
    for key, value in values.items():
        setattr(row, key, value)


def log(message: str) -> None:
    print(f"[{utc_now():%H:%M:%S}] {message}", flush=True)


# 한글/특수문자 로그가 cp949 콘솔에서 UnicodeEncodeError 로 죽지 않도록
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass