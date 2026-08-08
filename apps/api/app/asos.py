"""기상청 지상(종관, ASOS) 일자료 조회서비스(AsosDalyInfoService) 클라이언트.

주/월 탭처럼 "하루에 한 점"이면 충분한 그래프에 쓴다. 이 서비스는 전일(D-1)
자료까지만 제공하고(그것도 11시 이후에나 조회 가능), 오늘 데이터는 절대 주지
않는다 — "일(오늘)" 탭은 이 모듈이 아니라 weather.fetch_today_hourly_series를
쓴다.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import requests

from .config import settings

BASE_URL = "http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"
REQUEST_TIMEOUT_SECONDS = 10

# (지점번호, 지점명, 위도, 경도) — 기상청 공식 활용가이드 첨부 지점 코드표 그대로.
# 위경도는 이 표에 없어서, 이미 검증해둔 region_data.REGIONS와 지점명을 매칭해
# 가져왔다(직접 새로 추측한 좌표 없음). 매칭 스크립트와 대조 결과는 커밋 메시지 참고.
STATIONS: list[tuple[int, str, float, float]] = [
    (90, "속초", 38.20725, 128.59275),
    (93, "북춘천", 37.88048, 127.72776),
    (95, "철원", 38.24391, 127.44522),
    (98, "동두천", 37.91889, 127.06897),
    (99, "파주", 37.75952, 126.77772),
    (100, "대관령", 37.37028, 128.39306),
    (101, "춘천", 37.88048, 127.72776),
    (102, "백령도", 37.23361, 126.12305),
    (104, "북강릉", 37.7519, 128.87825),
    (105, "강릉", 37.7519, 128.87825),
    (106, "동해", 37.52345, 129.11357),
    (108, "서울", 37.55986, 126.99398),
    (112, "인천", 37.47353, 126.62151),
    (114, "원주", 37.32104, 127.92132),
    (115, "울릉도", 37.50442, 130.86084),
    (119, "수원", 37.28586, 127.00993),
    (121, "영월", 37.1833, 128.4615),
    (127, "충주", 37.01791, 127.87713),
    (129, "서산", 36.78518, 126.46568),
    (130, "울진", 36.91968, 129.31966),
    (131, "청주", 36.63722, 127.48972),
    (133, "대전", 36.28044, 127.41093),
    (135, "추풍령", 36.1645, 127.79018),
    (136, "안동", 36.56636, 128.72275),
    (137, "상주", 36.41667, 128.16667),
    (138, "포항", 36.08333, 129.36667),
    (140, "군산", 35.93583, 126.68338),
    (143, "대구", 35.86678, 128.59538),
    (146, "전주", 35.82194, 127.14889),
    (152, "울산", 35.5684, 129.33226),
    (155, "창원", 35.27533, 128.65152),
    (156, "광주", 35.14592, 126.9232),
    (159, "부산", 35.10594, 129.03331),
    (162, "통영", 34.8736, 128.39709),
    (165, "목포", 34.80826, 126.3942),
    (168, "여수", 34.77647, 127.64253),
    (169, "흑산도", 34.8262, 126.10863),
    (170, "완도", 34.31182, 126.73845),
    (172, "고창", 35.43483, 126.70047),
    (174, "순천", 34.98951, 127.39551),
    (177, "홍성", 36.56705, 126.62626),
    (184, "제주", 33.50972, 126.52194),
    (185, "고산", 33.50972, 126.52194),
    (188, "성산", 33.29307, 126.49748),
    (189, "서귀포", 33.29307, 126.49748),
    (192, "진주", 35.20445, 128.12408),
    (201, "강화", 37.74722, 126.48556),
    (202, "양평", 37.4888, 127.49222),
    (203, "이천", 37.27917, 127.4425),
    (211, "인제", 38.04416, 128.27876),
    (212, "홍천", 37.6918, 127.8857),
    (216, "태백", 37.1652, 128.9857),
    (217, "정선군", 37.38911, 128.72995),
    (221, "제천", 37.06206, 128.14065),
    (226, "보은", 36.49489, 127.72865),
    (232, "천안", 36.80488, 127.19431),
    (235, "보령", 36.35649, 126.59444),
    (236, "부여", 36.26257, 126.85802),
    (238, "금산", 36.13381, 127.48062),
    (239, "세종", 36.48, 127.289),
    (243, "부안", 35.7, 126.66667),
    (244, "임실", 35.6066, 127.2301),
    (245, "정읍", 35.6, 126.91667),
    (247, "남원", 35.42966, 127.43208),
    (248, "장수", 35.66667, 127.53333),
    (251, "고창군", 35.43483, 126.70047),
    (252, "영광군", 35.28711, 126.43616),
    (253, "김해시", 35.25, 128.86667),
    (254, "순창군", 35.41667, 127.16667),
    (255, "북창원", 35.27533, 128.65152),
    (257, "양산시", 35.39866, 129.03612),
    (258, "보성군", 34.81426, 127.15765),
    (259, "강진군", 34.61787, 126.76758),
    (260, "장흥", 34.66667, 126.91667),
    (261, "해남", 34.54047, 126.5187),
    (262, "고흥", 34.58333, 127.33333),
    (263, "의령군", 35.3923, 128.26917),
    (264, "함양군", 35.55233, 127.71196),
    (266, "광양시", 35.02926, 127.64882),
    (268, "진도군", 34.41018, 126.1688),
    (271, "봉화", 36.88951, 128.73573),
    (272, "영주", 36.87459, 128.58631),
    (273, "문경", 36.59458, 128.19946),
    (276, "청송군", 36.43288, 129.05159),
    (277, "영덕", 36.48125, 129.31078),
    (278, "의성", 36.36122, 128.61517),
    (279, "구미", 36.21009, 128.35442),
    (281, "영천", 36.0, 129.0),
    (283, "경주시", 35.84278, 129.21167),
    (284, "거창", 35.68735, 127.91142),
    (285, "합천", 35.5741, 128.13841),
    (288, "밀양", 35.49333, 128.74889),
    (289, "산청", 35.36625, 127.87065),
    (294, "거제", 34.9, 128.66666),
    (295, "남해", 34.80433, 127.92708),
]


class AsosFetchError(RuntimeError):
    """ASOS 일자료 API 호출/파싱 실패."""


@dataclass(frozen=True)
class DailyObservation:
    date: date
    avg_temperature_c: float | None
    avg_humidity_pct: float | None


def nearest_station_id(lat: float, lng: float) -> int:
    """한국 영토 규모에서는 위경도 단순 유클리드 거리로도 최근접 지점 순위가
    충분히 정확하다 (region_data.nearest_region과 같은 근거)."""
    return min(STATIONS, key=lambda s: (s[2] - lat) ** 2 + (s[3] - lng) ** 2)[0]


def fetch_daily_series(stn_id: int, start: date, end: date) -> list[DailyObservation]:
    try:
        response = requests.get(
            BASE_URL,
            params={
                "serviceKey": settings.kma_api_key,
                "numOfRows": 100,
                "pageNo": 1,
                "dataType": "JSON",
                "dataCd": "ASOS",
                "dateCd": "DAY",
                "startDt": start.strftime("%Y%m%d"),
                "endDt": end.strftime("%Y%m%d"),
                "stnIds": stn_id,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise AsosFetchError(f"ASOS 일자료 조회에 실패했어: {exc}") from exc

    try:
        payload = response.json()
        header = payload["response"]["header"]
        if header["resultCode"] == "03":  # NODATA_ERROR
            return []
        if header["resultCode"] != "00":
            raise AsosFetchError(f"ASOS API 오류: {header.get('resultMsg')}")
        body = payload["response"]["body"]
        if not body.get("items"):
            return []
        items = body["items"]["item"]
    except (ValueError, KeyError, TypeError) as exc:
        raise AsosFetchError(f"ASOS 응답 형식이 예상과 달라: {response.text[:500]}") from exc

    records: list[DailyObservation] = []
    for item in items:
        tm = item.get("tm")
        if not tm:
            continue
        try:
            obs_date = date.fromisoformat(tm)
        except ValueError:
            continue
        records.append(
            DailyObservation(
                date=obs_date,
                avg_temperature_c=_to_float(item.get("avgTa")),
                avg_humidity_pct=_to_float(item.get("avgRhm")),
            )
        )
    return records


def _to_float(value: object) -> float | None:
    if value in (None, "-", ""):
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
