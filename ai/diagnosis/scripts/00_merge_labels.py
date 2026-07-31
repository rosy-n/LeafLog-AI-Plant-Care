"""JE/MN 라벨 엑셀을 하나로 병합 (file_name 보정 + image_id 재부여 + suspected_cause 정규화)."""
import argparse
import re
from pathlib import Path

import pandas as pd

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_JE_PATH = DIAGNOSIS_DIR / "data" / "leaflog_vr.xlsx"
DEFAULT_MN_PATH = DIAGNOSIS_DIR / "data" / "visual_rag_labels_MN.xlsx"
DEFAULT_IMAGES_DIR = DIAGNOSIS_DIR / "images"
DEFAULT_OUT_PATH = DIAGNOSIS_DIR / "data" / "labels.xlsx"

COLUMNS = [
    "image_id",
    "file_name",
    "plant_species",
    "symptom_group",
    "suspected_cause",
    "plant_part",
    "source_url",
]

# 원본 라벨은 원칙적으로 병합하지 않는다. 유일한 예외: '점무늬병'(1건)은
# '세균성 점무늬병'(4건, 원인까지 구체적으로 기록됨)으로 흡수 병합하기로 확정함.
MN_CAUSE_MAP = {
    "점무늬병": "세균성 점무늬병",
}

NA_PLACEHOLDER = "해당없음"


def find_disk_file(images_dir: Path, stem: str) -> str:
    matches = list(images_dir.glob(f"{stem}.*"))
    if len(matches) != 1:
        raise ValueError(f"'{stem}'에 매칭되는 이미지가 {len(matches)}개입니다: {matches}")
    return matches[0].name


def load_je(path: Path, images_dir: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    numbers = df["file_name"].str.extract(r"(\d+)")[0]
    df["file_name"] = [find_disk_file(images_dir, f"LL-VR-JE-{n}") for n in numbers]
    df["plant_species"] = df["plant_species"].fillna(NA_PLACEHOLDER)
    df["plant_part"] = df["plant_part"].fillna(NA_PLACEHOLDER)
    return df[COLUMNS[1:]]  # image_id는 나중에 전체 기준으로 재부여


def load_mn(path: Path, images_dir: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    stems = df["file_name"].apply(lambda f: Path(f).stem)
    df["file_name"] = [find_disk_file(images_dir, stem) for stem in stems]
    df["suspected_cause"] = df["suspected_cause"].replace(MN_CAUSE_MAP)
    return df[COLUMNS[1:]]


def merge(je_path: Path, mn_path: Path, images_dir: Path) -> pd.DataFrame:
    je = load_je(je_path, images_dir)
    mn = load_mn(mn_path, images_dir)
    merged = pd.concat([je, mn], ignore_index=True)
    merged.insert(0, "image_id", range(1, len(merged) + 1))
    return merged


def check_unknown_causes(df: pd.DataFrame) -> None:
    import json

    causes = json.load(open(DIAGNOSIS_DIR / "config" / "cause_codes.json", encoding="utf-8"))["suspected_causes"]
    unknown = set(df["suspected_cause"].dropna().unique()) - set(causes)
    if unknown:
        print(f"[경고] cause_codes.json에 없는 suspected_cause 값이 남아있습니다: {sorted(unknown)}")
    else:
        print(f"suspected_cause 값 전체가 확정된 {len(causes)}개 목록 안에 있음: OK")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="JE/MN 라벨 엑셀 병합")
    parser.add_argument("--je-path", type=Path, default=DEFAULT_JE_PATH)
    parser.add_argument("--mn-path", type=Path, default=DEFAULT_MN_PATH)
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES_DIR)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH)
    args = parser.parse_args()

    merged_df = merge(args.je_path, args.mn_path, args.images_dir)
    check_unknown_causes(merged_df)

    merged_df.to_excel(args.out, index=False)
    print(f"병합 완료: {len(merged_df)}행 -> {args.out}")
