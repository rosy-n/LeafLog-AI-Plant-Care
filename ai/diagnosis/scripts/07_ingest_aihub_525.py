"""AI-Hub 525번(식물 병 유발 통합 데이터) 라벨링 JSON -> labels.xlsx 스키마 CSV.

코드표는 데이터구축가이드라인_v0.1.pdf 표 84 "코드 정의서"로 확인한 값을 그대로 쓴다.
docs/crop-data-plan.md의 "525번 코드표"·"작물별로 실제 채택할 클래스" 절이 기준.

- 정상(00), 제외 확정 클래스(a10 모잘록병, b2 열과, b3 칼슘결핍, b5 축과병), 작물보호제
  처리반응(c-계열)은 애초에 다운로드하지 않거나 여기서 건너뛴다.
- suspected_cause는 작물명을 뗀 병명만 쓴다(예: a7 고추탄저병 -> "탄저병").
- symptom_group은 이 소스에 대응 개념이 없어 항상 비워둔다(사용자 결정: null).
- image_id는 여기서 부여하지 않는다 - 09_merge_crop_labels.py에서 전체 기준으로 재부여.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUT_PATH = DIAGNOSIS_DIR / "data" / "crop_labels_525.csv"
SOURCE_URL = "https://www.aihub.or.kr/aihubdata/data/view.do?dataSetSn=525"

CROP_CODES = {
    1: "딸기",
    2: "토마토",
    3: "파프리카",
    4: "오이",
    5: "고추",
    6: "시설포도",
}

AREA_CODES = {
    1: "열매",
    2: "꽃",
    3: "잎",
    4: "가지",
    5: "줄기",
}

# None = 제외 확정(docs/crop-data-plan.md "작물별로 실제 채택할 클래스" 표 기준)
DISEASE_CODES: dict[str, str | None] = {
    "00": None,  # 정상 - 다운로드 대상 아님
    # 병해(a-계열) - 작물+병명 1:1
    "a1": "잿빛곰팡이병",
    "a2": "흰가루병",
    "a3": "노균병",
    "a4": "흰가루병",
    "a5": "흰가루병",
    "a6": "잿빛곰팡이병",
    "a7": "탄저병",
    "a8": "흰가루병",
    "a9": "흰가루병",
    "a10": None,  # 파프리카모잘록병 - 제외
    "a11": "탄저병",
    "a12": "노균병",
    # 생리장해(b-계열) - 작물 공통
    "b1": "냉해피해",
    "b2": None,  # 열과 - 제외
    "b3": None,  # 칼슘결핍 - 제외
    "b4": "일소현상",
    "b5": None,  # 축과병 - 제외
    "b6": "다량원소 결핍",
    "b7": "다량원소 결핍",
    "b8": "다량원소 결핍",
}

COLUMNS = [
    "file_name",
    "plant_species",
    "symptom_group",
    "suspected_cause",
    "plant_part",
    "source_url",
    "domain",
    "source",
    "raw_disease_code",
]


def parse_json(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[경고] JSON 파싱 실패, 건너뜀: {path} ({exc})")
        return None

    description = data.get("description", {})
    annotations = data.get("annotations", {})

    file_name = description.get("image")
    crop_code = annotations.get("crop")
    area_code = annotations.get("area")
    disease_code = annotations.get("disease")

    if not file_name or crop_code is None or disease_code is None:
        print(f"[경고] 필수 필드 누락, 건너뜀: {path}")
        return None

    suspected_cause = DISEASE_CODES.get(disease_code, "__UNKNOWN__")
    if suspected_cause == "__UNKNOWN__":
        print(f"[경고] 알 수 없는 disease 코드 '{disease_code}', 건너뜀: {path}")
        return None
    if suspected_cause is None:
        return None  # 정상 또는 제외 확정 클래스

    plant_species = CROP_CODES.get(int(crop_code))
    if plant_species is None:
        print(f"[경고] 알 수 없는 crop 코드 '{crop_code}', 건너뜀: {path}")
        return None

    plant_part = AREA_CODES.get(int(area_code)) if area_code is not None else None

    return {
        "file_name": file_name,
        "plant_species": plant_species,
        "symptom_group": None,
        "suspected_cause": suspected_cause,
        "plant_part": plant_part,
        "source_url": SOURCE_URL,
        "domain": "crop",
        "source": "aihub_525",
        "raw_disease_code": disease_code,
    }


def ingest(labels_dir: Path) -> pd.DataFrame:
    json_paths = sorted(labels_dir.rglob("*.json"))
    if not json_paths:
        raise FileNotFoundError(f"'{labels_dir}' 아래에서 JSON 파일을 찾지 못했습니다.")

    rows = []
    skipped = 0
    for path in json_paths:
        row = parse_json(path)
        if row is None:
            skipped += 1
            continue
        rows.append(row)

    print(f"525번 처리 완료: 채택 {len(rows)}건 / 전체 {len(json_paths)}건 (제외·정상·오류 {skipped}건)")
    return pd.DataFrame(rows, columns=COLUMNS)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI-Hub 525번 라벨링 JSON -> CSV")
    parser.add_argument(
        "--labels-dir",
        type=Path,
        required=True,
        help="525번 데이터셋 '라벨링데이터' 폴더 경로 (예: .../라벨링데이터)",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH)
    args = parser.parse_args()

    df = ingest(args.labels_dir)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False, encoding="utf-8-sig")
    print(f"저장 완료: {len(df)}행 -> {args.out}")
