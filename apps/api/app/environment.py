"""날씨/대기질 오케스트레이션 — 모바일 라우트와 persona-chat 컨텍스트 빌더가 공용으로 쓴다."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import air_quality, region_data, weather
from .models import WeatherLog

SNAPSHOT_MIN_INTERVAL = timedelta(minutes=55)


@dataclass(frozen=True)
class CurrentEnvironment:
    weather_status: str
    air_quality_status: str
    temperature_c: float
    humidity_pct: float
    pm10_value: float | None
    pm25_value: float | None
    khai_value: float | None
    observed_at: datetime


def get_current_environment(region: region_data.Region) -> CurrentEnvironment:
    forecast = weather.fetch_ultra_short_forecast(region.kma_nx, region.kma_ny)
    weather_status = weather.classify_weather(forecast.sky, forecast.pty, forecast.temperature_c)

    station_name = air_quality.nearest_station(region.lat, region.lng)
    records = air_quality.fetch_realtime_measurements(station_name)
    latest = records[0] if records else None
    air_quality_status = (
        air_quality.classify_air_quality(latest.khai_grade) if latest else "정보없음"
    )

    return CurrentEnvironment(
        weather_status=weather_status,
        air_quality_status=air_quality_status,
        temperature_c=forecast.temperature_c,
        humidity_pct=forecast.humidity_pct,
        pm10_value=latest.pm10_value if latest else None,
        pm25_value=latest.pm25_value if latest else None,
        khai_value=latest.khai_value if latest else None,
        observed_at=datetime.now(timezone.utc),
    )


def has_any_snapshot(db: Session, user_id: int) -> bool:
    return (
        db.scalar(
            select(WeatherLog.weather_log_id).where(WeatherLog.user_id == user_id).limit(1)
        )
        is not None
    )


def record_snapshot(
    db: Session, user_id: int, location_name: str, current: CurrentEnvironment
) -> None:
    """사용자의 최신 row가 55분 이상 지났을 때만 새로 insert한다 — 스케줄러 없이
    앱 사용 패턴으로 "3시간마다" 취지를 근사한다."""
    latest = db.scalar(
        select(WeatherLog)
        .where(WeatherLog.user_id == user_id)
        .order_by(WeatherLog.observed_at.desc())
    )
    if latest is not None and current.observed_at - _as_utc(latest.observed_at) < SNAPSHOT_MIN_INTERVAL:
        return

    db.add(
        WeatherLog(
            user_id=user_id,
            location_name=location_name,
            observed_at=current.observed_at,
            temperature_c=current.temperature_c,
            humidity_pct=current.humidity_pct,
            pm10=current.pm10_value,
            pm25=current.pm25_value,
            weather_status=current.weather_status,
            air_quality_status=current.air_quality_status,
            source_api="kma+airkorea",
        )
    )
    db.commit()


def backfill_air_quality_history(
    db: Session, user_id: int, location_name: str, station_name: str
) -> None:
    """호출 전에 has_any_snapshot()으로 "이 사용자의 첫 조회"인지 반드시 먼저
    확인해야 한다 — 이 함수 자체는 무조건 insert한다."""
    records = air_quality.fetch_realtime_measurements(station_name)
    for record in records:
        db.add(
            WeatherLog(
                user_id=user_id,
                location_name=location_name,
                observed_at=_parse_measured_at(record.measured_at),
                pm10=record.pm10_value,
                pm25=record.pm25_value,
                air_quality_status=air_quality.classify_air_quality(record.khai_grade),
                source_api="airkorea",
            )
        )
    db.commit()


def query_history(db: Session, user_id: int, since: datetime) -> list[WeatherLog]:
    return list(
        db.scalars(
            select(WeatherLog)
            .where(WeatherLog.user_id == user_id, WeatherLog.observed_at >= since)
            .order_by(WeatherLog.observed_at.asc())
        )
    )


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _parse_measured_at(value: str) -> datetime:
    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)
