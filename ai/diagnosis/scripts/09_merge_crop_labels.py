"""07/08번 스크립트가 만든 소스별 CSV를 하나의 crop_labels.xlsx로 병합.

00_merge_labels.py(JE/MN 실내식물 라벨 병합)와 같은 역할을 농작물 소스에 대해 수행한다.
houseplant용 labels.xlsx와는 별도 파일로 유지한다 - domain 필드로 구분하지만, 원본 계통을
분리해두면 나중에 소스 하나만 다시 받았을 때 재현하기 쉽다.

image_id는 여기서 처음 부여한다(1부터 순번) - houseplant의 image_id와는 별도 체계다.
crop-data-plan.md "검색 아키텍처" 절에서 crop 포인트 ID를 domain:image_id 조합의 결정적
UUID로 만들기로 했으므로, 이 image_id는 crop 도메인 내부에서만 유일하면 된다.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_525_PATH = DIAGNOSIS_DIR / "data" / "crop_labels_525.csv"
DEFAULT_SUBTROPICAL_PATH = DIAGNOSIS_DIR / "data" / "crop_labels_subtropical.csv"
DEFAULT_OUT_PATH = DIAGNOSIS_DIR / "data" / "crop_labels.xlsx"

COLUMNS = [
    "image_id",
    "file_name",
    "plant_species",
    "symptom_group",
    "suspected_cause",
    "plant_part",
    "source_url",
    "domain",
    "source",
]


def merge(path_525: Path, path_subtropical: Path) -> pd.DataFrame:
    frames = []
    for path in (path_525, path_subtropical):
        if not path.exists():
            print(f"[경고] 파일 없음, 건너뜀: {path}")
            continue
        frames.append(pd.read_csv(path))

    if not frames:
        raise FileNotFoundError("병합할 CSV가 하나도 없습니다 - 07/08번 스크립트를 먼저 실행하세요.")

    merged = pd.concat(frames, ignore_index=True)
    merged.insert(0, "image_id", range(1, len(merged) + 1))
    return merged[COLUMNS + [c for c in merged.columns if c not in COLUMNS]]


def check_unknown_causes(df: pd.DataFrame) -> None:
    causes = json.load(open(DIAGNOSIS_DIR / "config" / "cause_codes.json", encoding="utf-8"))["suspected_causes"]
    unknown = set(df["suspected_cause"].dropna().unique()) - set(causes)
    if unknown:
        print(
            f"[확인 필요] config/cause_codes.json에 아직 없는 suspected_cause 값 "
            f"{len(unknown)}개: {sorted(unknown)}\n"
            "           docs/crop-data-plan.md의 매핑 제안을 확인/확정한 뒤 cause_codes.json에 반영할 것."
        )
    else:
        print("suspected_cause 값 전체가 확정된 목록 안에 있음: OK")


def print_summary(df: pd.DataFrame) -> None:
    print("\n=== 소스별 건수 ===")
    print(df["source"].value_counts().to_string())
    print("\n=== suspected_cause별 건수 ===")
    print(df["suspected_cause"].value_counts().to_string())
    print("\n=== plant_species별 건수 ===")
    print(df["plant_species"].value_counts().to_string())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="농작물 라벨 소스 병합 (07/08번 출력 -> crop_labels.xlsx)")
    parser.add_argument("--path-525", type=Path, default=DEFAULT_525_PATH)
    parser.add_argument("--path-subtropical", type=Path, default=DEFAULT_SUBTROPICAL_PATH)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH)
    args = parser.parse_args()

    merged_df = merge(args.path_525, args.path_subtropical)
    check_unknown_causes(merged_df)
    print_summary(merged_df)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    merged_df.to_excel(args.out, index=False)
    print(f"\n병합 완료: {len(merged_df)}행 -> {args.out}")
