"""에어코리아(한국환경공단) 대기질 API 클라이언트."""

from __future__ import annotations

import time
from dataclasses import dataclass

import requests
from pyproj import Transformer

from .config import settings

NEARBY_STATION_URL = "http://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList"
REALTIME_URL = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
REQUEST_TIMEOUT_SECONDS = 5
CACHE_TTL_SECONDS = 15 * 60

# 에어코리아는 TM 중부원점(Bessel, EPSG:2097) 좌표를 쓴다 — 위경도(EPSG:4326)를
# 요청 시점에 변환해서 넘긴다. always_xy=True면 transform 입력/출력이 (lon, lat)/(x, y) 순서.
_TO_TM = Transformer.from_crs("EPSG:4326", "EPSG:2097", always_xy=True)


class AirQualityFetchError(RuntimeError):
    """에어코리아 API 호출/파싱 실패."""


@dataclass(frozen=True)
class AirQualityRecord:
    measured_at: str  # dataTime 원문 그대로, 예: "2024-01-01 15:00"
    khai_grade: int | None
    khai_value: float | None
    pm10_value: float | None
    pm25_value: float | None


def latlon_to_tm(lat: float, lon: float) -> tuple[float, float]:
    tm_x, tm_y = _TO_TM.transform(lon, lat)
    return tm_x, tm_y


def classify_air_quality(khai_grade: int | None) -> str:
    return {1: "좋음", 2: "보통", 3: "나쁨", 4: "매우나쁨"}.get(khai_grade, "정보없음")


_station_cache: dict[tuple[float, float], tuple[float, str]] = {}


def nearest_station(lat: float, lon: float) -> str:
    # 위경도를 소수 3자리(약 100m) 단위로 반올림해 캐시 키로 사용 — 같은 동네를
    # 반복 조회할 때 매번 API를 부르지 않기 위함.
    cache_key = (round(lat, 3), round(lon, 3))
    cached = _station_cache.get(cache_key)
    if cached is not None:
        cached_at, station_name = cached
        if time.monotonic() - cached_at <= CACHE_TTL_SECONDS:
            return station_name
        del _station_cache[cache_key]

    tm_x, tm_y = latlon_to_tm(lat, lon)

    try:
        response = requests.get(
            NEARBY_STATION_URL,
            params={
                "serviceKey": settings.airkorea_api_key,
                "returnType": "json",
                "tmX": tm_x,
                "tmY": tm_y,
                "ver": "1.1",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise AirQualityFetchError(f"에어코리아 측정소 조회에 실패했어: {exc}") from exc

    try:
        payload = response.json()
        header = payload["response"]["header"]
        if header["resultCode"] != "00":
            raise AirQualityFetchError(f"에어코리아 API 오류: {header.get('resultMsg')}")
        items = payload["response"]["body"]["items"]
        station_name = items[0]["stationName"]
    except (ValueError, KeyError, TypeError, IndexError) as exc:
        raise AirQualityFetchError(
            f"에어코리아 측정소 응답 형식이 예상과 달라: {response.text[:500]}"
        ) from exc

    _station_cache[cache_key] = (time.monotonic(), station_name)
    return station_name


def _to_float(value: object) -> float | None:
    if value in (None, "-", ""):
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


_measurement_cache: dict[str, tuple[float, list[AirQualityRecord]]] = {}


def fetch_realtime_measurements(station_name: str) -> list[AirQualityRecord]:
    """최근 ~24시간 시간별 측정값(가장 최신이 0번째)을 반환한다."""
    cached = _measurement_cache.get(station_name)
    if cached is not None:
        cached_at, records = cached
        if time.monotonic() - cached_at <= CACHE_TTL_SECONDS:
            return records
        del _measurement_cache[station_name]

    try:
        response = requests.get(
            REALTIME_URL,
            params={
                "serviceKey": settings.airkorea_api_key,
                "returnType": "json",
                "stationName": station_name,
                "dataTerm": "DAILY",
                "ver": "1.3",
                "numOfRows": 24,
                "pageNo": 1,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise AirQualityFetchError(f"에어코리아 측정정보 조회에 실패했어: {exc}") from exc

    try:
        payload = response.json()
        header = payload["response"]["header"]
        if header["resultCode"] != "00":
            raise AirQualityFetchError(f"에어코리아 API 오류: {header.get('resultMsg')}")
        items = payload["response"]["body"]["items"]
    except (ValueError, KeyError, TypeError) as exc:
        raise AirQualityFetchError(
            f"에어코리아 측정정보 응답 형식이 예상과 달라: {response.text[:500]}"
        ) from exc

    records: list[AirQualityRecord] = []
    for item in items:
        pm10_value = _to_float(item.get("pm10Value"))
        pm25_value = _to_float(item.get("pm25Value"))
        if pm10_value is None and pm25_value is None:
            continue  # 미세먼지 값 자체가 결측이면 평균에도 못 쓰니 건너뜀

        # khaiGrade(통합대기환경지수)는 가장 최근 시간대일수록 아직 산출 전이라
        # "-"/None일 수 있다 — 그래도 pm10/pm25는 이미 나와 있을 수 있으므로,
        # 등급이 없다고 레코드 전체(=이 시간대의 미세먼지 값)를 버리지 않는다.
        khai_grade_raw = item.get("khaiGrade")
        try:
            khai_grade = int(khai_grade_raw) if khai_grade_raw not in (None, "-", "") else None
        except (TypeError, ValueError):
            khai_grade = None

        records.append(
            AirQualityRecord(
                measured_at=item.get("dataTime", ""),
                khai_grade=khai_grade,
                khai_value=_to_float(item.get("khaiValue")),
                pm10_value=pm10_value,
                pm25_value=pm25_value,
            )
        )

    _measurement_cache[station_name] = (time.monotonic(), records)
    return records
