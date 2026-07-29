"""검색 품질 평가: leave-one-out kNN purity로 라벨(원인)이 임베딩 공간에서 얼마나 잘 뭉치는지 측정.

컬렉션 하나를 그대로 평가(baseline)하거나, 크롭 전/후 두 컬렉션을 --compare로 비교한다.
Qdrant에 저장된 벡터만 쓰므로, 크롭 이미지로 재구축한 별도 컬렉션(예: leaflog-diagnosis-cropped)과도
바로 비교 가능하다 (docs/crop-data-plan.md의 "before vs after" 검증 계획 참고).
"""
import argparse
import os
from collections import Counter

import numpy as np
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from sklearn.neighbors import NearestNeighbors

DIAGNOSIS_DIR_ENV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def fetch_all_points(client: QdrantClient, collection: str) -> list:
    points, offset = [], None
    while True:
        batch, offset = client.scroll(
            collection_name=collection, limit=256, offset=offset,
            with_payload=True, with_vectors=True,
        )
        points.extend(batch)
        if offset is None:
            break
    return points


def knn_purity(vectors: np.ndarray, labels: list[str], k: int) -> tuple[float, dict[str, float]]:
    """leave-one-out: 각 점의 k개 최근접 이웃 중 같은 라벨 비율(purity). 전체 평균 + 클래스별 평균 반환."""
    k_eff = min(k, len(vectors) - 1)
    nn = NearestNeighbors(n_neighbors=k_eff + 1, metric="cosine").fit(vectors)
    _, idx = nn.kneighbors(vectors)
    labels_arr = np.array(labels)

    per_point = []
    for i, neighbors in enumerate(idx):
        neighbors = neighbors[neighbors != i][:k_eff]
        per_point.append(np.mean(labels_arr[neighbors] == labels_arr[i]))
    per_point = np.array(per_point)

    per_class = {}
    for cls in sorted(set(labels)):
        mask = labels_arr == cls
        per_class[cls] = float(per_point[mask].mean())

    return float(per_point.mean()), per_class


def random_baseline(labels: list[str]) -> float:
    """라벨을 무작위로 섞었을 때 기대되는 purity (클래스 크기 분포로부터 계산)."""
    counts = np.array(list(Counter(labels).values()))
    p = counts / counts.sum()
    return float(np.sum(p**2))


def evaluate(client: QdrantClient, collection: str, label_field: str, k: int) -> None:
    points = fetch_all_points(client, collection)
    if not points:
        print(f"[{collection}] 포인트 없음 — 컬렉션이 비어있거나 존재하지 않습니다.")
        return
    vectors = np.array([p.vector for p in points])
    labels = [p.payload.get(label_field, "미상") for p in points]

    purity, per_class = knn_purity(vectors, labels, k)
    baseline = random_baseline(labels)

    print(f"\n=== {collection} | label={label_field} | n={len(points)} | k={k} ===")
    print(f"전체 kNN purity: {purity:.3f}  (랜덤 baseline: {baseline:.3f}, {purity / baseline:.1f}배)")
    print(f"{'클래스':<14} {'purity':>8}")
    for cls, val in sorted(per_class.items(), key=lambda x: -x[1]):
        n_cls = labels.count(cls)
        print(f"{cls:<14} {val:>8.3f}  (n={n_cls})")


if __name__ == "__main__":
    load_dotenv(os.path.join(DIAGNOSIS_DIR_ENV, ".env"))

    parser = argparse.ArgumentParser(description="kNN purity 기반 검색 품질 평가")
    parser.add_argument("--collection", type=str, default=os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis"))
    parser.add_argument("--compare", type=str, default=None, help="비교 대상 컬렉션 (예: 크롭 후 컬렉션)")
    parser.add_argument("--label-field", type=str, default="suspected_cause")
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()

    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.environ.get("QDRANT_API_KEY") or None
    client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)

    evaluate(client, args.collection, args.label_field, args.k)
    if args.compare:
        evaluate(client, args.compare, args.label_field, args.k)
