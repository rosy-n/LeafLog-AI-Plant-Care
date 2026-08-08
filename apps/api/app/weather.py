"""기상청 초단기예보(getUltraSrtFcst)·초단기실황(getUltraSrtNcst) 클라이언트."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta

import requests

from .config import settings

BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst"
NCST_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
REQUEST_TIMEOUT_SECONDS = 5
CACHE_TTL_SECONDS = 15 * 60
# 이번 시각(아직 진행 중이라 값이 더 갱신될 수 있는 시간)만 짧게 재확인하고,
# 이미 끝난 과거 시각은 값이 절대 안 바뀌므로 사실상 영구 캐시한다.
NCST_CURRENT_HOUR_TTL_SECONDS = 5 * 60


class WeatherFetchError(RuntimeError):
    """기상청 API 호출/파싱 실패."""


@dataclass(frozen=True)
class KmaForecast:
    sky: int
    pty: int
    temperature_c: float
    humidity_pct: float


def select_base_datetime(now: datetime) -> tuple[str, str]:
    """초단기예보는 매시 30분에 생성되고 45분부터 API로 제공된다.

    아직 이번 시각 자료가 나오기 전(분 < 45)이면 한 시간 전 자료를 쓴다 —
    timedelta로 빼기 때문에 자정을 넘어가는 경우도 날짜가 자동으로 맞춰진다.
    """
    reference = now if now.minute >= 45 else now - timedelta(hours=1)
    return reference.strftime("%Y%m%d"), reference.strftime("%H30")


def classify_weather(sky: int, pty: int, temperature_c: float) -> str:
    # PTY(강수형태)가 있으면 하늘상태보다 우선한다.
    if pty in (1, 4, 5, 6):
        return "비"
    if pty in (3, 7):
        return "눈"
    if pty == 2:
        # "비 또는 눈"은 모호 — 기온으로 폴백한다.
        return "눈" if temperature_c <= 0 else "비"
    if sky == 1:
        return "맑음"
    return "흐림"  # SKY 3(구름많음)/4(흐림) 모두 흐림으로 단순화


_cache: dict[tuple[int, int], tuple[float, KmaForecast]] = {}


def _cache_get(key: tuple[int, int]) -> KmaForecast | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    cached_at, forecast = entry
    if time.monotonic() - cached_at > CACHE_TTL_SECONDS:
        del _cache[key]
        return None
    return forecast


def fetch_ultra_short_forecast(nx: int, ny: int) -> KmaForecast:
    """홈 화면·페르소나챗·데이터탭이 짧은 시간 안에 중복 호출해도, 기상청 자료는
    매시간만 갱신되므로 TTL 캐시로 낭비를 막는다."""
    cache_key = (nx, ny)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    base_date, base_time = select_base_datetime(datetime.now())

    try:
        response = requests.get(
            BASE_URL,
            params={
                "serviceKey": settings.kma_api_key,
                "numOfRows": 100,
                "pageNo": 1,
                "dataType": "JSON",
                "base_date": base_date,
                "base_time": base_time,
                "nx": nx,
                "ny": ny,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise WeatherFetchError(f"기상청 API 요청에 실패했어: {exc}") from exc

    try:
        payload = response.json()
        header = payload["response"]["header"]
        if header["resultCode"] != "00":
            raise WeatherFetchError(f"기상청 API 오류: {header.get('resultMsg')}")
        items = payload["response"]["body"]["items"]["item"]
    except (ValueError, KeyError, TypeError) as exc:
        raise WeatherFetchError(f"기상청 응답 형식이 예상과 달라: {response.text[:500]}") from exc

    # 카테고리별로 가장 이른 예보 시각(=지금과 가장 가까운 시각) 값을 취한다.
    earliest: dict[str, tuple[str, str]] = {}
    for item in items:
        category = item["category"]
        fcst_key = (item["fcstDate"], item["fcstTime"])
        current = earliest.get(category)
        if current is None or fcst_key < (current[0], current[1]):
            earliest[category] = (item["fcstDate"], item["fcstTime"], item["fcstValue"])  # type: ignore[assignment]

    try:
        sky = int(earliest["SKY"][2])
        pty = int(earliest["PTY"][2])
        temperature_c = float(earliest["T1H"][2])
        humidity_pct = float(earliest["REH"][2])
    except (KeyError, ValueError) as exc:
        raise WeatherFetchError("기상청 응답에 필요한 항목(SKY/PTY/T1H/REH)이 없어.") from exc

    forecast = KmaForecast(sky=sky, pty=pty, temperature_c=temperature_c, humidity_pct=humidity_pct)
    _cache[cache_key] = (time.monotonic(), forecast)
    return forecast


@dataclass(frozen=True)
class HourlyObservation:
    observed_at: datetime  # 정시(로컬시간) 기준
    temperature_c: float
    humidity_pct: float


def _fetch_ultra_short_observation(
    nx: int, ny: int, base_date: str, base_time: str
) -> HourlyObservation | None:
    """지정한 정시(예: "0600")에 실제 관측된 기온/습도를 조회한다 — 예보가 아니라 실측값.

    아직 발표 전(미래 시각을 요청했거나 결측)이면 None을 반환한다."""
    try:
        response = requests.get(
            NCST_URL,
            params={
                "serviceKey": settings.kma_api_key,
                "numOfRows": 10,
                "pageNo": 1,
                "dataType": "JSON",
                "base_date": base_date,
                "base_time": base_time,
                "nx": nx,
                "ny": ny,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise WeatherFetchError(f"기상청 실황 조회에 실패했어: {exc}") from exc

    try:
        payload = response.json()
        header = payload["response"]["header"]
        if header["resultCode"] == "03":  # NODATA_ERROR — 아직 관측/발표되지 않은 시각
            return None
        if header["resultCode"] != "00":
            raise WeatherFetchError(f"기상청 API 오류: {header.get('resultMsg')}")
        items = payload["response"]["body"]["items"]["item"]
    except (ValueError, KeyError, TypeError) as exc:
        raise WeatherFetchError(f"기상청 실황 응답 형식이 예상과 달라: {response.text[:500]}") from exc

    values = {item["category"]: item["obsrValue"] for item in items}
    try:
        temperature_c = float(values["T1H"])
        humidity_pct = float(values["REH"])
    except (KeyError, ValueError):
        return None

    observed_at = datetime.strptime(base_date + base_time, "%Y%m%d%H%M")
    return HourlyObservation(
        observed_at=observed_at, temperature_c=temperature_c, humidity_pct=humidity_pct
    )


# (nx, ny, base_date, base_time) -> (조회 시각, 관측값 또는 None, 다시 안 바뀔 확정값인지)
_ncst_cache: dict[tuple[int, int, str, str], tuple[float, HourlyObservation | None, bool]] = {}


def _fetch_hourly_observation_cached(
    nx: int, ny: int, base_date: str, base_time: str, *, is_final: bool
) -> HourlyObservation | None:
    key = (nx, ny, base_date, base_time)
    cached = _ncst_cache.get(key)
    if cached is not None:
        cached_at, observation, cached_is_final = cached
        if cached_is_final or time.monotonic() - cached_at <= NCST_CURRENT_HOUR_TTL_SECONDS:
            return observation

    observation = _fetch_ultra_short_observation(nx, ny, base_date, base_time)
    _ncst_cache[key] = (time.monotonic(), observation, is_final)
    return observation


def fetch_today_hourly_series(nx: int, ny: int) -> list[HourlyObservation]:
    """오늘 0시부터 지금까지, 정시마다 실제 관측된 기온/습도를 모아 반환한다.

    이미 끝난 시각은 캐시에서 그대로 재사용해 기상청을 다시 부르지 않고(값이 절대
    안 바뀌므로), 아직 진행 중인 이번 시각만 짧은 TTL로 재확인한다. 여러 사용자가
    같은 지역을 같은 시간대에 조회해도 이 캐시를 공유하므로, 실제로 기상청을 부르는
    건 그 지역에서 그 시각을 "처음" 조회하는 요청 하나뿐이다.
    """
    now = datetime.now()
    # 초단기실황은 매시 10분 이후에 제공된다 — 아직 발표 안 된 이번 시각은 건너뛴다.
    latest_available_hour = now.replace(minute=0, second=0, microsecond=0)
    if now.minute < 10:
        latest_available_hour -= timedelta(hours=1)

    hours: list[datetime] = []
    cursor = now.replace(hour=0, minute=0, second=0, microsecond=0)
    while cursor <= latest_available_hour:
        hours.append(cursor)
        cursor += timedelta(hours=1)

    def _fetch(hour: datetime) -> HourlyObservation | None:
        base_date = hour.strftime("%Y%m%d")
        base_time = hour.strftime("%H00")
        is_final = hour < latest_available_hour
        try:
            return _fetch_hourly_observation_cached(nx, ny, base_date, base_time, is_final=is_final)
        except WeatherFetchError:
            return None  # 한 시간대 조회 실패로 하루 전체 그래프를 못 그리게 하지 않는다.

    if not hours:
        return []

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(_fetch, hours))

    return [observation for observation in results if observation is not None]
