# LeafLog Visual RAG (병해충 진단 실험 도구)

식물 병해충·증상 사진을 CLIP으로 임베딩해 Qdrant에서 유사 사례를 검색하고,
Ollama의 `qwen3.5:9b`로 가능성 기반 상담 답변을 생성하는 CLI와 검색 평가 도구다.
모바일 앱의 진단 API는 [apps/api/app/diagnosis.py](../../apps/api/app/diagnosis.py)에 구현되어 있다.

원인 코드 목록은 [config/cause_codes.json](config/cause_codes.json), CLI 답변 구성은
[scripts/04_diagnose_qwen.py](scripts/04_diagnose_qwen.py)를 참고한다.

## 준비

Python 3.11 환경에서 의존성을 설치하고 Qdrant 접속 정보를 설정한다.

```powershell
cd ai/diagnosis
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

- `.env`의 `QDRANT_URL`, 필요 시 `QDRANT_API_KEY`, `QDRANT_COLLECTION`을 설정한다.
- Qdrant 서버와 실제 참고 이미지·라벨로 만든 검색 인덱스가 필요하다. 제출본의
  `data_sample/labels_sample.csv`는 스키마 확인용 예시이며 실제 검색 데이터가 아니다.
- CLIP 최초 실행 시 `openai/clip-vit-large-patch14` 모델을 다운로드한다.
- 상담 답변 생성에는 `qwen3.5:9b`가 준비된 Ollama 서버가 필요하다. 기본 주소는
  `http://localhost:11434/api/chat`이다. 다른 서버를 사용하면 실행 전에 프로세스
  환경변수 `OLLAMA_URL`에 `/api/chat`을 포함한 주소를 지정한다.

```powershell
$env:OLLAMA_URL = 'http://localhost:11434/api/chat'
python scripts/04_diagnose_qwen.py --image path/to/plant.jpg --species "몬스테라" --symptom-text "잎 끝이 갈색으로 변했어요"
```

`--species`는 상담 답변에 식물종 정보를 제공한다. CLI의 유사 사례 검색은
지정 컬렉션 전체를 대상으로 하며, 앱 API의 단계별 검색 로직과는 별개다.

## 스크립트

| 스크립트 | 역할 |
|---|---|
| `scripts/00_merge_labels.py` | 라벨 파일 병합 |
| `scripts/01_check_dataset.py` | 엑셀 라벨 분포 확인 |
| `scripts/02_build_index.py` | CLIP 임베딩 생성 및 Qdrant 업로드 |
| `scripts/03_search_similar.py` | 유사 사례 검색 |
| `scripts/04_diagnose_qwen.py` | Qwen/Ollama로 5단계 진단 상담 답변 생성 |
| `scripts/05_eval_retrieval.py` | 검색 품질 평가 (leave-one-out kNN purity) |
| `scripts/07_ingest_aihub_525.py` | AI Hub 525 데이터 적재 준비 |
| `scripts/08_ingest_aihub_subtropical.py` | AI Hub 아열대·열대 병해충 데이터 적재 준비 |
| `scripts/09_merge_crop_labels.py` | 작물 라벨 병합 |
| `scripts/10_sample_crop_labels.py` | 작물 라벨 표본 추출 |
| `scripts/visualize_embeddings.py` | 임베딩 분포 시각화 |

## 크롭 전후 비교

1. 원본은 보존하고, 수동으로 크롭한 이미지를 같은 파일명으로 별도 폴더(예: `images_cropped/`)에 저장한다.
2. `python scripts/02_build_index.py --images-dir images_cropped --collection leaflog-diagnosis-cropped --recreate`로 별도 컬렉션에 재인덱싱한다. `--recreate`는 지정한 컬렉션을 삭제하고 다시 만든다.
3. `python scripts/05_eval_retrieval.py --collection leaflog-diagnosis --compare leaflog-diagnosis-cropped`로 검색 품질을 비교한다.
4. `python scripts/visualize_embeddings.py --collection leaflog-diagnosis-cropped --images-dir images_cropped --projection umap`로 산점도를 비교한다.

실제 이미지·라벨 원본, `.env`, `qdrant_storage/`, 임베딩 파일은 제출본에 포함하지 않는다.
데이터 출처와 이용 조건은 각 데이터셋의 안내를 따른다.
