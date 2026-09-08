"""Wikimedia Commons API — 종 사진 최대 4장 조회.

GET /api/species/{id} 가 어떤 종을 처음 조회할 때(plant_species_image에 아직 행이
없을 때) app/main.py의 _ensure_species_images가 이 모듈을 그 요청 안에서 그대로
호출한다 — 배치 사전 적재는 하지 않는다.

API 키 발급 불필요 — Wikimedia Commons는 action API(commons.wikimedia.org/w/api.php)를
익명으로 무료 호출할 수 있다. 다만 정책상 연락처가 담긴 User-Agent를 요구하며(없으면 403),
apps/api/.env 의 WIKIMEDIA_USER_AGENT로 바꿀 수 있다(기본값은 리포 URL).
참고: https://api.wikimedia.org/wiki/Documentation ,
      https://meta.wikimedia.org/wiki/User-Agent_policy

조회 순서 — 종마다 최대 2회 호출:
  1) Category:<Genus species> 문서의 파일 멤버 (사람이 큐레이션한 카테고리라 더 정확함)
  2) 위에서 못 찾으면 File 네임스페이스 제목 검색으로 대체
"""
import re

import requests

from .config import settings

API_URL = "https://commons.wikimedia.org/w/api.php"
MAX_IMAGES = 4
# 카테고리 조회는 넉넉히 받아 이미지가 아닌 파일(지도 SVG 등)을 걸러내고도 4장을 채운다
FETCH_LIMIT = 10
THUMB_WIDTH = 1024
# 사용자 요청 경로에서 그대로 기다리는 호출이라 배치 때보다 짧게 잡는다 (최악의 경우 2회 호출)
REQUEST_TIMEOUT_SEC = 8

_IMAGE_MIME_PREFIX = "image/"
# 표본철 사진·지도·아이콘 등 대표 사진으로 부적절한 것들을 제목으로 대략 거른다
_TITLE_EXCLUDE = ("distribution map", "locator map", "icon", "logo", "herbarium")


def species_level_norm(norm: str | None) -> str | None:
    """정규화 학명 → 종 단위 키 (품종 표기 제거).

    scripts/ingest/_common.py의 동명 함수와 로직이 같다 — Commons는 품종 단위
    카테고리가 거의 없어서, 품종 행을 조회하더라도 항상 종 단위로 캐싱 키를 통일해야 한다.
    "dracaena sanderiana 'celes'" → "dracaena sanderiana"
    """
    if not norm:
        return None
    base = norm.split("'")[0].strip()
    tokens = base.split()
    if not tokens:
        return None
    return " ".join(tokens[:2])


def _open_session() -> requests.Session:
    http = requests.Session()
    http.headers.update({"User-Agent": settings.wikimedia_user_agent})
    return http


def _query(http: requests.Session, **params) -> dict:
    params = {"action": "query", "format": "json", "formatversion": "2", **params}
    response = http.get(API_URL, params=params, timeout=REQUEST_TIMEOUT_SEC)
    response.raise_for_status()
    return response.json()


def _strip_html(raw: str | None) -> str | None:
    if not raw:
        return None
    return re.sub(r"<[^>]+>", "", raw).strip() or None


def _extract_images(data: dict) -> list[dict]:
    pages = data.get("query", {}).get("pages", [])
    results: list[dict] = []
    for page in pages:
        title = page.get("title", "")
        if any(bad in title.lower() for bad in _TITLE_EXCLUDE):
            continue
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        mime = info.get("mime", "")
        if not mime.startswith(_IMAGE_MIME_PREFIX):
            continue
        url = info.get("thumburl") or info.get("url")
        if not url:
            continue
        extmeta = info.get("extmetadata") or {}
        results.append(
            {
                "url": url,
                "artist": _strip_html(extmeta.get("Artist", {}).get("value")),
                "license": extmeta.get("LicenseShortName", {}).get("value"),
                "source_page": info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/{title}",
            }
        )
    return results


def _by_category(http: requests.Session, query: str) -> list[dict]:
    data = _query(
        http,
        generator="categorymembers",
        gcmtitle=f"Category:{query}",
        gcmtype="file",
        gcmlimit=FETCH_LIMIT,
        prop="imageinfo",
        iiprop="url|mime|extmetadata",
        iiurlwidth=THUMB_WIDTH,
    )
    return _extract_images(data)


def _by_search(http: requests.Session, query: str) -> list[dict]:
    data = _query(
        http,
        generator="search",
        gsrsearch=f'intitle:"{query}"',
        gsrnamespace=6,
        gsrlimit=FETCH_LIMIT,
        prop="imageinfo",
        iiprop="url|mime|extmetadata",
        iiurlwidth=THUMB_WIDTH,
    )
    return _extract_images(data)


def fetch_species_images(scientific_name_norm: str | None) -> list[dict]:
    """정규화 학명(품종 표기 있어도 됨) → 사진 최대 4장. 못 찾으면 빈 리스트."""
    base = species_level_norm(scientific_name_norm)
    if not base:
        return []
    # Commons 카테고리/제목 관례: 속명만 대문자, 종소명은 소문자 ("Monstera deliciosa")
    tokens = base.split()
    query = " ".join([tokens[0].capitalize(), *tokens[1:]])

    with _open_session() as http:
        images = _by_category(http, query)
        if not images:
            images = _by_search(http, query)
        return images[:MAX_IMAGES]
