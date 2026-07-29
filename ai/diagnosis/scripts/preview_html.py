"""진단 결과 HTML 미리보기 (웹 테스트 전용 — 앱에 이식 금지)."""
import argparse
import base64
import importlib.util
import os
import webbrowser
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv
from PIL import Image

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
OUTPUTS_DIR = DIAGNOSIS_DIR / "outputs"

FORMAT_TO_MIME = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp", "GIF": "image/gif"}


def _load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _img_to_data_uri(path: Path) -> str:
    # 확장자 대신 Pillow로 디코딩한 실제 포맷을 기준으로 mime type을 정한다
    # (웹에서 저장한 이미지는 확장자와 실제 포맷이 다른 경우가 흔함).
    with Image.open(path) as img:
        image_format = img.format
    mime = FORMAT_TO_MIME.get(image_format, "image/jpeg")
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime};base64,{data}"


def render_html(query_image: Path, species: str | None, similar_cases: list[dict], diagnosis_text: str) -> str:
    cases_html = "".join(
        f"""
        <div class="case">
          <img src="{_img_to_data_uri(DIAGNOSIS_DIR / 'images' / c['file_name'])}" />
          <div class="meta">
            <div><b>score</b>: {c['score']:.3f}</div>
            <div><b>image_id</b>: {c['id']}</div>
            <div><b>file_name</b>: {c['file_name']}</div>
            <div><b>plant_species</b>: {c['plant_species']}</div>
            <div><b>symptom_group</b>: {c['symptom_group']}</div>
            <div><b>suspected_cause</b>: {c['suspected_cause']}</div>
            <div><b>plant_part</b>: {c['plant_part']}</div>
            <div class="source"><b>source_url</b>: <a href="{c['source_url']}" target="_blank">링크</a></div>
          </div>
        </div>
        """
        for c in similar_cases
    )
    diagnosis_html = diagnosis_text.replace("\n", "<br>")
    species_label = f"({species})" if species else ""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>LeafLog 진단 미리보기</title>
<style>
body {{ font-family: -apple-system, sans-serif; padding: 24px; max-width: 900px; margin: auto; }}
h2 {{ margin-top: 32px; }}
.query img {{ max-width: 320px; border-radius: 8px; }}
.cases {{ display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; }}
.case {{ flex: 0 0 auto; width: 220px; border: 1px solid #eee; border-radius: 8px; padding: 8px; }}
.case img {{ width: 100%; height: 160px; object-fit: cover; border-radius: 6px; }}
.case .meta {{ font-size: 12px; margin-top: 6px; line-height: 1.5; }}
.case .meta div {{ word-break: break-word; }}
.case .source a {{ color: #2563eb; }}
.diagnosis {{ background: #f7f7f5; padding: 16px; border-radius: 8px; line-height: 1.7; }}
</style></head>
<body>
<h1>LeafLog Visual RAG — 진단 미리보기</h1>
<div class="query">
  <h2>쿼리 이미지 {species_label}</h2>
  <img src="{_img_to_data_uri(query_image)}" />
</div>
<h2>검색된 유사 사례 ({len(similar_cases)}건)</h2>
<div class="cases">{cases_html}</div>
<h2>Claude 진단 상담 결과</h2>
<div class="diagnosis">{diagnosis_html}</div>
</body></html>"""


if __name__ == "__main__":
    load_dotenv(DIAGNOSIS_DIR / ".env")

    parser = argparse.ArgumentParser(description="진단 결과 HTML 미리보기 (웹 테스트 전용)")
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--species", type=str, default=None)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--collection", type=str, default=os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis"))
    args = parser.parse_args()

    search = _load_module("search_similar", "03_search_similar.py")
    diagnose = _load_module("diagnose_claude", "04_diagnose_claude.py")

    clip_model, clip_processor, clip_device = search.load_clip()
    query_vector = search.embed_image(
        Image.open(args.image).convert("RGB"), clip_model, clip_processor, clip_device
    )
    qdrant = search.get_qdrant_client()
    similar_cases = search.search_similar(
        qdrant, args.collection, query_vector, species=args.species, top_k=args.top_k
    )

    anthropic_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    diagnosis_text = diagnose.generate_diagnosis(
        anthropic_client, args.image, similar_cases, plant_species=args.species
    )

    OUTPUTS_DIR.mkdir(exist_ok=True)
    out_path = OUTPUTS_DIR / f"preview_{args.image.stem}.html"
    out_path.write_text(
        render_html(args.image, args.species, similar_cases, diagnosis_text), encoding="utf-8"
    )
    print(f"HTML 저장: {out_path}")
    webbrowser.open(f"file://{out_path}")
