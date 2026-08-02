"""기상청 초단기예보(getUltraSrtFcst) 클라이언트."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta

import requests

from .config import settings

BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst"
REQUEST_TIMEOUT_SECONDS = 5
CACHE_TTL_SECONDS = 15 * 60


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
