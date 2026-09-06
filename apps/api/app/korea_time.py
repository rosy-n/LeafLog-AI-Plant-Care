"""앱이 세는 "오늘" — 한국 날짜 기준. 이 모듈이 단일 출처다.

시각(timestamp)과 날짜(달력의 하루)를 구분해야 한다.

  - 시각: created_at, completed_at, dead_at 처럼 "언제 일어났는가". UTC로 저장한다.
    이건 그대로 두어야 시간대가 달라져도 순서와 간격이 안 흔들린다.
  - 날짜: "물 주는 날", "오늘 이미 기록했는지", "며칠 지났는지"처럼 사용자가
    달력을 보고 세는 하루. 이건 반드시 사용자의 하루 경계를 따라야 한다.

두 번째를 UTC로 계산하면 한국(UTC+9)에서는 자정~오전 9시 사이에 서버가 아직
어제라, "오늘 물 주는 날"이 하루 늦게 뜬다. 낮에는 두 날짜가 같아서 드러나지 않는다.

LeafLog는 한국 사용자를 대상으로 하고 기상청·농사로 자료도 한국 날짜 기준이라,
고정 시간대를 쓴다. 해외 사용자를 받게 되면 이 자리를 사용자별 시간대로 바꾸면 된다.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

KOREA_TIMEZONE = ZoneInfo("Asia/Seoul")


def today_in_korea() -> date:
    """지금 한국의 날짜."""
    return datetime.now(timezone.utc).astimezone(KOREA_TIMEZONE).date()


def korea_day(moment: datetime) -> date:
    """저장된 시각이 한국에서 어느 날이었는지.

    DB의 시각 컬럼은 naive UTC로 들어오므로(tzinfo 없음) UTC로 간주해 변환한다.
    """
    aware = moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment
    return aware.astimezone(KOREA_TIMEZONE).date()
