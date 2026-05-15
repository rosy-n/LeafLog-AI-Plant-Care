# Pl@ntNet API 레퍼런스

> **출처**: https://my-api.plantnet.org (공식 문서: https://my-api.plantnet.org/docs)  
> **목적**: LeafLog 프로젝트의 식물 종 인식 기능에 활용  
> **버전**: v2

---

## 1. 개요

Pl@ntNet API는 딥러닝 기반 식물 시각 인식 엔진에 대한 RESTful 접근을 제공한다.  
한 번의 요청에 **1~5장의 이미지**를 제출하면, 가능성 높은 식물 종 목록과 각각의 신뢰도 점수를 반환한다.

- 엔진: DINOv2 기반 최신 딥러닝 모델, 커뮤니티 기여로 지속 업데이트
- 인식 성능은 학습 DB의 이미지 수에 따라 종마다 다름
- 이미지 품질이 인식 정확도에 직접 영향을 미침

---

## 2. 인증 및 API Key

### API Key 발급

1. https://my-api.plantnet.org 에서 계정 생성
2. `/settings/api-key` 페이지에서 Private API Key 발급
3. 모든 요청의 **쿼리 파라미터**로 전달 (Body가 아님)

```
?api-key=YOUR-PRIVATE-API-KEY-HERE
```

### CORS 설정 (브라우저에서 직접 호출할 경우)

계정 API Key 설정 페이지에서 **"expose my API key"** 체크 후:
- **Authorized domains**: 허용할 도메인을 줄바꿈으로 추가  
  (주의: `http://domain.com`과 `https://domain.com`은 서로 다른 origin으로 취급)
- **Authorized IPs**: 서버 사이드에서도 함께 쓸 경우 서버 IP를 IPv4 또는 CIDR 형식으로 추가

> **LeafLog 권장**: 모바일 앱 → 서버 사이드에서 호출하는 구조이므로 CORS 설정 불필요.  
> FastAPI 백엔드에서 API key를 환경변수로 관리하고, 서버에서만 호출할 것.

---

## 3. 핵심 엔드포인트

### POST `/v2/identify/{project}`

식물 이미지를 제출하여 종 인식 결과를 반환한다.

**Base URL**: `https://my-api.plantnet.org`

#### 요청 형식: `multipart/form-data`

| 파라미터 | 위치 | 설명 | 필수 |
|----------|------|------|------|
| `api-key` | Query | 발급받은 API Key | ○ |
| `project` | Path | 식물 플로라 범위 (아래 참고) | ○ |
| `images` | Form | 이미지 파일 (1~5개) | ○ |
| `organs` | Form | 각 이미지의 기관 정보 (images와 순서 대응) | ○ |
| `lang` | Query | 결과 언어 코드 (기본: `en`) | - |
| `include-related-images` | Query | 관련 이미지 포함 여부 (기본: `false`) | - |
| `no-reject` | Query | 미인식 시 빈 결과 대신 최선 결과 반환 (기본: `false`) | - |
| `nb-results` | Query | 반환할 결과 수 (기본: `10`, 최대: `25`) | - |

#### `project` 값 (flora 범위)

| 값 | 설명 |
|----|------|
| `all` | 전체 (전 세계 모든 식물) — **LeafLog 기본 권장** |
| `k-world-flora` | Kew World Flora |
| `k-southwestern-europe` | 서유럽 |
| `k-british-isles` | 영국 제도 |
| 기타 | 공식 문서 `/docs/newfloras` 참고 |

#### `organs` 값 (이미지 기관 종류)

| 값 | 설명 |
|----|------|
| `flower` | 꽃 |
| `leaf` | 잎 |
| `fruit` | 열매 |
| `bark` | 나무껍질 |
| `auto` | 자동 감지 |

> 한 요청의 이미지들은 모두 **동일한 식물**이어야 한다.  
> `images`와 `organs` 파라미터는 **순서가 대응**되어야 한다.

---

## 4. 응답 형식

### 성공 응답 (`200 OK`)

```json
{
  "query": {
    "project": "all",
    "images": ["image_1", "image_2"],
    "organs": ["flower", "leaf"]
  },
  "language": "en",
  "preferedReferential": "k-southwestern-europe",
  "results": [
    {
      "score": 0.9952006530761719,
      "species": {
        "scientificNameWithoutAuthor": "Hibiscus rosa-sinensis",
        "scientificNameAuthorship": "L.",
        "genus": {
          "scientificNameWithoutAuthor": "Hibiscus",
          "scientificNameAuthorship": "L."
        },
        "family": {
          "scientificNameWithoutAuthor": "Malvaceae",
          "scientificNameAuthorship": "Juss."
        },
        "commonNames": [
          "Chinese hibiscus",
          "Hawaiian hibiscus",
          "Hibiscus"
        ]
      }
    }
  ],
  "remainingIdentificationRequests": 1228
}
```

### 주요 응답 필드

| 필드 | 설명 |
|------|------|
| `results[].score` | 신뢰도 점수 (0~1, 높을수록 확실) |
| `results[].species.scientificNameWithoutAuthor` | 학명 (저자 제외) |
| `results[].species.scientificNameAuthorship` | 학명 저자 |
| `results[].species.commonNames` | 일반명 목록 |
| `results[].species.genus.scientificNameWithoutAuthor` | 속명 |
| `results[].species.family.scientificNameWithoutAuthor` | 과명 |
| `remainingIdentificationRequests` | 남은 요청 횟수 (쿼터 관리용) |

---

## 5. 코드 예시

### Python (LeafLog FastAPI 백엔드 권장)

```python
import requests

PLANTNET_API_KEY = "YOUR-PRIVATE-API-KEY-HERE"  # .env에서 로드할 것
BASE_URL = "https://my-api.plantnet.org/v2/identify"

def identify_plant(image_paths: list[str], organs: list[str], project: str = "all", lang: str = "ko") -> dict:
    """
    식물 이미지 인식 요청
    
    Args:
        image_paths: 로컬 이미지 파일 경로 목록 (1~5개)
        organs: 각 이미지의 기관 ('flower', 'leaf', 'fruit', 'bark', 'auto')
        project: 플로라 범위 (기본: 'all')
        lang: 결과 언어 (기본: 'ko')
    
    Returns:
        인식 결과 dict (results 배열 + remainingIdentificationRequests)
    """
    assert 1 <= len(image_paths) <= 5, "이미지는 1~5개만 허용"
    assert len(image_paths) == len(organs), "images와 organs 수가 같아야 함"

    files = []
    data = []

    for path, organ in zip(image_paths, organs):
        files.append(("images", open(path, "rb")))
        data.append(("organs", organ))

    url = f"{BASE_URL}/{project}"
    params = {"api-key": PLANTNET_API_KEY, "lang": lang}

    try:
        response = requests.post(url, files=files, data=data, params=params)
        response.raise_for_status()
        return response.json()
    except requests.HTTPError as e:
        raise Exception(f"PlantNet API 오류 {response.status_code}: {response.text}") from e
    finally:
        for _, f in files:
            f.close()


def parse_top_result(result: dict) -> dict | None:
    """
    인식 결과에서 1위 식물 정보만 추출
    
    Returns:
        {scientificName, commonName, genus, family, score} 또는 None
    """
    results = result.get("results", [])
    if not results:
        return None

    top = results[0]
    species = top["species"]
    return {
        "scientificName": species["scientificNameWithoutAuthor"],
        "commonName": species["commonNames"][0] if species["commonNames"] else None,
        "allCommonNames": species["commonNames"],
        "genus": species["genus"]["scientificNameWithoutAuthor"],
        "family": species["family"]["scientificNameWithoutAuthor"],
        "score": top["score"],
        "remainingRequests": result.get("remainingIdentificationRequests"),
    }
```

### FastAPI 엔드포인트 연동 예시

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Annotated
import tempfile, os, shutil

router = APIRouter(prefix="/plants/identify", tags=["plant-identify"])

ORGAN_OPTIONS = ["flower", "leaf", "fruit", "bark", "auto"]

@router.post("/")
async def identify_plant_endpoint(
    images: Annotated[list[UploadFile], File(description="식물 이미지 (1~5개)")],
    organs: list[str],  # Query 파라미터로 받거나 Form으로 받을 것
):
    if not (1 <= len(images) <= 5):
        raise HTTPException(status_code=400, detail="이미지는 1~5개만 허용됩니다.")
    if len(images) != len(organs):
        raise HTTPException(status_code=400, detail="images와 organs 수가 같아야 합니다.")
    if any(o not in ORGAN_OPTIONS for o in organs):
        raise HTTPException(status_code=400, detail=f"organs 값은 {ORGAN_OPTIONS} 중 하나여야 합니다.")

    # 임시 파일로 저장 후 PlantNet 호출
    tmp_paths = []
    try:
        for img in images:
            suffix = os.path.splitext(img.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                shutil.copyfileobj(img.file, tmp)
                tmp_paths.append(tmp.name)

        raw_result = identify_plant(tmp_paths, organs)
        top = parse_top_result(raw_result)

        return {
            "topResult": top,
            "allResults": raw_result.get("results", [])[:5],  # 상위 5개만 반환
        }
    finally:
        for p in tmp_paths:
            if os.path.exists(p):
                os.remove(p)
```

### JavaScript (React Native 앱에서 직접 호출하는 경우)

> ⚠️ **주의**: 앱에서 직접 호출 시 API Key가 노출될 수 있음. 서버 사이드 호출을 강력히 권장.

```javascript
import FormData from 'form-data';

const identifyPlant = async (imageUri, organ = 'auto') => {
  const project = 'all';
  const apiKey = process.env.EXPO_PUBLIC_PLANTNET_API_KEY; // 서버 경유 권장

  const form = new FormData();
  form.append('organs', organ);
  form.append('images', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'plant.jpg',
  });

  const response = await fetch(
    `https://my-api.plantnet.org/v2/identify/${project}?api-key=${apiKey}&lang=ko`,
    { method: 'POST', body: form }
  );

  if (!response.ok) {
    throw new Error(`PlantNet API error: ${response.status}`);
  }

  return response.json();
};
```

---

## 6. 오류 처리

| HTTP 상태코드 | 원인 | 대응 |
|--------------|------|------|
| `200` | 정상 | `results` 배열 확인 |
| `400` | 잘못된 요청 (파라미터 오류 등) | 요청 형식 확인 |
| `401` | API Key 없음 또는 무효 | Key 재확인 |
| `404` | project 값 오류 | 올바른 project 값 사용 |
| `429` | 쿼터 초과 | `remainingIdentificationRequests` 모니터링 |
| `500` | 서버 오류 | 재시도 또는 문의 |

> `results`가 빈 배열이면 식물을 인식하지 못한 것.  
> `no-reject=true` 옵션 사용 시 확신이 낮아도 최선의 결과를 반환한다.

---

## 7. LeafLog 활용 시나리오

### 식물 등록 플로우

```
사용자가 식물 사진 촬영 (앱)
  → 이미지 서버 업로드 (FastAPI)
  → PlantNet API 호출 (서버 사이드)
  → score 0.5 이상이면 자동 식별 제안
  → score 낮으면 "확인이 어렵습니다, 직접 선택해주세요" 안내
  → 식별된 학명으로 농사로 API gardenList 검색
  → 케어 가이드 데이터 연결
```

### 이미지 품질 가이드 (사용자 안내용)

- 꽃, 잎, 열매 등 **특징적인 부위를 명확하게** 촬영
- **배경이 단순**할수록 인식률 향상
- **여러 장(2~3장)** 제출 시 정확도 향상 (꽃 + 잎 조합 권장)
- 흐리거나 역광 이미지는 피할 것

### 신뢰도 점수 활용 기준 (권장)

| score 범위 | 처리 방식 |
|-----------|-----------|
| `0.9` 이상 | 자동 식별 확정, 사용자에게 결과 표시 |
| `0.5 ~ 0.9` | 후보 목록 제시, 사용자가 선택 |
| `0.5` 미만 | "인식 어려움" 안내, 직접 검색 유도 |

### 쿼터 관리

- 응답의 `remainingIdentificationRequests` 필드로 남은 요청 수 모니터링
- DB에 인식 결과 캐싱하여 같은 식물 중복 호출 방지
- 쿼터 현황: 계정 Dashboard에서 확인 가능

---

## 8. 주의사항

- **API Key 보안**: 절대 앱 번들이나 레포에 하드코딩 금지. `.env`에서 `PLANTNET_API_KEY=...` 로 관리.
- **동일 식물 원칙**: 한 요청의 1~5장 이미지는 모두 같은 식물이어야 함.
- **이미지 크기**: 너무 크면 업로드 시간이 길어짐. 1~2MB 이하로 리사이즈 권장. (공식 FAQ 참고)
- **organs 순서**: `images` 파라미터와 `organs` 파라미터는 **인덱스 순서가 정확히 대응**되어야 함.
- **상세 API 문서**: https://my-api.plantnet.org/docs 에서 single-species, diseases, varieties 등 추가 엔드포인트 확인 가능.
