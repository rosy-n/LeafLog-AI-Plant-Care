"""농사로 코드 매핑 — 앱과 공유하는 단일 JSON 정의를 읽어온다.

코드 표는 apps/mobile/constants/nongsaro-codes.json 에만 있다.
표를 고칠 때는 그 JSON 만 수정하면 앱(TS)과 이 모듈(Python) 양쪽에 반영된다.
"""
import json
from functools import lru_cache
from pathlib import Path

# apps/api/scripts/ingest/ → 리포 루트 → apps/mobile/constants/
CODES_JSON = (
    Path(__file__).resolve().parents[4] / "apps" / "mobile" / "constants" / "nongsaro-codes.json"
)


@lru_cache(maxsize=1)
def _codes() -> dict:
    if not CODES_JSON.exists():
        raise FileNotFoundError(
            f"농사로 코드 매핑 JSON 을 찾을 수 없습니다: {CODES_JSON}\n"
            "앱과 공유하는 파일이라 경로가 바뀌면 이 모듈의 CODES_JSON 도 함께 수정해야 합니다."
        )
    return json.loads(CODES_JSON.read_text(encoding="utf-8"))


def code_map(name: str) -> dict:
    """JSON 의 최상위 맵 하나를 반환. 이름은 TS 쪽 export 명과 동일."""
    table = _codes().get(name)
    if table is None:
        raise KeyError(f"nongsaro-codes.json 에 '{name}' 맵이 없습니다.")
    return table


def label(name: str, code: str | None) -> str | None:
    """단일 코드 → 라벨. 미등록 코드면 None."""
    if not code:
        return None
    return code_map(name).get(code.strip())


def parse_codes(code_string: str | None, name: str) -> list[str]:
    """콤마 구분 코드 문자열 → 라벨 목록. TS 의 parseCodes 와 동일 규칙."""
    if not code_string:
        return []
    table = code_map(name)
    return [
        table[c] for c in (part.strip() for part in code_string.split(",")) if c and c in table
    ]


def first_code(code_string: str | None) -> str | None:
    """콤마 구분 코드 문자열의 첫 코드만 (계절별 물주기 등에서 대표값 뽑을 때)."""
    if not code_string:
        return None
    for part in code_string.split(","):
        if part.strip():
            return part.strip()
    return None