"""토양 수분 — raw 전압(mV)만 저장하고, % 는 이 모듈이 환산한다.

soil_reading 에는 센서가 잰 전압(raw_mv)과 그때의 보정값만 들어간다. % 를
저장하지 않는 이유는 그것이 보정값에 의존하는 파생값이기 때문이다 — 흙 종류와
센서를 꽂은 깊이가 달라지면 보정을 다시 잡게 되는데, % 를 저장해 두면 그
순간 과거 데이터를 되살릴 방법이 없다.

환산 규칙과 상태 구분은 이 모듈이 단일 출처다 (app/affinity.py 와 같은 결).
앱은 값을 다시 정의하지 않고 API 응답(SoilStatus)을 그대로 표시한다.

센서는 정전용량식(DFRobot SEN0308)이고 ESP32-S3 의 ADC1 로 읽는다. 젖을수록
전압이 내려가서 보통 wet_mv < dry_mv 지만, 아래 환산식은 두 값의 대소에
의존하지 않는다 — 젖을 때 전압이 오르는 센서로 바꿔도 보정값만 다시 잡으면 된다.
"""

from __future__ import annotations

# ESP32-S3 ADC 가 12dB 감쇠에서 읽어낼 수 있는 상한. soil_reading.raw_mv 의 CHECK 와 같다.
ADC_MAX_MV = 3300

# 보정 전 기본값 — SEN0308 을 3.3V 로 물리고 실제 화분에서 잰 값에 여유를 준 것이다.
# care_schedule.interval_source 의 'DEFAULT' 와 같은 성격이라, 화분마다 다시
# 잡는 것이 원칙이고 이 값은 보정 전에 화면이 비어 보이지 않게 하는 용도다.
#
# 같은 센서·같은 화분인데도 잴 때마다 값이 흔들린다 (실측 2회):
#   1회차  마른 흙 2145 / 젖은 흙 1370
#   2회차  마른 흙 2060 / 젖은 흙 1320
# 흙이 마르는 정도, 꽂은 깊이, 온도가 다 영향을 준다. 그래서 이 기본값은
# 두 회차를 모두 품도록 넉넉히 잡았고 (여기서 6~96% 로 환산된다),
# 정확한 값은 기기마다 PATCH /api/soil-sensors/{id}/calibration 으로 넣는다.
# 측정값에 보정 스냅샷을 같이 저장하는 것도 이 흔들림 때문이다.
DEFAULT_DRY_MV = 2200
DEFAULT_WET_MV = 1280

# dry_mv 보다 이만큼 더 높으면 흙에 꽂혀 있지 않다고 본다.
# 공기 중 실측이 약 2300mV, 마른 흙이 약 2145mV 로 둘의 간격이 155mV 밖에 안 된다.
# 흙은 마를수록 공기 값에 수렴하므로 "센서 이탈" 과 "극도로 마름" 은 이 센서로
# 끝내 구분할 수 없다 — 둘 다 사용자가 화분을 확인해야 하는 상황이라 CHECK 로 합친다.
UNPLUGGED_MARGIN_MV = 50

# 상태 구분 경계 (%, 위 경계 포함). 물주기 판단에 쓴다.
VERY_DRY_MAX_PCT = 20
DRY_MAX_PCT = 40
OK_MAX_PCT = 80

# 이 아래로 떨어지면 물 줄 때가 됐다고 본다 (VERY_DRY / DRY 구간).
WATER_NEEDED_PCT = DRY_MAX_PCT


def is_calibrated(dry_mv: int | None, wet_mv: int | None) -> bool:
    """두 보정값이 다 있고 서로 달라야 환산이 가능하다."""
    return dry_mv is not None and wet_mv is not None and dry_mv != wet_mv


def resolve_calibration(dry_mv: int | None, wet_mv: int | None) -> tuple[int, int]:
    """보정값이 없으면 기본값으로 메운다. 둘 중 하나만 있어도 기본값 쌍을 쓴다."""
    if is_calibrated(dry_mv, wet_mv):
        return int(dry_mv), int(wet_mv)  # type: ignore[arg-type]
    return DEFAULT_DRY_MV, DEFAULT_WET_MV


def moisture_percent(raw_mv: int, dry_mv: int | None, wet_mv: int | None) -> int:
    """수분 % — dry_mv 가 0%, wet_mv 가 100%.

    자르지 않는다. 보정할 때보다 더 마르면 음수, 더 젖으면 100 을 넘는다.
    화면에 그대로 쓰지 말고 display_percent() 를 거친다 — 범위를 벗어났다는
    사실 자체가 "보정을 다시 잡을 때가 됐다" 는 신호라 내부에서는 살려 둔다.
    """
    dry, wet = resolve_calibration(dry_mv, wet_mv)
    return round((raw_mv - dry) * 100 / (wet - dry))


def display_percent(raw_mv: int, dry_mv: int | None, wet_mv: int | None) -> int:
    """앱에 보여줄 0~100 값."""
    return max(0, min(100, moisture_percent(raw_mv, dry_mv, wet_mv)))


def status_for(raw_mv: int, dry_mv: int | None, wet_mv: int | None) -> str:
    """CHECK / VERY_DRY / DRY / OK / WET.

    CHECK 는 센서가 흙 밖으로 나왔거나 흙이 보정 범위를 넘어 말랐다는 뜻이다
    (UNPLUGGED_MARGIN_MV 주석 참고). 나머지는 수분 % 구간이다.
    """
    dry, wet = resolve_calibration(dry_mv, wet_mv)

    # "마른 쪽" 이 전압의 어느 방향인지는 보정값의 대소가 알려준다.
    if wet < dry:
        beyond_dry = raw_mv > dry + UNPLUGGED_MARGIN_MV
    else:
        beyond_dry = raw_mv < dry - UNPLUGGED_MARGIN_MV
    if beyond_dry:
        return "CHECK"

    pct = moisture_percent(raw_mv, dry_mv, wet_mv)
    if pct <= VERY_DRY_MAX_PCT:
        return "VERY_DRY"
    if pct <= DRY_MAX_PCT:
        return "DRY"
    if pct <= OK_MAX_PCT:
        return "OK"
    return "WET"


def needs_water(raw_mv: int, dry_mv: int | None, wet_mv: int | None) -> bool:
    """물 줄 때가 됐는지 — care_schedule 의 날짜 판단을 대신할 값.

    CHECK 는 물이 아니라 사람이 확인할 일이라 False 로 둔다.
    """
    if status_for(raw_mv, dry_mv, wet_mv) == "CHECK":
        return False
    return moisture_percent(raw_mv, dry_mv, wet_mv) <= WATER_NEEDED_PCT
