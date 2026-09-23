"""crop_labels.xlsx를 plant_species x suspected_cause 조합별로 상한선까지 층화추출한다.

houseplant(221장)에 비해 crop 원본(38,097행)이 압도적으로 많아 그대로 다 임베딩하면 Qdrant
저장량·임베딩 시간이 crop 쪽으로 심하게 쏠린다. 조합당 상한(기본 100장)을 두면 각 작물x원인
조합의 증상 다양성은 유지하면서 전체 규모를 houseplant와 비슷한 자릿수로 줄일 수 있다.
상한 이하인 조합은 그대로 다 쓰고, 넘는 조합만 무작위로 상한만큼 뽑는다(고정 시드로 재현 가능).
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_IN_PATH = DIAGNOSIS_DIR / "data" / "crop_labels.xlsx"
DEFAULT_OUT_PATH = DIAGNOSIS_DIR / "data" / "crop_labels_sampled.xlsx"
DEFAULT_CAP = 100
DEFAULT_SEED = 42
STRATA_COLUMNS = ["plant_species", "suspected_cause"]


def sample(df: pd.DataFrame, cap: int, seed: int) -> pd.DataFrame:
    groups = []
    for _, group in df.groupby(STRATA_COLUMNS, dropna=False):
        if len(group) > cap:
            group = group.sample(n=cap, random_state=seed)
        groups.append(group)
    sampled = pd.concat(groups, ignore_index=True)
    return sampled.sort_values("image_id").reset_index(drop=True)


def print_summary(df: pd.DataFrame, sampled: pd.DataFrame) -> None:
    n_groups = df.groupby(STRATA_COLUMNS, dropna=False).ngroups
    print(f"원본: {len(df)}행 -> 샘플: {len(sampled)}행 ({n_groups}개 조합)")
    print("\n=== 조합별 샘플 건수 (상위 10) ===")
    print(
        sampled.groupby(STRATA_COLUMNS, dropna=False)
        .size()
        .sort_values(ascending=False)
        .head(10)
        .to_string()
    )
    print("\n=== plant_species별 샘플 건수 ===")
    print(sampled["plant_species"].value_counts().to_string())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="crop_labels.xlsx 층화 샘플링 (plant_species x suspected_cause 조합별 상한)"
    )
    parser.add_argument("--in", dest="in_path", type=Path, default=DEFAULT_IN_PATH)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH)
    parser.add_argument("--cap", type=int, default=DEFAULT_CAP, help=f"조합당 최대 샘플 수 (기본값: {DEFAULT_CAP})")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    args = parser.parse_args()

    if not args.in_path.exists():
        raise FileNotFoundError(f"입력 파일을 찾을 수 없습니다: {args.in_path}")

    df = pd.read_excel(args.in_path)
    sampled_df = sample(df, args.cap, args.seed)
    print_summary(df, sampled_df)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    sampled_df.to_excel(args.out, index=False)
    print(f"\n저장 완료: {len(sampled_df)}행 -> {args.out}")
