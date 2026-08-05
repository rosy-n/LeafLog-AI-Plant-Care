"""농촌진흥청_실내정원용 식물 (농사로 OpenAPI) → src_rda_indoor.

광원 조건, 물주기 간격, 겨울 최저온도, 습도, 관리 난이도의 유일한 소스.

실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.rda_indoor
필요: apps/api/.env 의 NONGSARO_API_KEY

주의 — API 응답에는 코드(...Code)와 라벨(...CodeNm)이 섞여 있고,
광원(lighttdemanddo)은 라벨만 내려온다. 그래서 라벨→코드 역매핑이 필요하고,
역매핑 표는 앱과 공유하는 nongsaro-codes.json 을 그대로 쓴다.
"""
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from app.config import settings
from app.models import SrcRdaIndoor

from . import nongsaro_codes as codes
from ._common import ingest_run, log, normalize_scientific_name, session, upsert

BASE_URL = "http://api.nongsaro.go.kr/service/garden"
PAGE_SIZE = 100
REQUEST_DELAY_SEC = 0.2


def _get(path: str, **params) -> ET.Element:
    params["apiKey"] = settings.nongsaro_api_key
    url = f"{BASE_URL}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as response:
        root = ET.fromstring(response.read())
    result_code = (root.findtext(".//resultCode") or "").strip()
    if result_code != "00":
        raise RuntimeError(f"농사로 API 오류 ({result_code}) — {root.findtext('.//resultMsg')}")
    return root


def _text(element: ET.Element, tag: str) -> str | None:
    value = element.findtext(tag)
    value = (value or "").strip()
    return value or None


def _norm_label(label: str) -> str:
    """라벨 비교용 정규화 — 공백 제거 + 소문자. API 와 JSON 의 공백 표기가 달라서 필요."""
    return re.sub(r"\s+", "", label).lower()


def reverse_lookup_all(map_name: str, label: str | None) -> list[str]:
    """라벨 문자열 → 코드 목록.

    콤마 split 을 쓰지 않는다 — 라벨 자체에 콤마가 들어있다("800~1,500 Lux").
    대신 정규화한 라벨이 응답 문자열에 포함되는지로 판정한다.
    """
    if not label:
        return []
    haystack = _norm_label(label)
    found = [
        code
        for code, text in codes.code_map(map_name).items()
        if isinstance(text, str) and _norm_label(text) in haystack
    ]
    return sorted(found)


def list_contents() -> dict[str, str | None]:
    """cntntsNo → 목록 썸네일 URL. 썸네일은 상세 응답에 없어 목록에서만 얻을 수 있다."""
    contents: dict[str, str | None] = {}
    page = 1
    while True:
        root = _get("gardenList", numOfRows=PAGE_SIZE, pageNo=page)
        items = root.findall(".//item")
        if not items:
            break
        for item in items:
            number = _text(item, "cntntsNo")
            if number:
                contents[number] = _text(item, "rtnThumbFileUrl")
        total = int((root.findtext(".//totalCount") or "0").strip() or 0)
        log(f"  목록 page {page}: {len(items)}건 (누적 {len(contents)}/{total})")
        if len(contents) >= total:
            break
        page += 1
        time.sleep(REQUEST_DELAY_SEC)
    return contents


def fetch_detail(cntnts_no: str) -> dict | None:
    root = _get("gardenDtl", cntntsNo=cntnts_no)
    item = root.find(".//item")
    if item is None:
        return None
    return {child.tag: (child.text or "").strip() for child in item}


_ALIAS_RE = re.compile(r"\(\s*추천\s*유통명\s*[:：]\s*([^)]*)\)")


def clean_korean_name(raw: str | None) -> str | None:
    """'율마, 골드크리스터 (추천 유통명: 윌마)' → '율마'.

    API 국명 필드에는 이명이 콤마로 붙고 뒤에 추천 유통명이 괄호로 달린다.
    대표 이름 하나만 남기고, 괄호 앞이 비어 있으면 추천 유통명을 쓴다.
    """
    if not raw:
        return None
    alias_match = _ALIAS_RE.search(raw)
    alias = alias_match.group(1).strip() if alias_match else ""
    plain = _ALIAS_RE.sub("", raw)
    # 첫 이름만 (콤마 이후는 이명)
    primary = plain.split(",")[0].strip(" ,·").strip()
    if not primary:
        primary = alias.split(",")[0].strip()
    return primary or None


def to_row(cntnts_no: str, payload: dict) -> dict:
    scientific = payload.get("plntbneNm") or None
    # 국명 — cntntsSj(제목)를 우선, 없으면 유통명
    korean = clean_korean_name(payload.get("cntntsSj") or payload.get("distbNm"))

    return {
        "ko_name": korean,
        "sci_name": scientific,
        "sci_name_norm": normalize_scientific_name(scientific),
        # 광원은 라벨만 내려오고 값이 여러 개일 수 있어 콤마로 이어 보관
        "light_code": ",".join(reverse_lookup_all("LIGHT_CODE", payload.get("lighttdemanddoCodeNm")))
        or None,
        # 물주기는 계절별 4개 중 봄을 대표값으로 (기존 앱 로직과 동일)
        "water_cycle_code": payload.get("watercycleSprngCode") or None,
        "winter_temp_code": payload.get("winterLwetTpCode") or None,
        "growth_temp_code": payload.get("grwhTpCode") or None,
        "humidity_code": payload.get("hdCode") or None,
        "manage_level_code": payload.get("managelevelCode") or None,
        "toxic_desc": payload.get("toxctyInfo") or None,
        "payload": payload,
    }


def main() -> None:
    if not settings.nongsaro_api_key:
        raise SystemExit("NONGSARO_API_KEY 가 비어 있습니다. apps/api/.env 를 확인하세요.")

    db = session()
    try:
        with ingest_run(db, "RDA_INDOOR") as run:
            log("실내정원용 식물 목록 조회")
            contents = list_contents()
            numbers = list(contents)
            log(f"총 {len(numbers)}건 상세 조회 시작")

            saved = 0
            for index, cntnts_no in enumerate(numbers, start=1):
                payload = fetch_detail(cntnts_no)
                if payload is None:
                    log(f"  {cntnts_no}: 상세 없음 — skip")
                    continue
                # 목록에서만 얻는 썸네일 URL 을 payload 에 합쳐 보관 (merge 에서 image_url 로 사용)
                payload["_rtnThumbFileUrl"] = contents.get(cntnts_no) or ""
                values = to_row(cntnts_no, payload)
                values["ingest_run_id"] = run.run_id
                upsert(db, SrcRdaIndoor, cntnts_no, values)
                saved += 1
                if index % 25 == 0:
                    db.commit()
                    log(f"  {index}/{len(numbers)}")
                time.sleep(REQUEST_DELAY_SEC)

            db.commit()
            run.row_count = saved
            log(f"완료 — src_rda_indoor {saved}건")
    finally:
        db.close()


if __name__ == "__main__":
    main()