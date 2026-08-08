"""에어코리아(한국환경공단) 대기질 API 클라이언트."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime

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


@dataclass(frozen=True)
class DailyAirQualityObservation:
    date: date
    avg_pm10: float | None
    avg_pm25: float | None


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


_daily_cache: dict[tuple[str, date, date], tuple[float, list[DailyAirQualityObservation]]] = {}


DAILY_SERIES_REQUEST_TIMEOUT_SECONDS = 15  # MONTH 구간은 페이로드가 커서 realtime 조회보다 오래 걸리고, 가끔 504도 난다


def fetch_daily_series(station_name: str, start: date, end: date) -> list[DailyAirQualityObservation]:
    """start~end(포함) 구간의 날짜별 평균 pm10/pm25. ASOS와 달리 에어코리아 실시간
    측정 API는 일별 집계를 직접 안 주므로, dataTerm=MONTH로 시간별 원시값을 받아
    날짜별로 묶어 평균 낸다. 주/월 탭 모두 30일 이내라 MONTH 한 번 조회로 충분하다."""
    cache_key = (station_name, start, end)
    cached = _daily_cache.get(cache_key)
    if cached is not None:
        cached_at, records = cached
        if time.monotonic() - cached_at <= CACHE_TTL_SECONDS:
            return records
        del _daily_cache[cache_key]

    # 필요한 구간만큼만 요청 — "주" 탭인데 굳이 한 달치(743행)를 다 받아올 필요는 없다.
    num_of_rows = min(1000, ((end - start).days + 1) * 24 + 48)

    try:
        response = requests.get(
            REALTIME_URL,
            params={
                "serviceKey": settings.airkorea_api_key,
                "returnType": "json",
                "stationName": station_name,
                "dataTerm": "MONTH",
                "ver": "1.3",
                "numOfRows": num_of_rows,
                "pageNo": 1,
            },
            timeout=DAILY_SERIES_REQUEST_TIMEOUT_SECONDS,
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

    pm10_by_date: dict[date, list[float]] = defaultdict(list)
    pm25_by_date: dict[date, list[float]] = defaultdict(list)
    for item in items:
        raw_time = item.get("dataTime")
        if not raw_time:
            continue
        try:
            obs_date = datetime.strptime(raw_time, "%Y-%m-%d %H:%M").date()
        except ValueError:
            continue
        if obs_date < start or obs_date > end:
            continue
        pm10_value = _to_float(item.get("pm10Value"))
        pm25_value = _to_float(item.get("pm25Value"))
        if pm10_value is not None:
            pm10_by_date[obs_date].append(pm10_value)
        if pm25_value is not None:
            pm25_by_date[obs_date].append(pm25_value)

    all_dates = sorted(set(pm10_by_date) | set(pm25_by_date))
    records = [
        DailyAirQualityObservation(
            date=d,
            avg_pm10=sum(pm10_by_date[d]) / len(pm10_by_date[d]) if d in pm10_by_date else None,
            avg_pm25=sum(pm25_by_date[d]) / len(pm25_by_date[d]) if d in pm25_by_date else None,
        )
        for d in all_dates
    ]

    _daily_cache[cache_key] = (time.monotonic(), records)
    return records
