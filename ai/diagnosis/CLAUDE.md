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
    01_check_dataset.py   # 엑셀 분포 확인 (suspected_cause, plant_species 개수)
    02_build_index.py     # CLIP 임베딩 생성 + Qdrant 업로드
    03_search_similar.py  # 유사 사례 검색 (species 필터 + fallback)
    04_diagnose_claude.py # Claude API로 답변 생성
    05_eval_retrieval.py  # 검색 품질 평가 (추후)
  config/
    cause_codes.json      # 9개 원인 목록 (위 표 그대로)
  data_sample/
    labels_sample.csv     # 실제 데이터 아님, 예시 3~5줄만
```

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
