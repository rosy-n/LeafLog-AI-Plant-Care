"""AI-Hub "국내 재배 아열대·열대 병해충 데이터"(dataSetSn=71750) 라벨링 JSON -> CSV.

이 소스는 525번과 달리 코드 해독이 필요 없다 - JSON의 object_class_*_nm 필드에 작물/부위/
병해충명이 한글 그대로 들어있다(활용가이드라인_v3.5.pdf 참고). docs/crop-data-plan.md의
"소스 3" 절이 기준.

그을음병/검은점무늬병/점무늬병/궤양병/귤굴나방 5개는 2026-09-14 웹서칭 근거로 확정 추가됨
(CLAUDE.md "확정된 원인 23개" 절, config/cause_codes.json 참고) - 더 이상 제안 단계 아님.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUT_PATH = DIAGNOSIS_DIR / "data" / "crop_labels_subtropical.csv"
SOURCE_URL = "https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=71750"

# 라이선스: CC-BY-SA-4.0 (구축기관: 제주특별자치도 컨소시엄) - 2차 가공 시 동일조건 표시 필요.
LICENSE_NAME = "CC-BY-SA-4.0"
LICENSE_ORG = "제주특별자치도 컨소시엄"

PART_MAP = {
    "잎": "잎",
    "과실": "열매",  # 525번 표기("열매")와 통일
    "줄기": "줄기",
}

# None = 제외 추천(docs/crop-data-plan.md "소스 3" 절의 매핑 제안 표 기준).
# "정상"은 애초에 다운로드하지 않는다.
CAUSE_MAP: dict[str, str | None] = {
    "총채벌레": "총채벌레",
    "탄저병": "탄저병",
    "흰가루병": "흰가루병",
    "차먼지응애": "응애벌레",
    "그을음병": "그을음병",
    "검은점무늬병": "검은점무늬병",
    "점무늬병": "점무늬병",
    "궤양병": "궤양병",
    "귤굴나방": "귤굴나방",
    "노린재": None,
    "잎말이나방": None,
    "거세미나방": None,
    "반엽병": None,
    "바나나곰팡이병": None,
    "과실썩음병": None,
    "줄기썩음병": None,
    "바구미": None,
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
    "raw_disease_name",
]


def parse_json(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[경고] JSON 파싱 실패, 건너뜀: {path} ({exc})")
        return None

    images = data.get("images", {})
    annotations = data.get("annotations", {})

    file_name = images.get("image_file_nm")
    plant_species = annotations.get("object_class_lclas_nm")
    raw_part = annotations.get("object_class_mlsfc_nm")
    raw_cause = annotations.get("object_class_sclas_nm")

    if not file_name or not plant_species or not raw_cause:
        print(f"[경고] 필수 필드 누락, 건너뜀: {path}")
        return None

    if raw_cause == "정상":
        return None

    if raw_cause not in CAUSE_MAP:
        print(f"[경고] CAUSE_MAP에 없는 병해충명 '{raw_cause}', 건너뜀: {path}")
        return None

    suspected_cause = CAUSE_MAP[raw_cause]
    if suspected_cause is None:
        return None  # 제외 추천 클래스

    plant_part = PART_MAP.get(raw_part, raw_part)

    return {
        "file_name": file_name,
        "plant_species": plant_species,
        "symptom_group": None,
        "suspected_cause": suspected_cause,
        "plant_part": plant_part,
        "source_url": SOURCE_URL,
        "domain": "crop",
        "source": "aihub_subtropical",
        "raw_disease_name": raw_cause,
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

    print(f"아열대 데이터 처리 완료: 채택 {len(rows)}건 / 전체 {len(json_paths)}건 (제외·정상·오류 {skipped}건)")
    return pd.DataFrame(rows, columns=COLUMNS)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI-Hub 아열대·열대 병해충 데이터 라벨링 JSON -> CSV")
    parser.add_argument(
        "--labels-dir",
        type=Path,
        required=True,
        help="아열대 데이터셋 라벨링데이터 폴더 경로",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH)
    args = parser.parse_args()

    df = ingest(args.labels_dir)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False, encoding="utf-8-sig")
    print(f"저장 완료: {len(df)}행 -> {args.out}")
    print(f"라이선스 표시 필요: {LICENSE_NAME} ({LICENSE_ORG})")
