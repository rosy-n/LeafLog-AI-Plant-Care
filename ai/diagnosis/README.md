# LeafLog Visual RAG (병해충 진단 프로토타입)

식물 병해충/증상 사진을 CLIP으로 임베딩해 Qdrant에서 유사 사례를 검색하고,
Claude API로 "가능성 기반 상담" 답변을 생성하는 로컬 프로토타입.

세부 규칙(데이터 스키마, 답변 포맷, 기술 스택 고정값 등)은 [CLAUDE.md](./CLAUDE.md) 참고.

## Setup

```bash
cd ai/diagnosis
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ANTHROPIC_API_KEY 등 채우기
docker-compose up -d   # Qdrant 로컬 실행 (별도 compose 파일 필요 시 추가)
```

## Scripts

| 스크립트 | 역할 |
|---|---|
| `scripts/01_check_dataset.py` | 엑셀 라벨 분포 확인 |
| `scripts/02_build_index.py` | CLIP 임베딩 생성 + Qdrant 업로드 |
| `scripts/03_search_similar.py` | 유사 사례 검색 |
| `scripts/04_diagnose_claude.py` | Claude API로 진단 상담 답변 생성 |
| `scripts/05_eval_retrieval.py` | 검색 품질 평가 (추후) |

## 주의

- 실제 이미지/라벨 원본, `.env`, `qdrant_storage/`, 임베딩 파일은 절대 커밋하지 않는다 (`.gitignore` 참고).
- `data_sample/labels_sample.csv`는 스키마 확인용 예시일 뿐, 실제 데이터가 아니다.
