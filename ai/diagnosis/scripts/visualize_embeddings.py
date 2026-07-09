"""CLIP 임베딩을 PCA로 2차원 압축해 썸네일 산점도 HTML로 시각화 (웹 테스트 전용)."""
import argparse
import base64
import json
import os
import webbrowser
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from qdrant_client import QdrantClient

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = DIAGNOSIS_DIR / "images"
OUTPUTS_DIR = DIAGNOSIS_DIR / "outputs"
CAUSE_CODES_PATH = DIAGNOSIS_DIR / "config" / "cause_codes.json"

CANVAS_SIZE = 1200
THUMB_SIZE = 40
PALETTE = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
    "#008080", "#e6beff",
]


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


def pca_2d(vectors: np.ndarray) -> np.ndarray:
    centered = vectors - vectors.mean(axis=0)
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    coords = centered @ vt[:2].T
    return coords


def umap_2d(vectors: np.ndarray, n_neighbors: int, min_dist: float) -> np.ndarray:
    import umap

    n_neighbors = min(n_neighbors, len(vectors) - 1)
    reducer = umap.UMAP(
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        metric="cosine",
        random_state=42,
    )
    return reducer.fit_transform(vectors)


def normalize_to_canvas(coords: np.ndarray, size: int, margin: int) -> np.ndarray:
    mins, maxs = coords.min(axis=0), coords.max(axis=0)
    scaled = (coords - mins) / (maxs - mins + 1e-9)
    return scaled * (size - 2 * margin) + margin


THUMB_PIXELS = (120, 120)  # 실제 화면 표시(40px, hover 시 100px)보다 넉넉한 저장용 썸네일 크기


def img_to_data_uri(path: Path) -> str:
    from io import BytesIO

    from PIL import Image

    with Image.open(path) as img:
        img = img.convert("RGB")
        img.thumbnail(THUMB_PIXELS)
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=80)
    data = base64.standard_b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{data}"


def render_html(points: list, coords: np.ndarray, color_by: str, projection: str, images_dir: Path) -> str:
    causes = json.load(open(CAUSE_CODES_PATH, encoding="utf-8"))["suspected_causes"]
    categories = causes if color_by == "suspected_cause" else sorted(
        {p.payload.get(color_by, "미상") for p in points}
    )
    color_map = {cat: PALETTE[i % len(PALETTE)] for i, cat in enumerate(categories)}

    dots_html = []
    for point, (x, y) in zip(points, coords):
        payload = point.payload or {}
        category = payload.get(color_by, "미상")
        color = color_map.get(category, "#999999")
        img_uri = img_to_data_uri(images_dir / payload["file_name"])
        data_attrs = " ".join(
            f'data-{col.replace("_", "-")}="{str(payload.get(col, "")).replace(chr(34), "&quot;")}"'
            for col in ["image_id", "file_name", "plant_species", "symptom_group",
                        "suspected_cause", "plant_part", "source_url"]
        ) + f' data-point-id="{point.id}"'
        dots_html.append(
            f'<img class="dot" src="{img_uri}" {data_attrs} '
            f'style="left:{x:.1f}px; top:{y:.1f}px; border-color:{color};" />'
        )

    legend_html = "".join(
        f'<div class="legend-item"><span class="swatch" style="background:{color}"></span>{cat}</div>'
        for cat, color in color_map.items()
    )

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>LeafLog CLIP 임베딩 시각화</title>
<style>
body {{ font-family: -apple-system, sans-serif; padding: 24px; }}
.canvas {{ position: relative; width: {CANVAS_SIZE}px; height: {CANVAS_SIZE}px; border: 1px solid #ddd; background: #fafafa; }}
.dot {{ position: absolute; width: {THUMB_SIZE}px; height: {THUMB_SIZE}px; object-fit: cover;
        border: 2px solid; border-radius: 4px; transform: translate(-50%, -50%); cursor: pointer; }}
.dot:hover {{ width: 100px; height: 100px; z-index: 999; box-shadow: 0 4px 16px rgba(0,0,0,.3); }}
.legend {{ margin-top: 16px; display: flex; flex-wrap: wrap; gap: 12px; }}
.legend-item {{ font-size: 13px; display: flex; align-items: center; gap: 4px; }}
.swatch {{ width: 12px; height: 12px; border-radius: 2px; display: inline-block; }}
#tooltip {{ position: fixed; display: none; z-index: 1000; background: #222; color: #fff;
            padding: 10px 12px; border-radius: 6px; font-size: 12px; line-height: 1.6;
            max-width: 320px; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,.4); }}
#tooltip b {{ color: #7dd3fc; }}
#tooltip a {{ color: #7dd3fc; }}
</style></head>
<body>
<h1>LeafLog CLIP 임베딩 시각화 ({projection.upper()} 2D, color by {color_by})</h1>
<p>점(썸네일)에 마우스를 올리면 커지고, 전체 컬럼이 툴팁으로 표시됩니다. 총 {len(points)}개.</p>
<div class="canvas">{''.join(dots_html)}</div>
<div class="legend">{legend_html}</div>
<div id="tooltip"></div>
<script>
const tooltip = document.getElementById('tooltip');
const fields = ['point-id', 'image-id', 'file-name', 'plant-species', 'symptom-group',
                'suspected-cause', 'plant-part', 'source-url'];
const labels = {{'point-id': 'point_id', 'image-id': 'image_id', 'file-name': 'file_name',
                 'plant-species': 'plant_species', 'symptom-group': 'symptom_group',
                 'suspected-cause': 'suspected_cause', 'plant-part': 'plant_part',
                 'source-url': 'source_url'}};
document.querySelectorAll('.dot').forEach(dot => {{
  dot.addEventListener('mouseenter', e => {{
    const rows = fields.map(f => {{
      const val = dot.dataset[f.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] || '';
      if (f === 'source-url' && val) {{
        return `<b>${{labels[f]}}</b>: <a href="${{val}}" target="_blank">${{val.slice(0, 40)}}...</a>`;
      }}
      return `<b>${{labels[f]}}</b>: ${{val}}`;
    }});
    tooltip.innerHTML = rows.join('<br>');
    tooltip.style.display = 'block';
  }});
  dot.addEventListener('mousemove', e => {{
    tooltip.style.left = (e.clientX + 16) + 'px';
    tooltip.style.top = (e.clientY + 16) + 'px';
  }});
  dot.addEventListener('mouseleave', () => {{ tooltip.style.display = 'none'; }});
}});
</script>
</body></html>"""


if __name__ == "__main__":
    load_dotenv(DIAGNOSIS_DIR / ".env")

    parser = argparse.ArgumentParser(description="CLIP 임베딩 2D 시각화 (PCA/UMAP)")
    parser.add_argument("--collection", type=str, default=os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis"))
    parser.add_argument(
        "--color-by", type=str, default="suspected_cause",
        choices=["suspected_cause", "plant_species", "symptom_group"],
    )
    parser.add_argument("--projection", type=str, default="pca", choices=["pca", "umap"])
    parser.add_argument("--n-neighbors", type=int, default=15, help="UMAP n_neighbors (--projection umap일 때만 사용)")
    parser.add_argument("--min-dist", type=float, default=0.1, help="UMAP min_dist (--projection umap일 때만 사용)")
    parser.add_argument("--images-dir", type=Path, default=IMAGES_DIR, help="썸네일을 읽어올 이미지 폴더 (크롭본 비교 시 교체)")
    args = parser.parse_args()

    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.environ.get("QDRANT_API_KEY") or None
    client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)

    all_points = fetch_all_points(client, args.collection)
    vectors = np.array([p.vector for p in all_points])
    if args.projection == "umap":
        coords_2d = umap_2d(vectors, args.n_neighbors, args.min_dist)
    else:
        coords_2d = pca_2d(vectors)
    coords_canvas = normalize_to_canvas(coords_2d, CANVAS_SIZE, margin=40)

    OUTPUTS_DIR.mkdir(exist_ok=True)
    out_path = OUTPUTS_DIR / f"embeddings_{args.collection}_{args.projection}_{args.color_by}.html"
    out_path.write_text(
        render_html(all_points, coords_canvas, args.color_by, args.projection, args.images_dir), encoding="utf-8"
    )
    print(f"HTML 저장: {out_path}")
    webbrowser.open(f"file://{out_path}")
