"""위키 기반 한글 이름 해석 — 종 검색의 국명 인식률 보강용.

plant_species.common_name_ko 는 소스(NATURE_KNA/KFS_STD/RDA_INDOOR) 기준의 정식 국명이라
사용자가 등록 화면에서 입력하는 이름과 자주 어긋난다.
  · 유통명/원예명이 다르다        '금전수'     ↔ 마스터 '금전초'
  · 국명 자리가 영문명이다        '테이블야자' ↔ 마스터 'parlour palm'
  · 위키 표제어가 다른 이름이다   '여인초'     ↔ 위키 '부채파초'
이 모듈은 그 간극을 위키로 메운다 — 결과는 plant_species_alias 에 캐싱된다.

두 방향을 모두 쓴다.
  resolve_ko_name(검색어)   ko.wikipedia 표제어(넘겨주기 따라감) → Wikidata P225 학명
                            → 검색 요청 안에서 호출 (app/main.py 의 _resolve_query_via_wiki)
  fetch_ko_aliases(학명들)  Wikidata 한국어 라벨·별칭 + ko.wikipedia 표제어·넘겨주기
                            → 배치 사전 적재 (scripts/ingest/wiki_ko_alias.py)

wikimedia.py(사진)와 마찬가지로 API 키가 필요 없고, 정책상 연락처가 담긴 User-Agent 만
요구한다 — apps/api/.env 의 WIKIMEDIA_USER_AGENT 를 같이 쓴다.
참고: https://ko.wikipedia.org/w/api.php , https://query.wikidata.org/
"""
import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Sequence
from urllib.parse import unquote

import requests

from .config import settings
from .wikimedia import species_level_norm

KO_WIKI_API = "https://ko.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# 학명(taxon name) 속성
TAXON_NAME_PROP = "P225"

# 검색 요청 경로에서 그대로 기다리는 호출이라 짧게 잡는다 (최악의 경우 2회 호출)
REQUEST_TIMEOUT_SEC = 5
# 배치는 한 번에 여러 종을 물어보므로 넉넉히
SPARQL_TIMEOUT_SEC = 60
# SPARQL VALUES 한 묶음 / ko.wikipedia titles 파라미터 한 묶음 (익명 호출 상한 50)
CHUNK = 50

# 별칭 검색 키 정규화 — 공백/가운뎃점/하이픈/따옴표를 지운다.
# '테이블 야자' · '테이블·야자' · '테이블야자' 를 모두 같은 말로 본다.
_NORM_STRIP = re.compile(r"[\s·・~\-_'’‘\"()]+")
_HANGUL = re.compile(r"[가-힣]")
# 위키 표제어 뒤의 동음이의 괄호 — '크로톤 (식물)' → '크로톤'
_DISAMBIG = re.compile(r"\s*\([^)]*\)\s*$")
# 분류계급 이름. 검색어로는 받아 주지만(사용자가 '부처손과'로 찾을 수 있다)
# 화면에 종 이름으로 내보이지는 않는다 — main.py 의 _display_aliases 가 이 함수를 쓴다
_RANK_SUFFIX = ("속", "과", "목", "강", "문", "아과", "아목", "상과", "족", "아족")


def alias_norm(raw: str | None) -> str:
    """검색어/별칭 → 별칭 매칭 키. plant_species_alias.alias_norm 에 저장하는 값."""
    if not raw:
        return ""
    text = unicodedata.normalize("NFKC", str(raw)).strip().lower()
    return _NORM_STRIP.sub("", text)


def has_hangul(raw: str | None) -> bool:
    return bool(raw) and bool(_HANGUL.search(raw))


def strip_disambiguation(raw: str) -> str:
    """위키 표제어의 동음이의 괄호를 뗀다. '크로톤 (식물)' → '크로톤'."""
    return _DISAMBIG.sub("", raw).strip() or raw.strip()


def is_rank_name(raw: str | None) -> bool:
    """'유카속'·'부처손과'처럼 분류계급을 가리키는 이름인지.

    위키 표제어가 속·과 단위일 때 딸려 온다. 종 하나의 이름으로 보여주기엔 어긋나서
    표시용으로는 거르고, 검색 별칭으로는 그대로 둔다.
    """
    return bool(raw) and raw.strip().endswith(_RANK_SUFFIX)


def probe_name(scientific_name_norm: str | None) -> str | None:
    """정규화 학명 → 위키에 물어볼 학명 표기.

    Wikidata P225 는 저자명 없는 종 단위 학명이라 품종 표기를 걷어내고 속명만 대문자화한다.
    "dracaena sanderiana 'celes'" → 'Dracaena sanderiana'
    """
    base = species_level_norm(scientific_name_norm)
    if not base:
        return None
    tokens = base.split()
    return " ".join([tokens[0].capitalize(), *tokens[1:]])


def _open_session() -> requests.Session:
    http = requests.Session()
    http.headers.update({"User-Agent": settings.wikimedia_user_agent})
    return http


def _ko_wiki_query(http: requests.Session, **params) -> dict:
    params = {"action": "query", "format": "json", "formatversion": "2", **params}
    response = http.get(KO_WIKI_API, params=params, timeout=REQUEST_TIMEOUT_SEC)
    response.raise_for_status()
    return response.json()


# ---------------------------------------------------------------------------
# 검색어 → 학명 (검색 요청 경로)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WikiTaxon:
    # Wikidata P225 학명 — 'Chamaedorea elegans'
    scientific_name: str
    # plant_species.scientific_name_norm 과 맞춰 볼 소문자 표기.
    # P225 는 저자명/변종 표기가 없는 정제된 값이라 소문자화만으로 충분하다
    # (scripts/ingest/_common.py 의 normalize_scientific_name 과 달리 걷어낼 잡음이 없다).
    scientific_name_norm: str
    # ko.wikipedia 표제어 — 넘겨주기를 따라간 뒤의 이름 ('여인초' → '부채파초')
    ko_title: str


def resolve_ko_name(query: str) -> WikiTaxon | None:
    """한글 검색어 → 위키가 아는 학명. 못 찾으면 None.

    ko.wikipedia 의 '정확한 표제어'만 본다 — 전문검색(list=search)은 '떡갈고무나무'에
    애넌데일쥐를, '접란'에 무관한 문서를 물어오는 등 오답이 많아 쓰지 않는다.
    표기 변형·오타는 이 함수 대신 마스터 안에서 pg_trgm 유사도로 잡는다.
    """
    keyword = (query or "").strip()
    if not keyword:
        return None

    try:
        with _open_session() as http:
            title, qid = _ko_page(http, keyword)
            if not qid:
                return None
            scientific_name = _taxon_name(http, qid)
    except requests.RequestException as exc:
        print(f"위키 국명 해석 실패 ({keyword}): {exc}")
        return None

    if not scientific_name:
        # 분류군 문서가 아니다 (동명이의 문서 등)
        return None
    return WikiTaxon(
        scientific_name=scientific_name,
        scientific_name_norm=scientific_name.strip().lower(),
        ko_title=title or keyword,
    )


def _ko_page(http: requests.Session, title: str) -> tuple[str | None, str | None]:
    """ko.wikipedia 표제어 → (넘겨주기 따라간 표제어, Wikidata 항목 ID). 문서가 없으면 (None, None)."""
    data = _ko_wiki_query(
        http,
        titles=title,
        redirects=1,
        prop="pageprops",
        ppprop="wikibase_item",
    )
    pages = data.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        return None, None
    page = pages[0]
    return page.get("title"), (page.get("pageprops") or {}).get("wikibase_item")


def _taxon_name(http: requests.Session, qid: str) -> str | None:
    """Wikidata 항목 → P225 학명. 분류군 항목이 아니면 None."""
    response = http.get(
        WIKIDATA_API,
        params={
            "action": "wbgetentities",
            "format": "json",
            "ids": qid,
            "props": "claims",
        },
        timeout=REQUEST_TIMEOUT_SEC,
    )
    response.raise_for_status()
    entity = (response.json().get("entities") or {}).get(qid) or {}
    claims = (entity.get("claims") or {}).get(TAXON_NAME_PROP)
    if not claims:
        return None
    value = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value")
    return value.strip() if isinstance(value, str) and value.strip() else None


# ---------------------------------------------------------------------------
# 학명 → 한글 이름들 (배치 사전 적재)
# ---------------------------------------------------------------------------

# plant_species_alias.source 값
SRC_LABEL = "WIKI_KO_LABEL"
SRC_ALIAS = "WIKI_KO_ALIAS"
SRC_REDIRECT = "WIKI_KO_REDIRECT"
SRC_QUERY = "WIKI_KO_QUERY"

_SPARQL_TEMPLATE = """
SELECT ?name ?koLabel ?koAlias ?article WHERE {{
  VALUES ?name {{ {values} }}
  ?item wdt:{prop} ?name .
  OPTIONAL {{ ?item rdfs:label ?koLabel FILTER(lang(?koLabel) = "ko") }}
  OPTIONAL {{ ?item skos:altLabel ?koAlias FILTER(lang(?koAlias) = "ko") }}
  OPTIONAL {{ ?article schema:about ?item ; schema:isPartOf <https://ko.wikipedia.org/> }}
}}
"""


def fetch_ko_aliases(names: Sequence[str]) -> dict[str, list[tuple[str, str]]]:
    """학명 목록 → {학명: [(한글 이름, source)]}.

    이름은 probe_name() 표기(저자명 없는 종 단위, 속명만 대문자)로 넘긴다.
    한국어 자료가 없는 종은 결과에서 빠진다 — 위키의 한국어 분류군 문서는
    관엽식물 위주로만 있어 전체 적중률이 절반을 넘지 않는다.
    """
    probes = [name for name in dict.fromkeys(names) if name]
    if not probes:
        return {}

    found: dict[str, list[tuple[str, str]]] = {}
    articles: dict[str, str] = {}  # ko.wikipedia 표제어 → 학명

    with _open_session() as http:
        for chunk in _chunks(probes, CHUNK):
            for name, ko_label, ko_alias, article in _sparql_ko_names(http, chunk):
                bucket = found.setdefault(name, [])
                if ko_label:
                    _add(bucket, ko_label, SRC_LABEL)
                if ko_alias:
                    _add(bucket, ko_alias, SRC_ALIAS)
                if article:
                    _add(bucket, article, SRC_LABEL)
                    articles[article] = name

        # ko.wikipedia 넘겨주기 = 사람들이 실제로 쓰는 다른 이름 ('여인초' → '부채파초')
        for chunk in _chunks(list(articles), CHUNK):
            for article, redirect in _ko_redirects(http, chunk):
                name = articles.get(article)
                if name:
                    _add(found.setdefault(name, []), redirect, SRC_REDIRECT)

    return {name: aliases for name, aliases in found.items() if aliases}


def _add(bucket: list[tuple[str, str]], value: str, source: str) -> None:
    """한글이 든 이름만, 정규화 키 기준으로 중복 없이 담는다."""
    text = strip_disambiguation((value or "").strip())
    if not text or not has_hangul(text):
        return
    key = alias_norm(text)
    if not key or any(alias_norm(existing) == key for existing, _ in bucket):
        return
    bucket.append((text, source))


def _chunks(items: Sequence[str], size: int) -> Iterable[Sequence[str]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def _sparql_ko_names(
    http: requests.Session, names: Sequence[str]
) -> list[tuple[str, str | None, str | None, str | None]]:
    values = " ".join('"{}"'.format(name.replace('"', '')) for name in names)
    query = _SPARQL_TEMPLATE.format(values=values, prop=TAXON_NAME_PROP)
    response = http.get(
        WIKIDATA_SPARQL,
        params={"query": query, "format": "json"},
        headers={"Accept": "application/sparql-results+json"},
        timeout=SPARQL_TIMEOUT_SEC,
    )
    response.raise_for_status()

    rows: list[tuple[str, str | None, str | None, str | None]] = []
    for binding in response.json().get("results", {}).get("bindings", []):
        cell = lambda key: (binding.get(key) or {}).get("value")  # noqa: E731
        rows.append(
            (
                cell("name") or "",
                cell("koLabel"),
                cell("koAlias"),
                _article_title(cell("article")),
            )
        )
    return rows


def _article_title(url: str | None) -> str | None:
    """ko.wikipedia 문서 URL → 표제어. SPARQL 은 퍼센트 인코딩된 URL 로 돌려준다."""
    if not url:
        return None
    return unquote(url.rsplit("/", 1)[-1]).replace("_", " ") or None


def _ko_redirects(http: requests.Session, titles: Sequence[str]) -> list[tuple[str, str]]:
    """ko.wikipedia 표제어들 → [(표제어, 그 문서로 넘겨주는 이름)]."""
    data = _ko_wiki_query(
        http,
        titles="|".join(titles),
        prop="redirects",
        rdlimit="max",
        rdnamespace=0,
    )
    pairs: list[tuple[str, str]] = []
    for page in data.get("query", {}).get("pages", []):
        title = page.get("title")
        if not title:
            continue
        for redirect in page.get("redirects") or []:
            name = redirect.get("title")
            if name:
                pairs.append((title, name))
    return pairs
