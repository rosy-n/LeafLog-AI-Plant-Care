"""CLIP 임베딩 생성 + Qdrant 업로드.

houseplant(평평한 폴더, 정수 image_id)와 crop(중첩 폴더, domain/source 컬럼, UUID point id)
두 도메인을 모두 다룬다. crop 쪽은 CLIP 임베딩을 실행하는 곳(학교 PC)과 Qdrant에 접근 가능한
곳(EC2 인접 환경)이 분리돼 있어(Qdrant 6333은 EC2 루프백 전용) --mode로 두 단계를 나눠 실행할 수
있다 - 자세한 배경은 docs/crop-data-plan.md 참고.
"""
from __future__ import annotations

import argparse
import json
import os
import uuid
from collections.abc import Iterable, Iterator
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from tqdm import tqdm

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_LABELS_PATH = DIAGNOSIS_DIR / "data" / "labels.xlsx"
DEFAULT_IMAGES_DIR = DIAGNOSIS_DIR / "images"
CLIP_MODEL_NAME = "openai/clip-vit-large-patch14"
DEFAULT_IMAGE_KEY = "__default__"
# 실제 이미지 확장자는 png/jpg/jpeg/webp 등 원본 그대로 섞여 있을 수 있다(CLAUDE.md 참고) -
# 허용 목록 대신, 같은 폴더에 섞여 있는 라벨용 비이미지 파일만 제외한다.
NON_IMAGE_SUFFIXES = {".json", ".txt", ".xml", ".csv"}
# 결정론적 crop point id용 네임스페이스. 저장소에 기존 관례가 없어 표준 라이브러리 고정 상수를 채택.
CROP_UUID_NAMESPACE = uuid.NAMESPACE_URL

PAYLOAD_COLUMNS = [
    "file_name",
    "plant_species",
    "symptom_group",
    "suspected_cause",
    "plant_part",
    "source_url",
]


def load_labels(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"라벨 파일을 찾을 수 없습니다: {path}")
    if path.suffix == ".csv":
        return pd.read_csv(path)
    return pd.read_excel(path)


def load_clip() -> tuple["CLIPModel", "CLIPProcessor", "torch.device"]:
    import torch
    from transformers import CLIPModel, CLIPProcessor

    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(device).eval()
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
    return model, processor, device


def embed_images(
    images: list["Image.Image"],
    model: "CLIPModel",
    processor: "CLIPProcessor",
    device: "torch.device",
) -> list[list[float]]:
    import torch

    with torch.no_grad():
        inputs = processor(images=images, return_tensors="pt").to(device)
        output = model.get_image_features(**inputs)
        # transformers>=5: get_image_features returns BaseModelOutputWithPooling
        # with the projected embedding in .pooler_output (not a raw tensor).
        features = output.pooler_output if hasattr(output, "pooler_output") else output
        features = features / features.norm(p=2, dim=-1, keepdim=True)
        return features.cpu().tolist()


def get_qdrant_client() -> QdrantClient:
    url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    if url == ":memory:":
        # 로컬 검증용 - 임베디드 인메모리 Qdrant, Docker 불필요.
        return QdrantClient(location=":memory:")
    api_key = os.environ.get("QDRANT_API_KEY") or None
    return QdrantClient(url=url, api_key=api_key)


def ensure_collection(client: QdrantClient, collection: str, vector_size: int, recreate: bool) -> None:
    exists = client.collection_exists(collection)
    if exists and recreate:
        client.delete_collection(collection)
        exists = False
    if not exists:
        client.create_collection(
            collection_name=collection,
            vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
        )


def parse_image_roots(values: list[str] | None, default_dir: Path) -> dict[str, Path]:
    """--images-dir 값들을 {source 키: 폴더} 로 변환한다.

    'KEY=경로' 형식이면 라벨의 source 컬럼 값과 매칭하는 키로, 맨 경로 하나만 주어지면
    source가 없는 행(houseplant)에 쓰이는 기본 키(__default__)로 등록한다.
    """
    if not values:
        return {DEFAULT_IMAGE_KEY: default_dir}
    roots: dict[str, Path] = {}
    for value in values:
        key, sep, path = value.partition("=")
        if sep:
            roots[key] = Path(path)
        else:
            roots[DEFAULT_IMAGE_KEY] = Path(key)
    return roots


def build_image_index(root: Path) -> dict[str, Path]:
    """root 아래를 재귀 탐색해 {파일명: 경로} 인덱스를 한 번에 만든다 (중첩 폴더 대응)."""
    index: dict[str, Path] = {}
    collisions: dict[str, list[Path]] = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() in NON_IMAGE_SUFFIXES:
            continue
        if path.name in index:
            collisions.setdefault(path.name, [index[path.name]]).append(path)
            continue
        index[path.name] = path
    for name, paths in collisions.items():
        preview = ", ".join(str(p) for p in paths)
        print(f"[경고] '{root}' 안에서 파일명 중복: {name} -> {preview} (먼저 찾은 경로만 사용)")
    return index


def build_image_indexes(roots: dict[str, Path]) -> dict[str, dict[str, Path]]:
    return {key: build_image_index(root) for key, root in roots.items()}


def validate_source_roots(df: pd.DataFrame, roots: dict[str, Path]) -> None:
    """라벨의 source 값 중 --images-dir로 등록 안 된 게 있으면 즉시 중단한다.

    조용히 __default__로 폴백하면 엉뚱한 트리에서 검색해서 대량 skip만 나고 원인 파악이 안 된다.
    """
    if "source" not in df.columns:
        return
    needed = set(df["source"].dropna().unique())
    missing = needed - set(roots)
    if missing:
        example = sorted(missing)[0]
        raise ValueError(
            f"라벨에 있는 source 값 중 --images-dir로 지정 안 된 것: {sorted(missing)} "
            f"(예: --images-dir {example}=<경로>)"
        )


def resolve_image_path(row: pd.Series, indexes: dict[str, dict[str, Path]]) -> Path | None:
    source = row.get("source")
    key = source if pd.notna(source) else DEFAULT_IMAGE_KEY
    return indexes.get(key, {}).get(row["file_name"])


def row_domain(row: pd.Series) -> str:
    domain = row.get("domain")
    return domain if pd.notna(domain) else "houseplant"


def row_point_id(row: pd.Series, domain: str) -> int | str:
    # houseplant의 정수 image_id 체계는 유지한다 - 이미 프로덕션 Qdrant/S3(rag-reference/<image_id>.jpg)가
    # 이 값을 그대로 쓰고 있어서 바꾸면 안 된다. crop 등 다른 도메인만 결정론적 UUID를 쓴다.
    if domain == "houseplant":
        return int(row["image_id"])
    return str(uuid.uuid5(CROP_UUID_NAMESPACE, f"{domain}:{row['image_id']}"))


def row_payload(row: pd.Series, domain: str) -> dict:
    # NaN(예: symptom_group이 항상 비어있는 crop 525 소스)을 그대로 두면 json.dumps가 표준이
    # 아닌 NaN 리터럴을 써버린다 - JSON null(None)로 정규화한다.
    payload = {col: (None if pd.isna(row[col]) else row[col]) for col in PAYLOAD_COLUMNS}
    payload["domain"] = domain
    source = row.get("source")
    if pd.notna(source):
        payload["source"] = source
    return payload


def build_batch_records(
    batch: pd.DataFrame,
    indexes: dict[str, dict[str, Path]],
    model: "CLIPModel",
    processor: "CLIPProcessor",
    device: "torch.device",
) -> tuple[list[dict], list[str]]:
    """배치 하나를 임베딩해 {id, vector, payload} 레코드 리스트로 만든다. full/embed 모드 공용."""
    from PIL import Image

    images, rows = [], []
    skipped: list[str] = []
    for _, row in batch.iterrows():
        image_path = resolve_image_path(row, indexes)
        if image_path is None or not image_path.exists():
            skipped.append(row["file_name"])
            continue
        images.append(Image.open(image_path).convert("RGB"))
        rows.append(row)

    if not images:
        return [], skipped

    vectors = embed_images(images, model, processor, device)
    records = []
    for row, vector in zip(rows, vectors):
        domain = row_domain(row)
        records.append(
            {
                "id": row_point_id(row, domain),
                "vector": vector,
                "payload": row_payload(row, domain),
            }
        )
    return records, skipped


def write_jsonl(records: Iterable[dict], out_path: Path) -> int:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with out_path.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
    return count


def read_jsonl(path: Path) -> Iterator[dict]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def _print_skipped(skipped: list[str]) -> None:
    if not skipped:
        return
    preview = skipped[:10]
    print(f"[경고] 이미지가 없어 건너뜀: {len(skipped)}건 -> {preview}{'...' if len(skipped) > 10 else ''}")


def _iter_all_records(
    df: pd.DataFrame,
    indexes: dict[str, dict[str, Path]],
    model: "CLIPModel",
    processor: "CLIPProcessor",
    device: "torch.device",
    batch_size: int,
    skipped: list[str],
) -> Iterator[dict]:
    for start in tqdm(range(0, len(df), batch_size), desc="embedding"):
        batch = df.iloc[start : start + batch_size]
        records, batch_skipped = build_batch_records(batch, indexes, model, processor, device)
        skipped.extend(batch_skipped)
        yield from records


def run_full(
    labels_path: Path,
    image_root_args: list[str] | None,
    default_images_dir: Path,
    collection: str,
    batch_size: int,
    recreate: bool,
) -> None:
    """오늘까지의 기존 동작: 임베딩과 Qdrant 업로드를 한 프로세스에서 바로 이어서 한다."""
    df = load_labels(labels_path)
    roots = parse_image_roots(image_root_args, default_images_dir)
    validate_source_roots(df, roots)
    indexes = build_image_indexes(roots)
    model, processor, device = load_clip()

    client = get_qdrant_client()
    ensure_collection(client, collection, model.config.projection_dim, recreate)

    uploaded = 0
    skipped: list[str] = []
    for start in tqdm(range(0, len(df), batch_size), desc="embedding"):
        batch = df.iloc[start : start + batch_size]
        records, batch_skipped = build_batch_records(batch, indexes, model, processor, device)
        skipped.extend(batch_skipped)
        if not records:
            continue
        client.upsert(collection_name=collection, points=[qmodels.PointStruct(**r) for r in records])
        uploaded += len(records)

    print(f"업로드 완료: {uploaded}건, 컬렉션: {collection}")
    _print_skipped(skipped)


def run_embed(
    labels_path: Path,
    image_root_args: list[str] | None,
    default_images_dir: Path,
    out_path: Path,
    batch_size: int,
) -> None:
    """임베딩만 생성해서 jsonl로 저장한다 - Qdrant는 전혀 건드리지 않는다 (예: 학교 PC에서 실행)."""
    df = load_labels(labels_path)
    roots = parse_image_roots(image_root_args, default_images_dir)
    validate_source_roots(df, roots)
    indexes = build_image_indexes(roots)
    model, processor, device = load_clip()

    skipped: list[str] = []
    written = write_jsonl(
        _iter_all_records(df, indexes, model, processor, device, batch_size, skipped), out_path
    )

    print(f"임베딩 완료: {written}건 -> {out_path}")
    _print_skipped(skipped)


def run_upload(in_path: Path, collection: str, batch_size: int, recreate: bool) -> None:
    """jsonl로 저장된 임베딩을 Qdrant에 업로드한다 - CLIP/torch를 전혀 로드하지 않는다 (예: EC2에서 실행)."""
    if not in_path.exists():
        raise FileNotFoundError(f"임베딩 파일을 찾을 수 없습니다: {in_path}")

    client = get_qdrant_client()
    points_batch: list[qmodels.PointStruct] = []
    vector_size: int | None = None
    uploaded = 0

    for record in read_jsonl(in_path):
        if vector_size is None:
            vector_size = len(record["vector"])
            ensure_collection(client, collection, vector_size, recreate)
        points_batch.append(qmodels.PointStruct(**record))
        if len(points_batch) >= batch_size:
            client.upsert(collection_name=collection, points=points_batch)
            uploaded += len(points_batch)
            points_batch = []

    if points_batch:
        client.upsert(collection_name=collection, points=points_batch)
        uploaded += len(points_batch)

    print(f"업로드 완료: {uploaded}건, 컬렉션: {collection}")


if __name__ == "__main__":
    load_dotenv(DIAGNOSIS_DIR / ".env")

    parser = argparse.ArgumentParser(description="CLIP 임베딩 생성 + Qdrant 업로드")
    parser.add_argument(
        "--path", type=Path, default=DEFAULT_LABELS_PATH, help=f"라벨 파일 경로 (기본값: {DEFAULT_LABELS_PATH})"
    )
    parser.add_argument(
        "--images-dir",
        action="append",
        default=None,
        help=(
            "이미지 폴더 경로. 여러 번 지정 가능. 'KEY=경로' 형식이면 라벨의 source 컬럼 값"
            "(예: aihub_525, aihub_subtropical)과 매칭되고, 경로 하나만 주면 source가 없는 행"
            f"(houseplant)에 쓰인다 (기본값: {DEFAULT_IMAGES_DIR})"
        ),
    )
    parser.add_argument("--collection", type=str, default=os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis"))
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--recreate", action="store_true", help="기존 컬렉션을 삭제하고 새로 만든다")
    parser.add_argument(
        "--mode",
        choices=["full", "embed", "upload"],
        default="full",
        help="full=임베딩+업로드를 바로 이어서(기본값), embed=임베딩만 jsonl로 저장, upload=저장된 jsonl을 Qdrant에 업로드",
    )
    parser.add_argument("--out", type=Path, default=None, help="embed 모드 출력 경로 (기본값: data/embeddings/<collection>.jsonl)")
    parser.add_argument(
        "--in", dest="in_path", type=Path, default=None, help="upload 모드 입력 경로 (기본값: data/embeddings/<collection>.jsonl)"
    )
    args = parser.parse_args()

    default_vectors_path = DIAGNOSIS_DIR / "data" / "embeddings" / f"{args.collection}.jsonl"

    if args.mode == "full":
        run_full(args.path, args.images_dir, DEFAULT_IMAGES_DIR, args.collection, args.batch_size, args.recreate)
    elif args.mode == "embed":
        run_embed(args.path, args.images_dir, DEFAULT_IMAGES_DIR, args.out or default_vectors_path, args.batch_size)
    else:
        run_upload(args.in_path or default_vectors_path, args.collection, args.batch_size, args.recreate)
