"""로컬 웹 데모: 이미지 업로드 + 증상 텍스트 입력 -> RAG 검색 + Claude 진단 (웹 테스트 전용).

실제 앱에서 사용자가 겪을 흐름(사진 + 증상 자연어 설명 입력)을 그대로 재현해서,
검색된 유사 사례와 Claude가 만든 5단계 답변을 한 화면에서 확인하기 위한 프로토타입 서버.
"""
import base64
import importlib.util
import io
import os

# torch와 다른 라이브러리가 각자 번들한 OpenMP 런타임을 중복 로드해 macOS/conda 환경에서
# "OMP: Error #15"로 프로세스가 즉시 죽는 문제 우회. torch를 로드하는 03_search_similar를
# import하기 전에 설정해야 한다.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv
from flask import Flask, render_template_string, request
from PIL import Image

DIAGNOSIS_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
IMAGES_DIR = DIAGNOSIS_DIR / "images"

load_dotenv(DIAGNOSIS_DIR / ".env")


def _load_module(name: str):
    """파일명이 숫자로 시작해 일반 import 구문을 쓸 수 없어 importlib로 로드한다."""
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


search_mod = _load_module("03_search_similar")
diagnose_mod = _load_module("04_diagnose_claude")

app = Flask(__name__)

_clip = None
_qdrant = None
_anthropic = None


def get_clip():
    global _clip
    if _clip is None:
        _clip = search_mod.load_clip()
    return _clip


def get_qdrant():
    global _qdrant
    if _qdrant is None:
        _qdrant = search_mod.get_qdrant_client()
    return _qdrant


def get_anthropic() -> Anthropic:
    global _anthropic
    if _anthropic is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY가 .env에 설정되어 있지 않습니다.")
        _anthropic = Anthropic(api_key=api_key)
    return _anthropic


def image_to_data_uri(img: Image.Image, size: tuple[int, int] = (240, 240)) -> str:
    img = img.convert("RGB").copy()
    img.thumbnail(size)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def result_thumb_data_uri(file_name: str) -> str | None:
    path = IMAGES_DIR / file_name
    if not path.exists():
        return None
    with Image.open(path) as img:
        return image_to_data_uri(img)


FORM_HTML = """
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>LeafLog 진단 데모</title>
<style>
body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 16px; }
h1 { font-size: 20px; }
label { display: block; margin-top: 16px; font-weight: 600; }
textarea, input[type=text] { width: 100%; box-sizing: border-box; padding: 8px; font-size: 14px; margin-top: 4px; }
button { margin-top: 24px; padding: 10px 20px; font-size: 15px; cursor: pointer; }
</style></head>
<body>
<h1>LeafLog 병해충 진단 데모 (Visual RAG + Claude)</h1>
<form method="post" action="/diagnose" enctype="multipart/form-data">
  <label>식물 사진
    <input type="file" name="image" accept="image/*" required>
  </label>
  <label>증상 설명
    <textarea name="symptom_text" rows="4" placeholder="예: 잎 끝이 갈색으로 마르면서 동그란 반점이 생겼어요"></textarea>
  </label>
  <label>식물 종 (선택)
    <input type="text" name="species" placeholder="예: 몬스테라">
  </label>
  <button type="submit">진단하기</button>
</form>
</body></html>
"""

RESULT_HTML = """
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>LeafLog 진단 결과</title>
<style>
body { font-family: -apple-system, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 16px; }
h1, h2 { font-size: 20px; }
.query-block { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
.query-block img { width: 160px; height: 160px; object-fit: cover; border-radius: 8px; }
.results-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
.result-card { width: 130px; font-size: 12px; }
.result-card img { width: 130px; height: 130px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
.result-card .cause { font-weight: 600; margin-top: 4px; }
.diagnosis { white-space: pre-wrap; background: #f7f7f7; padding: 16px; border-radius: 8px; line-height: 1.6; }
a.back { display: inline-block; margin-top: 24px; }
</style></head>
<body>
<h1>진단 결과</h1>

<div class="query-block">
  <img src="{{ query_image_uri }}">
  <div>
    <div><b>증상 설명:</b> {{ symptom_text or '(입력 안 함)' }}</div>
    <div><b>식물 종:</b> {{ species or '(입력 안 함)' }}</div>
    <div><b>검색 컬렉션:</b> {{ collection }}</div>
  </div>
</div>

<h2>RAG 검색 결과 (유사 사례 top-{{ similar_cases|length }})</h2>
<div class="results-grid">
{% for r in similar_cases %}
  <div class="result-card">
    {% if r.thumb_uri %}<img src="{{ r.thumb_uri }}">{% else %}<div style="width:130px;height:130px;background:#eee;border-radius:6px;"></div>{% endif %}
    <div class="cause">{{ r.suspected_cause }}</div>
    <div>{{ r.plant_species }} / {{ r.plant_part }}</div>
    <div>similarity={{ "%.3f"|format(r.score) }}</div>
  </div>
{% endfor %}
</div>

<h2>Claude 진단 (참고용, 확정 진단 아님)</h2>
<div class="diagnosis">{{ diagnosis }}</div>

<a class="back" href="/">&larr; 다시 진단하기</a>
</body></html>
"""


@app.route("/")
def index():
    return render_template_string(FORM_HTML)


@app.route("/diagnose", methods=["POST"])
def diagnose():
    file = request.files.get("image")
    if not file or not file.filename:
        return "이미지를 업로드해주세요.", 400

    symptom_text = request.form.get("symptom_text", "").strip() or None
    species = request.form.get("species", "").strip() or None
    collection = os.environ.get("QDRANT_COLLECTION", "leaflog-diagnosis")

    image_bytes = file.read()
    query_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    model, processor, device = get_clip()
    query_vector = search_mod.embed_image(query_image, model, processor, device)

    qdrant = get_qdrant()
    similar_cases = search_mod.search_similar(qdrant, collection, query_vector, top_k=5)
    for r in similar_cases:
        r["thumb_uri"] = result_thumb_data_uri(r["file_name"])

    anthropic_client = get_anthropic()
    diagnosis_text = diagnose_mod.generate_diagnosis(
        anthropic_client, image_bytes, similar_cases,
        plant_species=species, symptom_text=symptom_text,
    )

    return render_template_string(
        RESULT_HTML,
        query_image_uri=image_to_data_uri(query_image),
        symptom_text=symptom_text,
        species=species,
        collection=collection,
        similar_cases=similar_cases,
        diagnosis=diagnosis_text,
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)
