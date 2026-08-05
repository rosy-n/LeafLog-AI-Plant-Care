"""ASPCA 독성 식물 목록 → data/aspca-toxic-plants.csv 스냅샷 생성 (1회 실행용).

ASPCA 는 OpenAPI 가 없어 목록 페이지를 읽어 스냅샷을 만들고, 그 CSV 를 리포에 커밋한다.
적재는 scripts.ingest.aspca 가 이 CSV 만 읽으므로 평시에는 네트워크가 필요 없다.
자료가 갱신됐을 때만 이 스크립트를 다시 돌려 CSV 를 교체한다.

실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.aspca_snapshot

수집 방식: 목록 뷰의 독성/비독성 필터(동물별 3종)를 각각 끝까지 페이지네이션.
  toxic 필터에 등장    → 해당 동물에 대해 True
  non-toxic 필터에 등장 → False
  어느 쪽에도 없음      → None (자료 없음)
동일 학명이 독성/비독성 양쪽에 잡히면 안전한 쪽(True)을 채택한다.
"""
import csv
import html
import re
import time
import urllib.error
import urllib.request

from ._common import DATA_DIR, log, normalize_scientific_name

BASE_URL = "https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants"
OUTPUT_CSV = DATA_DIR / "aspca-toxic-plants.csv"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
# 목록 페이지만 읽고 상세는 건드리지 않는다. 페이지 간 간격을 둬 부하를 줄인다.
REQUEST_DELAY_SEC = 0.7
MAX_PAGES = 60

# (쿼리 파라미터, 값, 동물, 독성 여부)
FILTERS = [
    ("field_toxicity_value", "01", "dogs", True),
    ("field_toxicity_value", "02", "cats", True),
    ("field_toxicity_value", "03", "horses", True),
    ("field_non_toxicity_value", "01", "dogs", False),
    ("field_non_toxicity_value", "02", "cats", False),
    ("field_non_toxicity_value", "03", "horses", False),
]

_ROW_RE = re.compile(r'<div class="views-row[^"]*"[^>]*>(.*?)(?=<div class="views-row|\Z)', re.S)
_COMMON_RE = re.compile(
    r'views-field-title"\s*>.*?<div class="plant-title-name">(.*?)</div>', re.S
)
_SCI_RE = re.compile(
    r'views-field-title-scientific-name"\s*>.*?<div class="plant-title-name">(.*?)</div>', re.S
)
_HREF_RE = re.compile(r'href="(/pet-care/[^"]+)"')


def _clean(raw: str | None) -> str:
    if not raw:
        return ""
    return html.unescape(re.sub(r"<[^>]+>", "", raw)).strip()


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, "replace")


def parse_rows(body: str) -> list[dict]:
    rows = []
    for block in _ROW_RE.findall(body):
        common = _clean(_COMMON_RE.search(block).group(1)) if _COMMON_RE.search(block) else ""
        sci = _clean(_SCI_RE.search(block).group(1)) if _SCI_RE.search(block) else ""
        href = _HREF_RE.search(block)
        if not common and not sci:
            continue
        rows.append(
            {
                "common_name_en": common,
                "sci_name": sci,
                "detail_url": f"https://www.aspca.org{href.group(1)}" if href else "",
            }
        )
    return rows


def crawl_filter(param: str, value: str) -> list[dict]:
    collected: list[dict] = []
    for page in range(MAX_PAGES):
        url = f"{BASE_URL}?{param}%5B%5D={value}&page={page}"
        try:
            body = fetch(url)
        except urllib.error.HTTPError as exc:
            log(f"  page {page} HTTP {exc.code} — 중단")
            break
        rows = parse_rows(body)
        if not rows:
            break
        collected.extend(rows)
        log(f"  page {page}: {len(rows)}건 (누적 {len(collected)})")
        time.sleep(REQUEST_DELAY_SEC)
    return collected


def main() -> None:
    # key: sci_name_norm (없으면 common name 소문자) → 레코드
    merged: dict[str, dict] = {}

    for param, value, animal, is_toxic in FILTERS:
        log(f"{param}={value} ({'toxic' if is_toxic else 'non-toxic'} to {animal})")
        for row in crawl_filter(param, value):
            norm = normalize_scientific_name(row["sci_name"])
            key = norm or f"common:{row['common_name_en'].lower()}"
            record = merged.setdefault(
                key,
                {
                    "sci_name_norm": norm or "",
                    "sci_name": row["sci_name"],
                    "common_name_en": row["common_name_en"],
                    "detail_url": row["detail_url"],
                    "toxic_to_dogs": "",
                    "toxic_to_cats": "",
                    "toxic_to_horses": "",
                },
            )
            column = f"toxic_to_{animal}"
            # 독성/비독성이 충돌하면 안전한 쪽(True) 유지
            if is_toxic or record[column] == "":
                record[column] = "true" if is_toxic else "false"

    if not merged:
        raise SystemExit("수집 결과가 0건입니다. 페이지 구조가 바뀌었는지 확인하세요.")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fields = [
        "sci_name_norm",
        "sci_name",
        "common_name_en",
        "toxic_to_dogs",
        "toxic_to_cats",
        "toxic_to_horses",
        "detail_url",
    ]
    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=fields)
        writer.writeheader()
        for key in sorted(merged):
            writer.writerow(merged[key])

    log(f"완료 — {len(merged)}건 → {OUTPUT_CSV}")


if __name__ == "__main__":
    main()