"""엑셀 라벨 데이터 분포 확인: plant_species, suspected_cause 개수와 스키마 검증."""
import argparse
import json
from pathlib import Path

import pandas as pd

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_LABELS_PATH = DIAGNOSIS_DIR / "data" / "labels.xlsx"
CAUSE_CODES_PATH = DIAGNOSIS_DIR / "config" / "cause_codes.json"

EXPECTED_COLUMNS = [
    "image_id",
    "file_name",
    "plant_species",
    "symptom_group",
    "suspected_cause",
    "plant_part",
    "source_url",
]


def load_labels(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"라벨 파일을 찾을 수 없습니다: {path}\n"
            "--path 옵션으로 data_sample/labels_sample.csv 등을 지정해서 먼저 테스트해보세요."
        )
    if path.suffix == ".csv":
        return pd.read_csv(path)
    return pd.read_excel(path)


def load_expected_causes() -> list[str]:
    with open(CAUSE_CODES_PATH, encoding="utf-8") as f:
        return json.load(f)["suspected_causes"]


def check_schema(df: pd.DataFrame) -> None:
    missing = set(EXPECTED_COLUMNS) - set(df.columns)
    extra = set(df.columns) - set(EXPECTED_COLUMNS)
    if missing:
        print(f"[경고] 누락된 컬럼: {sorted(missing)}")
    if extra:
        print(f"[경고] 정의되지 않은 컬럼: {sorted(extra)}")
    if not missing and not extra:
        print("스키마 일치: OK")


def check_causes(df: pd.DataFrame, expected_causes: list[str]) -> None:
    unknown = set(df["suspected_cause"].dropna().unique()) - set(expected_causes)
    if unknown:
        print(f"[경고] cause_codes.json에 없는 suspected_cause 값: {sorted(unknown)}")
    else:
        print(f"suspected_cause 값 전체가 확정된 {len(expected_causes)}개 목록 안에 있음: OK")


def print_distribution(df: pd.DataFrame, column: str) -> None:
    print(f"\n=== {column} 분포 ===")
    print(df[column].value_counts(dropna=False).to_string())


def main(path: Path) -> None:
    df = load_labels(path)
    print(f"총 {len(df)}행 로드: {path}\n")

    check_schema(df)
    check_causes(df, load_expected_causes())

    print_distribution(df, "plant_species")
    print_distribution(df, "suspected_cause")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="라벨 엑셀/CSV 분포 확인")
    parser.add_argument(
        "--path",
        type=Path,
        default=DEFAULT_LABELS_PATH,
        help=f"라벨 파일 경로 (기본값: {DEFAULT_LABELS_PATH})",
    )
    args = parser.parse_args()
    main(args.path)
