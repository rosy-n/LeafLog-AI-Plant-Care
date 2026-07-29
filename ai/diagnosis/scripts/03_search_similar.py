"""유사 사례 검색 (similarity 기준 top-k)."""
import argparse
import os
from pathlib import Path

import torch
from dotenv import load_dotenv
from PIL import Image
from qdrant_client import QdrantClient
from qdrant_client.http.models import ScoredPoint
from transformers import CLIPModel, CLIPProcessor

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
CLIP_MODEL_NAME = "openai/clip-vit-large-patch14"
DEFAULT_TOP_K = 5

PAYLOAD_COLUMNS = [
    "file_name",
    "plant_species",
    "symptom_group",
    "suspected_cause",
    "plant_part",
    "source_url",
]


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
def embed_image(
    image: Image.Image,
    model: CLIPModel,
    processor: CLIPProcessor,
    device: torch.device,
) -> list[float]:
    inputs = processor(images=[image], return_tensors="pt").to(device)
    output = model.get_image_features(**inputs)
    # transformers>=5: get_image_features returns BaseModelOutputWithPooling
    # with the projected embedding in .pooler_output (not a raw tensor).
    features = output.pooler_output if hasattr(output, "pooler_output") else output
    features = features / features.norm(p=2, dim=-1, keepdim=True)
    return features[0].cpu().tolist()


def get_qdrant_client() -> QdrantClient:
    url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    api_key = os.environ.get("QDRANT_API_KEY") or None
    return QdrantClient(url=url, api_key=api_key)


def _to_result(point: ScoredPoint) -> dict:
    payload = point.payload or {}
    return {"score": point.score, "id": point.id, **{col: payload.get(col) for col in PAYLOAD_COLUMNS}}


def search_similar(
    client: QdrantClient,
    collection: str,
    query_vector: list[float],
    top_k: int = DEFAULT_TOP_K,
) -> list[dict]:
    """similarity 내림차순으로 top_k개를 반환한다 (species와 무관)."""
    points = client.query_points(collection_name=collection, query=query_vector, limit=top_k).points
    return [_to_result(point) for point in points]


def print_results(results: list[dict]) -> None:
    if not results:
        print("검색 결과 없음")
        return
    for i, r in enumerate(results, start=1):
        print(f"\n[{i}] score={r['score']:.4f}  {r['file_name']}")
        print(f"    plant_species={r['plant_species']}  symptom_group={r['symptom_group']}")
        print(f"    suspected_cause={r['suspected_cause']}  plant_part={r['plant_part']}")
        print(f"    source_url={r['source_url']}")


if __name__ == "__main__":
    load_dotenv(DIAGNOSIS_DIR / ".env")

    parser = argparse.ArgumentParser(description="유사 사례 검색 (similarity 기준 top-k)")
    parser.add_argument("--image", type=Path, required=True, help="검색할 쿼리 이미지 경로")
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    parser.add_argument("--collection", type=str, default=os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis"))
    args = parser.parse_args()

    if not args.image.exists():
        raise FileNotFoundError(f"이미지를 찾을 수 없습니다: {args.image}")

    clip_model, clip_processor, clip_device = load_clip()
    query_vector = embed_image(
        Image.open(args.image).convert("RGB"), clip_model, clip_processor, clip_device
    )

    qdrant = get_qdrant_client()
    search_results = search_similar(qdrant, args.collection, query_vector, top_k=args.top_k)
    print_results(search_results)
