"""국가생물종지식정보시스템(국립수목원 오픈API) → src_nature_taxon.

국명/영문명/학명, 과·속, 자생지, 원산지, 분포의 정본 소스.

현재 상태: API 키 미발급. NATURE_KNA_API_KEY 가 비어 있으면 아무것도 하지 않고 종료한다.
키를 발급받으면 .env 에 넣고 아래 ENDPOINT/필드 매핑만 실제 응답에 맞춰 확인하면 된다.
(국립수목원 API 는 서비스별로 응답 태그가 달라 실물 응답 확인 후 확정 필요)

실행: cd apps/api && ./.venv/Scripts/python.exe -m scripts.ingest.nature_kna
"""
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from app.config import settings
from app.models import SrcNatureTaxon

from ._common import ingest_run, log, normalize_scientific_name, session, upsert

# 국립수목원 국가생물종지식정보시스템 오픈API (식물도감 검색)
ENDPOINT = "http://api.nature.go.kr/openapi/service/rest/PlantService"
LIST_OPERATION = "plantSearch"
DETAIL_OPERATION = "plantInfo"
PAGE_SIZE = 100
REQUEST_DELAY_SEC = 0.3

# 응답 태그 → src_nature_taxon 컬럼. 키 발급 후 실제 응답으로 검증할 것.
FIELD_MAP = {
    "ko_name": ["korNm", "plantGnrlNm", "korNmA"],
    "en_name": ["engNm", "engNmA"],
    "sci_name": ["scinm", "sctnNm", "plantSpecsScnm"],
    "family_name": ["familyKorNm", "familyNm"],
    "genus_name": ["genusKorNm", "genusNm"],
    "native_habitat": ["habitat", "hbtatNm", "distbNm"],
    "origin_country": ["orgplce", "orgplceNm", "nativeNm"],
    "distribution": ["distb", "distbInfo", "spcsDistbInfo"],
}


def _get(operation: str, **params) -> ET.Element:
    params["serviceKey"] = settings.nature_kna_api_key
    url = f"{ENDPOINT}/{operation}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as response:
        root = ET.fromstring(response.read())
    result_code = (root.findtext(".//resultCode") or "").strip()
    if result_code and result_code not in ("00", "0000"):
        raise RuntimeError(f"국립수목원 API 오류 ({result_code}) — {root.findtext('.//resultMsg')}")
    return root


def _pick(payload: dict, field: str) -> str | None:
    for tag in FIELD_MAP[field]:
        value = (payload.get(tag) or "").strip()
        if value:
            return value
    return None


def main() -> None:
    if not settings.nature_kna_api_key:
        log("NATURE_KNA_API_KEY 가 비어 있어 nature_kna 적재를 건너뜁니다.")
        log("  → 분류/원산지/분포는 KFS_STD·RDA_INDOOR 값으로만 채워집니다.")
        return

    db = session()
    try:
        with ingest_run(db, "NATURE_KNA") as run:
            saved = 0
            page = 1
            while True:
                root = _get(LIST_OPERATION, numOfRows=PAGE_SIZE, pageNo=page)
                items = root.findall(".//item")
                if not items:
                    break
                for item in items:
                    payload = {child.tag: (child.text or "").strip() for child in item}
                    sci_name = _pick(payload, "sci_name")
                    ko_name = _pick(payload, "ko_name")
                    source_key = (
                        payload.get("plantPilbkNo")
                        or payload.get("no")
                        or sci_name
                        or ko_name
                    )
                    if not source_key:
                        continue
                    upsert(
                        db,
                        SrcNatureTaxon,
                        str(source_key)[:200],
                        {
                            "ko_name": ko_name,
                            "en_name": _pick(payload, "en_name"),
                            "sci_name": sci_name,
                            "sci_name_norm": normalize_scientific_name(sci_name),
                            "family_name": _pick(payload, "family_name"),
                            "genus_name": _pick(payload, "genus_name"),
                            "native_habitat": _pick(payload, "native_habitat"),
                            "origin_country": _pick(payload, "origin_country"),
                            "distribution": _pick(payload, "distribution"),
                            "payload": payload,
                            "ingest_run_id": run.run_id,
                        },
                    )
                    saved += 1

                db.commit()
                total = int((root.findtext(".//totalCount") or "0").strip() or 0)
                log(f"  page {page}: 누적 {saved}/{total}")
                if total and saved >= total:
                    break
                page += 1
                time.sleep(REQUEST_DELAY_SEC)

            run.row_count = saved
            log(f"완료 — src_nature_taxon {saved}건")
    finally:
        db.close()


if __name__ == "__main__":
    main()