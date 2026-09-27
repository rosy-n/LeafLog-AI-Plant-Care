"""에어코리아(한국환경공단) 대기질 API 클라이언트."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime

import requests
from pyproj import Transformer

from .config import settings

NEARBY_STATION_URL = "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList"
REALTIME_URL = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
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
            allow_redirects=False,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise AirQualityFetchError("에어코리아 측정소 조회에 실패했어.") from None

    try:
        payload = response.json()
        header = payload["response"]["header"]
        if header["resultCode"] != "00":
            raise AirQualityFetchError("에어코리아 API에서 정상 자료를 받지 못했어.")
        items = payload["response"]["body"]["items"]
        station_name = items[0]["stationName"]
    except (ValueError, KeyError, TypeError, IndexError) as exc:
        raise AirQualityFetchError(
            "에어코리아 측정소 응답 형식이 예상과 달라."
        ) from None

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
            allow_redirects=False,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise AirQualityFetchError("에어코리아 측정정보 조회에 실패했어.") from None

    try:
        payload = response.json()
        header = payload["response"]["header"]
        if header["resultCode"] != "00":
            raise AirQualityFetchError("에어코리아 API에서 정상 자료를 받지 못했어.")
        items = payload["response"]["body"]["items"]
    except (ValueError, KeyError, TypeError) as exc:
        raise AirQualityFetchError(
            "에어코리아 측정정보 응답 형식이 예상과 달라."
        ) from None

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


# 측정소별 한 달치 날짜별 평균 — 주/월 탭이 같은 원자료(dataTerm=MONTH)를 잘라 쓰므로
# 기간이 아니라 측정소로 캐시한다. 기간 키로 두면 날짜가 바뀌거나 기간 계산을 고칠 때마다
# 캐시가 비어 느린 원자료 조회를 다시 맞는다.
_daily_cache: dict[str, tuple[float, list[DailyAirQualityObservation]]] = {}

# MONTH 원자료(약 743행)는 보통 1~2초면 오지만 가끔 20초 넘게 응답이 없다. 앱의 요청 제한
# (15초) 안에 날씨라도 먼저 돌려주려고 짧게 끊고, 실패하면 이전 캐시로 대신한다.
DAILY_SERIES_REQUEST_TIMEOUT_SECONDS = 8
MONTH_ROWS = 1000


def _fetch_month_daily(station_name: str) -> list[DailyAirQualityObservation]:
    """측정소의 최근 한 달 시간별 원시값을 받아 날짜별 평균으로 묶는다."""
    try:
        response = requests.get(
            REALTIME_URL,
            params={
                "serviceKey": settings.airkorea_api_key,
                "returnType": "json",
                "stationName": station_name,
                "dataTerm": "MONTH",
                "ver": "1.3",
                "numOfRows": MONTH_ROWS,
                "pageNo": 1,
            },
            timeout=DAILY_SERIES_REQUEST_TIMEOUT_SECONDS,
            allow_redirects=False,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise AirQualityFetchError("에어코리아 측정정보 조회에 실패했어.") from None

    try:
        payload = response.json()
        header = payload["response"]["header"]
        if header["resultCode"] != "00":
            raise AirQualityFetchError("에어코리아 API에서 정상 자료를 받지 못했어.")
        items = payload["response"]["body"]["items"]
    except (ValueError, KeyError, TypeError) as exc:
        raise AirQualityFetchError(
            "에어코리아 측정정보 응답 형식이 예상과 달라."
        ) from None

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
        pm10_value = _to_float(item.get("pm10Value"))
        pm25_value = _to_float(item.get("pm25Value"))
        if pm10_value is not None:
            pm10_by_date[obs_date].append(pm10_value)
        if pm25_value is not None:
            pm25_by_date[obs_date].append(pm25_value)

    all_dates = sorted(set(pm10_by_date) | set(pm25_by_date))
    return [
        DailyAirQualityObservation(
            date=d,
            avg_pm10=sum(pm10_by_date[d]) / len(pm10_by_date[d]) if d in pm10_by_date else None,
            avg_pm25=sum(pm25_by_date[d]) / len(pm25_by_date[d]) if d in pm25_by_date else None,
        )
        for d in all_dates
    ]


def fetch_daily_series(station_name: str, start: date, end: date) -> list[DailyAirQualityObservation]:
    """start~end(포함) 구간의 날짜별 평균 pm10/pm25. ASOS와 달리 에어코리아 실시간
    측정 API는 일별 집계를 직접 안 주므로, dataTerm=MONTH로 시간별 원시값을 받아
    날짜별로 묶어 평균 낸다. 주/월 탭 모두 한 달 이내라 MONTH 한 번 조회로 충분하다."""
    cached = _daily_cache.get(station_name)
    if cached is not None and time.monotonic() - cached[0] <= CACHE_TTL_SECONDS:
        records = cached[1]
    else:
        try:
            records = _fetch_month_daily(station_name)
        except AirQualityFetchError:
            if cached is None:
                raise
            records = cached[1]  # 에어코리아가 느리거나 실패하면 지난 캐시로 대신한다
        else:
            _daily_cache[station_name] = (time.monotonic(), records)

    return [r for r in records if start <= r.date <= end]
