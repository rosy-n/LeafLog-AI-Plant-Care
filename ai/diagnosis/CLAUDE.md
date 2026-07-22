# CLAUDE.md — LeafLog Visual RAG (ai/diagnosis/)

이 파일은 `ai/diagnosis/` 폴더에서 작업하는 Claude Code를 위한 지침이다.
이 폴더 밖의 다른 지침(팀 전체 컨벤션)이 상위 디렉토리에 있다면 그것도 함께 따르되,
아래 내용이 이 폴더 작업에서는 우선한다.

## 프로젝트 배경

LeafLog는 초보 식집사를 위한 AI 기반 반려식물 관리 앱 졸업프로젝트다.
이 폴더는 그중 **병해충/증상 상담 기능의 Visual RAG 로컬 프로토타입**을 개발하는 곳이다.

- 앱 본체(React Native/Expo)는 `apps/mobile/`에 있음 — **이 폴더의 작업은 그쪽 코드를 절대 건드리지 않는다**
- 브랜치: `ai/diagnosis-prototype`
- 목적: 병해충 진단을 확정 분류기로 만드는 게 아니라, 유사 사례를 검색해서 LLM/VLM이 "가능성 기반 상담"을 생성하는 구조를 검증하는 것

## 작업 범위 (중요)

- 파일 생성/수정은 `ai/diagnosis/` 폴더 내부로만 한정한다.
- `apps/mobile/`, `ai/character-generation/`, `ai/plant-identification/` 등 다른 폴더는 참조만 하고 수정하지 않는다.
- 새 폴더를 만들 때 `ai/visual-rag/` 같은 이름을 임의로 만들지 않는다 — 이미 `ai/diagnosis/`로 확정되어 있다.

## 데이터 스키마 (절대 임의로 바꾸지 말 것)

실제 라벨링 엑셀 컬럼은 다음과 같다. 이 컬럼 이외의 필드(예: `cause_code`, `label_confidence` 등)를 임의로 추가하지 않는다. 필요하면 먼저 사용자에게 확인한다.

```
image_id, file_name, plant_species, symptom_group, suspected_cause, plant_part, source_url
```

파일명 규칙: `LL-VR-{수집자}-{번호}.{확장자}` (JE = 지은, MN = 미나)
확장자는 png/jpg/jpeg 등 원본 그대로 섞여 있어도 된다 — `file_name` 컬럼에 실제 확장자를 정확히 적으면 파이프라인이 자동으로 처리한다.

### 확정된 원인(suspected_cause) 14개 — 이 목록 외의 값을 만들어내지 않는다

```
응애벌레, 과습, 뿌리파리, 진딧물, 일소현상, 광 과다, 진드기,
깍지벌레, 흰가루병, 총채벌레,
잎마름병, 갈색무늬병, 탄저병, 세균성 점무늬병
```

(2026-07-05: 실제 라벨링 데이터를 그대로 반영 — 임의로 카테고리를 묶지 않는다는 원칙에 따라
`곰팡이병(점무늬병/탄저, 잎마름병)` 같은 묶음 카테고리는 쓰지 않고, 원본 라벨(`잎마름병`/`갈색무늬병`/
`탄저병`/`세균성 점무늬병`)을 각각 독립 값으로 유지. 단 `점무늬병`(1건)만 `세균성 점무늬병`으로 흡수 병합함
— 나머지는 절대 병합하지 않는다.)

## 확정된 기술 스택 (임의로 다른 모델/DB로 바꾸지 말 것)

| 구성 요소 | 선택 | 비고 |
|---|---|---|
| 이미지 임베딩 | CLIP (`openai/clip-vit-large-patch14`) | 200장 규모라 파인튜닝 없이 그대로 사용 |
| 벡터 DB | Qdrant | 로컬/RunPod Docker로 실행, `qdrant_storage/`는 git에 올리지 않음 |
| 생성 모델 (현재) | Claude API (`claude-sonnet-5`) | 프로토타입 검증 단계, 개인 API 키 사용 |
| 생성 모델 (전환 예정) | Qwen2.5-VL-7B-Instruct | RunPod → 학교 3060(12GB) 서빙 예정. 지금은 구현하지 않음 |

임베딩/검색 로직과 생성 로직은 분리된 함수로 작성한다 (나중에 생성 모델만 Qwen으로 교체할 수 있도록).

## 답변 포맷 (진단 생성 시 반드시 지킬 것)

병명을 절대 단정하지 않는다. 항상 다음 5단계 구조로 답변을 생성한다.

```
1. 현재 상태 요약
2. 가능성 높은 원인 2~3가지
3. 사용자가 확인해야 할 점
4. 지금 할 수 있는 조치
5. 주의할 점
```

금지 표현: "확정적으로 ○○병입니다", "반드시 ~해야 한다"는 단정적 진단/처방 톤.

## 폴더 구조 (목표)

```
ai/diagnosis/
  README.md
  requirements.txt
  .env.example
  CLAUDE.md              (이 파일)
  scripts/
    00_merge_labels.py    # JE/MN 라벨 엑셀 병합 -> data/labels.xlsx
    01_check_dataset.py   # 엑셀 분포 확인 (suspected_cause, plant_species 개수)
    02_build_index.py     # CLIP 임베딩 생성 + Qdrant 업로드
    03_search_similar.py  # 유사 사례 검색 (species 필터 + fallback)
    04_diagnose_claude.py # Claude API로 답변 생성
    05_eval_retrieval.py  # 검색 품질 평가 (leave-one-out kNN purity)
    06_web_demo.py        # 로컬 웹 데모 (웹 테스트 전용, 앱에 이식 금지)
  config/
    cause_codes.json      # 14개 원인 목록 (위 표 그대로)
  data_sample/
    labels_sample.csv     # 실제 데이터 아님, 예시 3~5줄만
```

## 데이터 재현 (raw 데이터를 처음부터 다시 만들 때)

`data/`, `images/`, `images_cropped/`, `qdrant_storage/`, `outputs/`는 모두 gitignore 대상이라 git에는
아예 안 올라간다. 그런데 그중 **`images/`, `images_cropped/`는 gitignore가 아니라 심볼릭 링크**다 —
실제 파일은 저장소 밖(`~/leaflog-diagnosis-images`, `~/leaflog-diagnosis-images-cropped`)에 있다.
즉 이 200장 원본 이미지와 `data/leaflog_vr.xlsx`(JE), `data/visual_rag_labels_MN.xlsx`(MN) 라벨 엑셀은
**스크립트로 재생성할 수 없는 수작업 데이터**다 — 사라지면 다시 촬영/라벨링해야 한다.
git 재현성과 별개로 이 두 이미지 폴더 + 두 원본 엑셀은 반드시 별도 백업(개인 클라우드 드라이브 등)을 유지할 것.

원본 데이터가 살아있다는 전제하에, 처음부터 재현하는 순서:

```bash
cd ai/diagnosis
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ANTHROPIC_API_KEY, QDRANT_* 채우기

# Qdrant 로컬 실행 (compose 파일 없음 — 아래 docker run으로 대체)
docker run -p 6333:6333 -v "$(pwd)/qdrant_storage:/qdrant/storage" qdrant/qdrant

# 1) JE/MN 라벨 엑셀 병합 -> data/labels.xlsx
python scripts/00_merge_labels.py

# 2) 스키마/분포 확인 (선택이지만 병합 직후 항상 확인 권장)
python scripts/01_check_dataset.py

# 3) 원본 이미지로 임베딩 + 인덱싱
python scripts/02_build_index.py --recreate

# 4) (선택) 크롭 이미지로 별도 컬렉션 인덱싱 + 전/후 비교
python scripts/02_build_index.py --images-dir images_cropped --collection leaflog-diagnosis-cropped --recreate
python scripts/05_eval_retrieval.py --collection leaflog-diagnosis --compare leaflog-diagnosis-cropped

# 5) 동작 확인
python scripts/03_search_similar.py --image test_images/아무이미지.jpg
python scripts/04_diagnose_claude.py --image test_images/아무이미지.jpg
python scripts/06_web_demo.py   # http://127.0.0.1:5050
```

`qdrant_storage/`, `outputs/`(임베딩 시각화 html)는 위 스크립트들이 실행되면서 자동으로 다시 만들어지므로
별도 백업 대상이 아니다.

## 프로덕션 전환 시 고려할 것 (현재 미구현 — develop 반영 후 앱 연동용 메모)

지금 구조는 로컬에서 스크립트를 손으로 실행하는 프로토타입이다. 실제 앱에서 쓰려면 최소 아래가 필요하다:

- **API 경유 원칙 준수**: 모바일 앱은 CLIP/Qdrant/생성모델을 직접 호출하지 않는다. `apps/api/`(FastAPI)에
  03/04 로직(쿼리 이미지 임베딩 -> Qdrant 검색 -> 생성모델 호출)을 감싼 엔드포인트를 추가하고, 앱은 그
  엔드포인트만 호출한다 (`services/` 밖에서 fetch 금지 원칙과 동일한 이유).
- **Qdrant를 영속 서버로 이전**: 지금처럼 노트북 로컬 `qdrant_storage/`가 아니라, API 서버와 같은 곳
  (RunPod 등)에 Qdrant를 띄우고 그 인스턴스에 대고 `02_build_index.py`를 **한 번만** 실행해 인덱스를
  구축한다. 요청마다 재인덱싱하지 않는다.
- **원본 이미지 200장 위치 이전**: 지금은 홈 디렉토리 심볼릭 링크로 흩어져 있는데, 프로덕션 인덱스를
  구축하려면 이 이미지들을 접근 가능한 저장소(오브젝트 스토리지 등)로 옮겨야 한다.
- **생성 모델 교체**: CLAUDE.md 상단 표에 이미 명시된 대로 Claude API -> Qwen2.5-VL-7B-Instruct
  (RunPod -> 학교 3060 12GB) 전환 예정. 임베딩/검색 로직과 생성 로직을 분리해둔 이유가 이 교체를
  `04_diagnose_claude.py`의 생성 함수만 바꿔서 끝낼 수 있게 하기 위함이다.
- 위 사항은 전부 아직 코드로 옮겨지지 않은 계획이다 — 스크립트를 그대로 "켜는" 게 아니라 동일 로직을
  API 라우트로 재작성하는 작업이 필요하다.

## 절대 GitHub에 올리면 안 되는 것

- 실제 이미지 200장, 실제 `labels.xlsx` 원본
- `.env`, Claude API key
- `qdrant_storage/`, 임베딩 `.npy`/`.pkl` 파일
- 검색 결과에 원본 이미지가 포함된 `outputs/`

`.gitignore`에 다음이 포함되어 있는지 항상 확인한다:

```
ai/diagnosis/data/
ai/diagnosis/images/
ai/diagnosis/qdrant_storage/
ai/diagnosis/outputs/
ai/diagnosis/*.xlsx
ai/diagnosis/*.npy
ai/diagnosis/*.pkl
ai/diagnosis/.env
```

## 커밋 시 확인할 것

- `git status`(또는 GitHub Desktop Changes 탭)에 `apps/mobile/` 경로가 뜨면 안 된다 — 뜨면 실수로 다른 브랜치 변경사항이 섞인 것이니 즉시 확인한다.
- 커밋 메시지는 `feat:`, `fix:`, `docs:` 같은 conventional commit 스타일을 따른다.
