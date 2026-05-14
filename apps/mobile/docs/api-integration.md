# API 연동 상세 (`services/`)

---

## 1. PlantNet API (`services/plantnet.ts`)

### 엔드포인트

```
POST https://my-api.plantnet.org/v2/identify/{project}?api-key={KEY}&lang=en&include-related-images=true
```

- `project`: `"all"` 고정
- API 키: `.env`의 `EXPO_PUBLIC_PLANTNET_API_KEY`

### 요청 형식

```typescript
// multipart/form-data
// - images: File (최대 5장, 현재는 1장)
// - organs: 'leaf' | 'flower' | 'fruit' | 'bark' | 'auto'
//   → 사용자가 부위 선택. "잘 모르겠어요" 선택 시 'auto'
```

### 응답 → 앱 타입 매핑

```typescript
interface PlantNetResult {
  score: number;                         // 0~1 → UI에서 % 표시
  scientificName: string;                // species.scientificNameWithoutAuthor
  commonNames: string[];                 // species.commonNames (최대 2개 표시)
  family: string;                        // species.family.scientificNameWithoutAuthor
  iucnCategory: string | null;           // iucn.category (LC, NT, VU 등)
  referenceImages: { url: string }[];    // images[].url.m (썸네일)
}
```

### 주의사항

- 응답 `results` 배열 중 상위 3개만 사용
- 신뢰도 < 10% 이면 "식별 결과가 불확실해요" 안내
- CORS: 앱에서 직접 호출 가능 (API 키 설정 페이지에서 expose 허용 후 도메인 등록 필요)
- 테스트 완료된 로직: `api_test.py` 참고 (HTML 출력 부분 제외)

---

## 2. 농사로 OpenAPI (`services/nongsaro.ts`)

### Base URL

```
http://api.nongsaro.go.kr/service/garden
```

- API 키: `.env`의 `EXPO_PUBLIC_NONGSARO_API_KEY`
- 응답 형식: XML (UTF-8)
- 결과코드 `00` = 정상, 그 외는 에러

### 2-1. 식물 목록 검색 (`gardenList`)

```
GET /gardenList?apiKey={KEY}&sType=sCntntsSj&sText={검색어}&numOfRows=10&pageNo=1
```

응답에서 추출: `cntntsNo`, `cntntsSj` (식물명), `rtnThumbFileUrl` (썸네일)

### 2-2. 식물 상세 (`gardenDtl`)

```
GET /gardenDtl?apiKey={KEY}&cntntsNo={번호}
```

파싱 로직: `constants/nongsaro-codes.ts`의 코드 맵 사용
핵심 추출 필드:

| API 필드 | 앱 필드 | 비고 |
|----------|---------|------|
| `distbNm` | `commonNameKo` | 없으면 `cntntsSj` |
| `plntzrNm` | `commonNameEn` | |
| `plntbneNm` | `scientificName` | |
| `managelevelCode` | `difficulty` | MANAGE_LEVEL_MAP |
| `lighttdemanddoCode` | `lightLevel` | LIGHT_LEVEL_MAP |
| `grwhTpCode` | `tempRange` | GROWTH_TEMP_RANGE |
| `hdCode` | `humidityRange` | HUMIDITY_RANGE |
| `watercycleSprngCode` | `wateringDays` | WATER_CYCLE_DAYS (봄 기준) |
| `toxctyInfo` | `isToxic`, `toxicityInfo` | 텍스트 있으면 toxic=true |
| `dlthtsCode` | `pests` | PEST_CODE, 콤마 구분 |

### 2-3. 식물 이미지 (`gardenFileList`)

```
GET /gardenFileList?apiKey={KEY}&cntntsNo={번호}
```

추출: `rtnFileUrl` (원본), `rtnThumbFileUrl` (썸네일)
앱에서는 썸네일 우선 사용, 첫 번째 이미지가 대표 이미지

### XML 파싱 (React Native에서)

```typescript
// react-native-xml2js 또는 fast-xml-parser 사용
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser();
const result = parser.parse(xmlText);
const items = result.response.body.items.item;
// items가 단일 객체일 수 있으므로 Array.isArray 체크 필수
const list = Array.isArray(items) ? items : [items];
```

---

## 3. 캐릭터 생성 API (`POST /api/character/generate`)

### 현재 상태: 엔드포인트 존재하지 않음 — 프론트엔드 로직만 구현

```typescript
// 구현할 것:
const formData = new FormData();
formData.append('image', {
  uri: photoUri,
  type: 'image/jpeg',
  name: 'plant.jpg',
} as any);

// 실제 호출 대신 mock 응답 사용
// const response = await fetch(`${API_BASE}/api/character/generate`, {
//   method: 'POST',
//   body: formData,
// });

// Mock: 2초 딜레이 후 더미 이미지 URL 반환
await new Promise(resolve => setTimeout(resolve, 2000));
return { characterImageUrl: 'https://placeholder-dot-character.png' };
```

---

## 공통 규칙

- 모든 API 호출은 `services/` 디렉토리에서만
- 에러 시 앱 크래시 금지 — try/catch + 사용자 피드백 필수
- API 키는 `.env`에만, `EXPO_PUBLIC_` prefix 필수 (Expo 클라이언트 노출)
- 로딩 상태는 `isLoading` boolean으로 관리, skeleton UI 또는 ActivityIndicator 표시
