# 개체 추가탭 (add-plant) — 화면별 로직 정의

현재 5단계 스텝 구성이다. 식물 종 판별용 사진과 SDXL 캐릭터 생성용 사진은
서로 분리하며, 캐릭터 생성은 개체 정보 입력 중 백그라운드에서 진행한다.

---

## 1단계: 식물종 입력 (`app/add-plant/index.tsx`)

### 경로 A — 카메라로 찾기 (모르는 경우)

1. 카메라 버튼 → Expo ImagePicker로 사진 촬영
2. 촬영된 사진 → PlantNet API 전송 (`services/plantnet.ts`)
3. 결과 화면: 후보 최대 3개 카드 표시
   - 각 카드: 학명, 일반명(최대 2개), 신뢰도(%), 참조 이미지
   - "네, 맞아요" 버튼 → 해당 종 선택
   - "보기" 버튼 → 추가 후보 확인
4. 선택된 종의 학명과 종 마스터를 대조해 등록할 종을 확정

### 경로 B — 이름 검색 (아는 경우)

1. 검색창에 한국어 식물명 입력 (예: "스파티필룸")
2. 텍스트 변경 시 서버의 종 마스터 검색 API 호출 (debounce 500ms)
3. 드롭다운에 일치하는 식물 이름과 대표 이미지 표시
4. 항목 선택 → `speciesId` 저장 후 다음 단계로

### 공통

- 선택된 식물 정보는 종 상세 API로 확인한다.
- 등록 전체 상태는 `AddPlantFlowContext`에 저장한다.

---

## 2단계: 도트 캐릭터 생성 시작 (`app/add-plant/character.tsx`)

- 좋은 예와 나쁜 예로 구성된 촬영 가이드를 표시한다.
- 식물 종 판별에 쓴 사진을 재사용하지 않고, 화분 전체가 보이는 사진을 새로 받는다.
- 미리보기에서 확인하면 `POST /api/character-generations`로 SDXL 후보 3개 생성을 시작한다.
- 작업 ID와 캐릭터용 사진을 등록 Context에 보관한 뒤 3단계로 이동한다.

---

## 3단계: 개체 정보 입력 (`app/add-plant/info.tsx`)

- 위치, 햇빛, 식물 길이, 화분 지름/종류, 흙, 물주기/분갈이 날짜를 입력한다.
- 사용자가 정보를 입력하는 동안 서버에서는 SDXL 생성 작업이 계속된다.
- 다음 버튼을 누르면 생성 결과 화면으로 이동한다.

---

## 4단계: 생성 결과 선택 (`app/add-plant/character.tsx`)

- 작업 상태를 폴링하며 전처리와 생성 진행률을 표시한다.
- 완료되면 후보 캐릭터 3개를 표시하고 하나를 선택한다.
- 다시 만들기를 누르면 촬영 가이드부터 다시 진행한다.

---

## 5단계: 이름과 성격 설정 (`app/add-plant/name.tsx`, `persona.tsx`)

- 이름은 최대 8자이며 빈 이름은 허용하지 않는다.
- 성격을 선택하고 저장하면 전체 데이터를 `POST /api/plants`로 전송한다.
- 식물 사진에는 종 판별용 사진을 우선 사용하고, 이름 검색으로 등록했다면 캐릭터용 원본을 사용한다.
- 저장 성공 후 생성된 개체 상세 화면으로 이동한다.

---

## 전체 상태 흐름

```
index (종 선택)
  └─ plantSpecies: { cntntsNo, scientificName, commonNameKo, ... }
  └─ plantNetResult: { score, imageUrl, ... } | null
  └─ identificationPhotoUri: string | null

character (촬영 가이드 + 생성 시작)
  └─ generationJobId: string
  └─ capturedPhotoUri: string

info (개체 정보 입력 중 생성 계속 진행)
  └─ location, lightLevel, plantHeight, potDiameter, soilNote, lastWateredAt, lastRepottedAt

character-result (캐릭터 생성 — 후보 3종 중 선택)
  └─ characterId: string          // 고른 후보 id (candidate-1 | candidate-2 | candidate-3)
  └─ characterImageUrl: string
  └─ characterChecksum: string

name (이름)
  └─ nickname: string

persona (성격 선택 + 최종 저장)
  └─ POST /api/plants
```

화면 간 등록 상태는 `AddPlantFlowContext`로 관리한다.
