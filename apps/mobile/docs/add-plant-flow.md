# 개체 추가탭 (add-plant) — 화면별 로직 정의

피그마 기준 4단계 스텝 구성 (진행바: 1/4 ~ 4/4)

---

## 1단계: 식물종 입력 (`app/add-plant/index.tsx`)

### 경로 A — 카메라로 찾기 (모르는 경우)

1. 카메라 버튼 → Expo ImagePicker로 사진 촬영
2. 촬영된 사진 → PlantNet API 전송 (`services/plantnet.ts`)
3. 결과 화면: 후보 최대 3개 카드 표시
   - 각 카드: 학명, 일반명(최대 2개), 신뢰도(%), 참조 이미지
   - "네, 맞아요" 버튼 → 해당 종 선택
   - "보기" 버튼 → 추가 후보 확인
4. 선택된 종의 `scientific_name`을 농사로 API 검색어로 사용

### 경로 B — 이름 검색 (아는 경우)

1. 검색창에 한국어 식물명 입력 (예: "스파티필룸")
2. 텍스트 변경 시 농사로 `gardenList` API 실시간 호출 (debounce 500ms)
3. 드롭다운 결과 목록: `cntntsSj` (식물명) 표시
4. 항목 선택 → `cntntsNo` 저장 후 다음 단계로

### 공통

- 선택된 식물 정보 → 농사로 `gardenDtl` API로 상세 조회
- 조회 결과를 다음 스텝으로 넘길 때 Expo Router `params` 또는 전역 상태(Zustand/Context)에 저장

---

## 2단계: 도트 캐릭터 생성 (`app/add-plant/character.tsx`)

### 현재 구현 범위 (모델 미완성)

- [ ] 촬영 가이드 화면 표시 (좋은 예 / 나쁜 예)
- [ ] Expo ImagePicker로 식물 전체 사진 촬영 (화분 포함)
- [ ] 촬영 사진 미리보기 + "다시 촬영 / 캐릭터 만들기" 버튼
- [ ] "캐릭터 만들기" → 사진을 API 엔드포인트로 전송하는 로직까지만 구현
  - 백엔드 엔드포인트: `POST /api/character/generate` (multipart/form-data)
  - 응답이 올 때까지 로딩 UI (진행률 25% → 55% → 100% 애니메이션)
- [ ] 응답 수신 후 캐릭터 이미지 표시 (현재는 mock 이미지 사용)
- [ ] "다시 만들기 / 확인" 버튼

### 추후 구현 (스코프 밖)

- 캐릭터 커스텀 (액세서리, 색상 등)

---

## 3단계: 이름 붙이기 (`app/add-plant/name.tsx`)

- 텍스트 입력 (최대 8자 — 피그마 기준 `0/8`)
- 빈 이름 불가 (확인 버튼 비활성화)
- 확인 → 다음 단계

---

## 4단계: 개체 정보 입력 (`app/add-plant/info.tsx`)

### 입력 필드

| 필드 | 입력 방식 | 저장값 |
|------|-----------|--------|
| 위치 | 버튼 선택 (거실/침실/베란다/주방/사무실) | `string` |
| 햇빛 | 버튼 선택 4단계 (직사광/밝은간접광/간접광/어두움) | `string` |
| 식물 길이 | 슬라이더 or 숫자 직접 입력 (5 ~ 150cm) | `number` (cm) |
| 화분 지름 | 슬라이더 or 숫자 직접 입력 (5 ~ 40cm) | `number` (cm) |
| 흙 정보 | 텍스트 자유 입력 (기록용, 최대 100자) | `string` |
| 마지막 물 준 날 | 날짜 피커 | `Date` |
| 마지막 분갈이 날 | 날짜 피커 | `Date` |

### 완료 시 동작

1. 전체 데이터 `POST /api/plants` 로 전송
2. 성공 → 개체 상세 탭으로 이동 (방금 만든 캐릭터 표시)
3. 실패 → 에러 토스트 표시 (데이터 유지)

---

## 전체 상태 흐름

```
index (종 선택)
  └─ plantSpecies: { cntntsNo, scientificName, commonNameKo, ... }
  └─ plantNetResult: { score, imageUrl, ... } | null

character (캐릭터 생성)
  └─ characterImageUrl: string
  └─ capturedPhotoUri: string

name (이름)
  └─ nickname: string

info (개체 정보)
  └─ location, lightLevel, plantHeight, potDiameter, soilNote, lastWateredAt, lastRepottedAt
```

Expo Router params로 단계 간 전달, 또는 `add-plant/` 스코프 Context로 관리.
