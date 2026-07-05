"""CLIP 임베딩 생성 + Qdrant 업로드."""
import argparse
import os
from pathlib import Path

import pandas as pd
import torch
from dotenv import load_dotenv
from PIL import Image
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from tqdm import tqdm
from transformers import CLIPModel, CLIPProcessor

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
DEFAULT_LABELS_PATH = DIAGNOSIS_DIR / "data" / "labels.xlsx"
DEFAULT_IMAGES_DIR = DIAGNOSIS_DIR / "images"
CLIP_MODEL_NAME = "openai/clip-vit-large-patch14"

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


def load_clip() -> tuple[CLIPModel, CLIPProcessor, torch.device]:
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(device).eval()
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
    return model, processor, device


@torch.no_grad()
def embed_images(
    images: list[Image.Image],
    model: CLIPModel,
    processor: CLIPProcessor,
    device: torch.device,
) -> list[list[float]]:
    inputs = processor(images=images, return_tensors="pt").to(device)
    output = model.get_image_features(**inputs)
    # transformers>=5: get_image_features returns BaseModelOutputWithPooling
    # with the projected embedding in .pooler_output (not a raw tensor).
    features = output.pooler_output if hasattr(output, "pooler_output") else output
    features = features / features.norm(p=2, dim=-1, keepdim=True)
    return features.cpu().tolist()


def get_qdrant_client() -> QdrantClient:
    url = os.environ.get("QDRANT_URL", "http://localhost:6333")
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


def build_index(labels_path: Path, images_dir: Path, collection: str, batch_size: int, recreate: bool) -> None:
    df = load_labels(labels_path)
    model, processor, device = load_clip()

    client = get_qdrant_client()
    ensure_collection(client, collection, model.config.projection_dim, recreate)

    uploaded = 0
    skipped: list[str] = []

    for start in tqdm(range(0, len(df), batch_size), desc="embedding"):
        batch = df.iloc[start:start + batch_size]
        images, rows = [], []
        for _, row in batch.iterrows():
            image_path = images_dir / row["file_name"]
            if not image_path.exists():
                skipped.append(row["file_name"])
                continue
            images.append(Image.open(image_path).convert("RGB"))
            rows.append(row)

        if not images:
            continue

        vectors = embed_images(images, model, processor, device)
        points = [
            qmodels.PointStruct(
                id=int(row["image_id"]),
                vector=vector,
                payload={col: row[col] for col in PAYLOAD_COLUMNS},
            )
            for row, vector in zip(rows, vectors)
        ]
        client.upsert(collection_name=collection, points=points)
        uploaded += len(points)

    print(f"업로드 완료: {uploaded}건, 컬렉션: {collection}")
    if skipped:
        preview = skipped[:10]
        print(f"[경고] 이미지가 없어 건너뜀: {len(skipped)}건 -> {preview}{'...' if len(skipped) > 10 else ''}")


if __name__ == "__main__":
    load_dotenv(DIAGNOSIS_DIR / ".env")

    parser = argparse.ArgumentParser(description="CLIP 임베딩 생성 + Qdrant 업로드")
    parser.add_argument("--path", type=Path, default=DEFAULT_LABELS_PATH, help=f"라벨 파일 경로 (기본값: {DEFAULT_LABELS_PATH})")
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES_DIR, help=f"이미지 폴더 경로 (기본값: {DEFAULT_IMAGES_DIR})")
    parser.add_argument("--collection", type=str, default=os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis"))
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--recreate", action="store_true", help="기존 컬렉션을 삭제하고 새로 만든다")
    args = parser.parse_args()

    build_index(args.path, args.images_dir, args.collection, args.batch_size, args.recreate)
