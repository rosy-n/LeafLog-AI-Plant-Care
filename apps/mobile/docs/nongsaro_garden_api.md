# 농사로 Open API - 실내정원용 식물 서비스 (garden)

> **출처**: 농촌진흥청 농사로 Open API 공식 매뉴얼  
> **목적**: LeafLog 프로젝트의 식물 정보(광량, 물주기, 병충해, 관리 조건 등) 조회에 활용

---

## 1. 개요 및 인증

- **기관**: 농촌진흥청 농사로
- **형식**: REST (XML) / AJAX (JavaScript)
- **인코딩**: UTF-8
- **서비스명**: `garden`
- **인증키 신청**: 농사로 로그인 후 [Open API 이용안내] 페이지에서 신청

### 인증키 사용법

모든 요청에 `apiKey` 파라미터를 포함해야 한다.

```
http://api.nongsaro.go.kr/service/garden/{오퍼레이션명}?apiKey={발급받은인증키}
```

---

## 2. 응답 구조 (XML)

### 목록 형식 (list 오퍼레이션)

```xml
<response>
  <header>
    <resultCode>00</resultCode>      <!-- 결과코드 -->
    <resultMsg>정상</resultMsg>
    <requestParameter>...</requestParameter>
  </header>
  <body>
    <items>
      <item>
        <!-- 서비스 항목 -->
      </item>
    </items>
    <numOfRows>10</numOfRows>    <!-- 페이지당 건수 -->
    <pageNo>1</pageNo>
    <totalCount>100</totalCount>
  </body>
</response>
```

### 단건 형식 (dtl 오퍼레이션)

```xml
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>정상</resultMsg>
  </header>
  <body>
    <item>
      <!-- 서비스 항목 -->
    </item>
  </body>
</response>
```

---

## 3. 결과 코드

| 코드 | 설명 |
|------|------|
| `00` | 정상 (검색 결과 없음도 포함) |
| `11` | 인증키 누락 또는 잘못된 인증키 |
| `12` | 인증키 일시 중지 (관리자 문의) |
| `13` | 존재하지 않는 서비스/오퍼레이션 |
| `15` | AJAX 방식: 신청한 도메인 외 호출 |
| `91` | 농사로 시스템 오류 |

---

## 4. 오퍼레이션 목록

| 오퍼레이션명 | 설명 | 페이징 |
|---|---|---|
| `lightList` | 광도요구 목록 | ○ |
| `grwhstleList` | 생육형태 목록 | ○ |
| `lefcolrList` | 잎색 목록 | ○ |
| `lefmrkList` | 잎무늬 목록 | ○ |
| `flclrList` | 꽃색 목록 | ○ |
| `fmldecolrList` | 열매색 목록 | ○ |
| `ignSeasonList` | 꽃피는 계절 목록 | ○ |
| `winterLwetList` | 겨울 최저온도 목록 | ○ |
| `priceTypeList` | 가격대 목록 | ○ |
| `waterCycleList` | 물주기 목록 | ○ |
| `gardenList` | **실내정원용 식물 목록** (검색·필터) | ○ |
| `gardenDtl` | **실내정원용 식물 상세** | - |
| `gardenFileList` | 실내정원용 식물 첨부파일 목록 | - |

---

## 5. 오퍼레이션 상세

### 5.1 코드 목록 오퍼레이션 (공통 구조)

아래 오퍼레이션들은 모두 동일한 구조: `apiKey` 하나만 필수, `code` + `codeNm` 반환

#### lightList - 광도요구 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/lightList?apiKey={key}`

| code | codeNm |
|------|--------|
| `055001` | 낮은 광도 (300~800 Lux) |
| `055002` | 중간 광도 (800~1,500 Lux) |
| `055003` | 높은 광도 (1,500~10,000 Lux) |

#### grwhstleList - 생육형태 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/grwhstleList?apiKey={key}`

| code | codeNm |
|------|--------|
| `054001` | 직립형 |
| `054002` | 관목형 |
| `054003` | 덩굴성 |
| `054004` | 풀모양 |
| `054005` | 로제트형 |
| `054006` | 다육형 |

#### lefcolrList - 잎색 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/lefcolrList?apiKey={key}`

| code | codeNm |
|------|--------|
| `069001` | 녹색, 연두색 |
| `069002` | 금색, 노란색 |
| `069003` | 흰색, 크림색 |
| `069004` | 은색, 회색 |
| `069005` | 빨강, 분홍, 자주색 |
| `069006` | 여러색 혼합 |
| `069007` | 기타 |

#### lefmrkList - 잎무늬 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/lefmrkList?apiKey={key}`

| code | codeNm |
|------|--------|
| `070001` | 줄무늬 |
| `070002` | 점무늬 |
| `070003` | 잎 가장자리 무늬 |
| `070004` | 기타 (무늬없음 등) |

#### flclrList - 꽃색 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/flclrList?apiKey={key}`

| code | codeNm |
|------|--------|
| `071001` | 파랑색 |
| `071002` | 보라색 |
| `071003` | 분홍색 |
| `071004` | 빨강색 |
| `071005` | 오렌지색 |
| `071006` | 노랑색 |
| `071007` | 흰색 |
| `071008` | 혼합색 |
| `071009` | 기타 |

#### fmldecolrList - 열매색 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/fmldecolrList?apiKey={key}`

| code | codeNm |
|------|--------|
| `081001` | 파랑색 |
| `081002` | 보라색 |
| `081003` | 검정색 |
| `081004` | 빨강색 |
| `081005` | 오렌지색 |
| `081006` | 노랑색 |
| `081007` | 흰색 |
| `081008` | 혼합색 |
| `081009` | 기타 |

#### ignSeasonList - 꽃피는 계절 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/ignSeasonList?apiKey={key}`

| code | codeNm |
|------|--------|
| `073001` | 봄 |
| `073002` | 여름 |
| `073003` | 가을 |
| `073004` | 겨울 |

#### winterLwetList - 겨울 최저온도 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/winterLwetList?apiKey={key}`

| code | codeNm |
|------|--------|
| `057001` | 0℃ 이하 |
| `057002` | 5℃ |
| `057003` | 7℃ |
| `057004` | 10℃ |
| `057005` | 13℃ 이상 |

#### priceTypeList - 가격대 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/priceTypeList?apiKey={key}`

| code | codeNm |
|------|--------|
| `068001` | 5천원 미만 |
| `068002` | 5천원~1만원 |
| `068003` | 1~3만원 |
| `068004` | 3~5만원 |
| `068005` | 5~10만원 |
| `068006` | 10만원 이상 |

#### waterCycleList - 물주기 목록
**URL**: `GET http://api.nongsaro.go.kr/service/garden/waterCycleList?apiKey={key}`

| code | codeNm |
|------|--------|
| `053001` | 항상 흙을 축축하게 유지함 (물에 잠김) |
| `053002` | 흙을 촉촉하게 유지함 (물에 잠기지 않도록 주의) |
| `053003` | 토양 표면이 말랐을 때 충분히 관수함 |
| `053004` | 화분 흙 대부분 말랐을 때 충분히 관수함 |

---

### 5.2 gardenList - 실내정원용 식물 목록

**URL**: `GET http://api.nongsaro.go.kr/service/garden/gardenList`

#### 요청 파라미터

| 파라미터 | 설명 | 필수 | 예시 |
|----------|------|------|------|
| `apiKey` | 인증키 | ○ | |
| `sType` | 검색구분 | | |
| `sText` | 검색어 | | `몬스테라` |
| `wordType` | 자음구분 | | |
| `word` | 자음 선택 | | `ㄱ`, `ㄴ` 등 |
| `lightChkVal` | 광도요구 | | `055001,055002` |
| `grwhstleChkVal` | 생육형태 | | `054001,054002` |
| `lefcolrChkVal` | 잎색 | | `069001,069002` |
| `lefmrkChkVal` | 잎무늬 | | `070001,070002` |
| `flclrChkVal` | 꽃색 | | `071001,071002` |
| `fmldecolrChkVal` | 열매색 | | `081001,081002` |
| `ignSeasonChkVal` | 꽃피는 계절 | | `073001,073002` |
| `winterLwetChkVal` | 겨울 최저온도 | | `057001,057002` |
| `priceType` | 가격대 구분 | | |
| `priceTypeSel` | 가격대 | | |
| `waterCycleSel` | 물주기 | | |
| `pageNo` | 페이지 번호 | | `1` |
| `numOfRows` | 페이지당 건수 | | `10` |

> **다중값 필터**: 콤마(`,`)로 구분해서 전달. 예) `lightChkVal=055001,055002`

#### 응답 필드

| 필드명 | 설명 |
|--------|------|
| `cntntsNo` | 컨텐츠 번호 (**상세 조회 시 사용**) |
| `cntntsSj` | 식물명 |
| `rtnFileUrl` | 저장 파일 URL (이미지) |
| `rtnThumbFileUrl` | 썸네일 파일 URL |
| `rtnOrginlFileNm` | 원본 파일명 |
| `rtnImageDc` | 이미지 설명 |

---

### 5.3 gardenDtl - 실내정원용 식물 상세

**URL**: `GET http://api.nongsaro.go.kr/service/garden/gardenDtl`

#### 요청 파라미터

| 파라미터 | 설명 | 필수 |
|----------|------|------|
| `apiKey` | 인증키 | ○ |
| `cntntsNo` | 컨텐츠 번호 (gardenList에서 획득) | ○ |

#### 응답 필드 (LeafLog에서 활용 가능한 핵심 필드)

**기본 정보**

| 필드명 | 설명 |
|--------|------|
| `cntntsNo` | 컨텐츠 번호 |
| `plntbneNm` | 식물 학명 |
| `plntzrNm` | 식물 영명 |
| `distbNm` | 유통명 |
| `fmlNm` | 과명 |
| `orgplceInfo` | 원산지 정보 |
| `adviseInfo` | 조언 정보 |
| `toxctyInfo` | **독성 정보** |
| `fncltyInfo` | 기능성 정보 |

**생육 환경 조건** (LeafLog 케어 가이드 핵심)

| 필드명 | 설명 |
|--------|------|
| `grwhTpCode` / `grwhTpCodeNm` | **생육 온도** |
| `winterLwetTpCode` / `winterLwetTpCodeNm` | **겨울 최저 온도** |
| `hdCode` / `hdCodeNm` | **습도** |
| `lighttdemanddoCode` / `lighttdemanddoCodeNm` | **광요구도** |
| `watercycleSprngCode` / `watercycleSprngCodeNm` | **물주기 - 봄** |
| `watercycleSummerCode` / `watercycleSummerCodeNm` | **물주기 - 여름** |
| `watercycleAutumnCode` / `watercycleAutumnCodeNm` | **물주기 - 가을** |
| `watercycleWinterCode` / `watercycleWinterCodeNm` | **물주기 - 겨울** |
| `soilInfo` | 토양 정보 |
| `frtlzrInfo` | 비료 정보 |

**관리 정보**

| 필드명 | 설명 |
|--------|------|
| `managelevelCode` / `managelevelCodeNm` | 관리수준 (초보자/경험자/전문가) |
| `managedemanddoCode` / `managedemanddoCodeNm` | 관리요구도 |
| `grwtveCode` / `grwtveCodeNm` | 생장속도 |
| `dlthtsCode` / `dlthtsCodeNm` | **병충해 코드** (콤마 구분) |
| `dlthtsManageInfo` | **병충해 관리 정보** |
| `speclmanageInfo` | 특별관리 정보 |
| `prpgtEraInfo` | 번식 시기 정보 |

**크기 및 가격 정보**

| 필드명 | 설명 |
|--------|------|
| `growthHgInfo` | 성장 높이 |
| `growthAraInfo` | 성장 넓이 |
| `flpodmtBigInfo` / `flpodmtMddlInfo` / `flpodmtSmallInfo` | 화분 직경 (대/중/소) |
| `pcBigInfo` / `pcMddlInfo` / `pcSmallInfo` | 가격 (대/중/소) |

**분류 코드** (복수값은 콤마로 구분)

| 필드명 | 설명 |
|--------|------|
| `clCode` / `clCodeNm` | 분류 코드 |
| `grwhstleCode` / `grwhstleCodeNm` | 생육형태 |
| `postngplaceCode` / `postngplaceCodeNm` | **배치장소** |
| `lefcolrCode` / `lefcolrCodeNm` | 잎색 |
| `flclrCode` / `flclrCodeNm` | 꽃색 |

---

### 5.4 gardenFileList - 첨부파일 목록

**URL**: `GET http://api.nongsaro.go.kr/service/garden/gardenFileList`

#### 요청 파라미터

| 파라미터 | 설명 | 필수 |
|----------|------|------|
| `apiKey` | 인증키 | ○ |
| `cntntsNo` | 컨텐츠 번호 | ○ |

#### 응답 필드

| 필드명 | 설명 |
|--------|------|
| `cntntsNo` | 컨텐츠 번호 |
| `cntntsSj` | 컨텐츠 제목 |
| `rtnFileSn` | 파일 순번 |
| `rtnFileSeCode` | 파일 구분 코드 |
| `rtnFileSeCodeName` | 파일 구분 코드명 |
| `rtnImgSeCode` | 이미지 구분 코드 |
| `rtnImgSeCodeName` | 이미지 구분 코드명 |
| `rtnOrginlFileNm` | 원본 파일명 |
| `rtnImageDc` | 이미지 설명 |
| `rtnFileUrl` | 파일 URL |
| `rtnThumbFileUrl` | 썸네일 URL |

---

## 6. 전체 상세 코드 레퍼런스

### 생육 온도 (grwhTpCode)

| code | 범위 |
|------|------|
| `082001` | 10~15℃ |
| `082002` | 16~20℃ |
| `082003` | 21~25℃ |
| `082004` | 26~30℃ |

### 습도 (hdCode)

| code | codeNm |
|------|--------|
| `083001` | 40% 미만 |
| `083002` | 40~70% |
| `083003` | 70% 이상 |

### 관리수준 (managelevelCode)

| code | codeNm |
|------|--------|
| `089001` | 초보자 |
| `089002` | 경험자 |
| `089003` | 전문가 |

### 생장속도 (grwtveCode)

| code | codeNm |
|------|--------|
| `090001` | 빠름 |
| `090002` | 보통 |
| `090003` | 느림 |

### 관리요구도 (managedemanddoCode)

| code | codeNm |
|------|--------|
| `058001` | 낮음 (잘 견딤) |
| `058002` | 보통 (약간 잘 견딤) |
| `058003` | 필요함 |
| `058004` | 특별 관리 요구 |
| `058005` | 기타 |

### 배치장소 (postngplaceCode)

| code | codeNm |
|------|--------|
| `064001` | 실내 어두운 곳 (실내깊이 500cm 이상) |
| `064002` | 거실 내측 (실내깊이 300~500cm) |
| `064003` | 거실 창측 (실내깊이 150~300cm) |
| `064004` | 발코니 내측 (실내깊이 50~150cm) |
| `064005` | 발코니 창측 (실내깊이 0~50cm) |
| `064006` | 습한 곳 |
| `064007` | 넓은 곳 |
| `064008` | 좁은 곳 |

### 병충해 (dlthtsCode)

| code | codeNm |
|------|--------|
| `088001` | 진딧물 |
| `088002` | 응애 |
| `088003` | 깍지벌레 |
| `088004` | 총채벌레 |
| `088005` | 온실가루이 |

### 분류 (clCode)

| code | codeNm |
|------|--------|
| `072001` | 잎보기식물 |
| `072002` | 잎 & 꽃보기식물 |
| `072003` | 꽃보기식물 |
| `072004` | 열매보기식물 |
| `072005` | 선인장·다육식물 |

### 번식방법 (prpgtmthCode)

| code | codeNm |
|------|--------|
| `060001` | 파종 |
| `060002` | 삽목 |
| `060003` | 분주 |
| `060004` | 접목 |
| `060005` | 취목 |
| `060006` | 기타 |

### 생태 (eclgyCode)

| code | codeNm |
|------|--------|
| `086001` | 일반형 |
| `086002` | 건조형 |
| `086003` | 수경형 |

### 냄새 (smellCode)

| code | codeNm |
|------|--------|
| `079001` | 강함 |
| `079002` | 중간 |
| `079003` | 약함 |
| `079004` | 거의 없음 |

---

## 7. Python 파싱 예시

### REST XML 응답 파싱

```python
import requests
import xml.etree.ElementTree as ET

API_KEY = "발급받은인증키"
BASE_URL = "http://api.nongsaro.go.kr/service/garden"

def get_plant_list(search_text: str = "", page_no: int = 1, num_of_rows: int = 10):
    """식물 목록 조회"""
    params = {
        "apiKey": API_KEY,
        "sText": search_text,
        "pageNo": page_no,
        "numOfRows": num_of_rows,
    }
    response = requests.get(f"{BASE_URL}/gardenList", params=params)
    root = ET.fromstring(response.content)

    result_code = root.findtext("header/resultCode")
    if result_code != "00":
        raise Exception(f"API 오류: {result_code} - {root.findtext('header/resultMsg')}")

    plants = []
    for item in root.findall("body/items/item"):
        plants.append({
            "cntntsNo": item.findtext("cntntsNo"),
            "name": item.findtext("cntntsSj"),
            "imageUrl": item.findtext("rtnFileUrl"),
            "thumbUrl": item.findtext("rtnThumbFileUrl"),
        })

    total_count = int(root.findtext("body/totalCount") or 0)
    return {"plants": plants, "totalCount": total_count}


def get_plant_detail(cntnts_no: str) -> dict:
    """식물 상세 정보 조회 - LeafLog 케어 가이드 생성에 활용"""
    params = {"apiKey": API_KEY, "cntntsNo": cntnts_no}
    response = requests.get(f"{BASE_URL}/gardenDtl", params=params)
    root = ET.fromstring(response.content)

    result_code = root.findtext("header/resultCode")
    if result_code != "00":
        raise Exception(f"API 오류: {result_code}")

    item = root.find("body/item")
    if item is None:
        return {}

    return {
        # 기본 정보
        "cntntsNo": item.findtext("cntntsNo"),
        "scientificName": item.findtext("plntbneNm"),
        "englishName": item.findtext("plntzrNm"),
        "commonName": item.findtext("distbNm"),
        "origin": item.findtext("orgplceInfo"),
        "toxicity": item.findtext("toxctyInfo"),
        "advice": item.findtext("adviseInfo"),

        # 환경 조건 (센서 연동에 활용)
        "lightCode": item.findtext("lighttdemanddoCode"),
        "lightName": item.findtext("lighttdemanddoCodeNm"),
        "tempCode": item.findtext("grwhTpCode"),
        "tempName": item.findtext("grwhTpCodeNm"),
        "winterTempCode": item.findtext("winterLwetTpCode"),
        "winterTempName": item.findtext("winterLwetTpCodeNm"),
        "humidityCode": item.findtext("hdCode"),
        "humidityName": item.findtext("hdCodeNm"),

        # 물주기 (계절별)
        "waterSpring": item.findtext("watercycleSprngCodeNm"),
        "waterSummer": item.findtext("watercycleSummerCodeNm"),
        "waterAutumn": item.findtext("watercycleAutumnCodeNm"),
        "waterWinter": item.findtext("watercycleWinterCodeNm"),

        # 관리 정보
        "managementLevel": item.findtext("managelevelCodeNm"),
        "growthSpeed": item.findtext("grwtveCodeNm"),
        "soil": item.findtext("soilInfo"),
        "fertilizer": item.findtext("frtlzrInfo"),

        # 병충해
        "pestCodes": item.findtext("dlthtsCode"),       # 콤마 구분 복수값
        "pestNames": item.findtext("dlthtsCodeNm"),
        "pestManagement": item.findtext("dlthtsManageInfo"),
        "specialManagement": item.findtext("speclmanageInfo"),

        # 배치
        "placementCode": item.findtext("postngplaceCode"),
        "placementName": item.findtext("postngplaceCodeNm"),
    }


def get_plant_files(cntnts_no: str) -> list:
    """식물 첨부 이미지 목록 조회"""
    params = {"apiKey": API_KEY, "cntntsNo": cntnts_no}
    response = requests.get(f"{BASE_URL}/gardenFileList", params=params)
    root = ET.fromstring(response.content)

    files = []
    for item in root.findall("body/items/item"):
        files.append({
            "fileSn": item.findtext("rtnFileSn"),
            "fileType": item.findtext("rtnFileSeCodeName"),
            "imageType": item.findtext("rtnImgSeCodeName"),
            "description": item.findtext("rtnImageDc"),
            "fileUrl": item.findtext("rtnFileUrl"),
            "thumbUrl": item.findtext("rtnThumbFileUrl"),
        })
    return files
```

### 필터링 검색 예시

```python
# 낮은 광도 + 물 적게 주는 식물 (초보자용)
params = {
    "apiKey": API_KEY,
    "lightChkVal": "055001",          # 낮은 광도
    "waterCycleSel": "053004",        # 흙 대부분 말랐을 때 관수
    "pageNo": 1,
    "numOfRows": 20,
}
response = requests.get(f"{BASE_URL}/gardenList", params=params)
```

### FastAPI 연동 예시 (LeafLog 백엔드)

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/plants/nongsaro", tags=["nongsaro"])

class PlantSearchParams(BaseModel):
    searchText: str = ""
    lightCode: str = ""   # 055001, 055002, 055003
    waterCode: str = ""   # 053001~053004
    pageNo: int = 1
    numOfRows: int = 10

@router.get("/search")
async def search_plants(params: PlantSearchParams):
    try:
        result = get_plant_list(
            search_text=params.searchText,
            page_no=params.pageNo,
            num_of_rows=params.numOfRows,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/detail/{cntnts_no}")
async def plant_detail(cntnts_no: str):
    try:
        return get_plant_detail(cntnts_no)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
```

---

## 8. LeafLog 활용 시나리오

### 식물 등록 플로우

```
사용자가 식물 이름 입력
  → gardenList API로 검색 (sText={입력값})
  → 검색 결과 목록 표시 (식물명 + 썸네일)
  → 사용자 선택
  → gardenDtl API로 상세 정보 가져오기 (cntntsNo 사용)
  → DB에 식물 프로필 저장 (생육조건, 물주기, 배치장소 등 포함)
```

### 케어 가이드 생성

`gardenDtl` 응답의 아래 필드를 조합해 사용자에게 안내:

- **광량**: `lighttdemanddoCodeNm` → 창가 배치 여부 안내
- **계절별 물주기**: `watercycleSprng/Summer/Autumn/WinterCodeNm`
- **온도**: `grwhTpCodeNm`, `winterLwetTpCodeNm` → 센서 온도와 비교
- **습도**: `hdCodeNm` → 센서 습도와 비교
- **병충해**: `dlthtsCodeNm` + `dlthtsManageInfo`
- **독성**: `toxctyInfo` → 반려동물/아이 있는 가정 주의 알림

### RAG 데이터 구축

`gardenDtl` 전체 응답을 Vector DB에 저장하여 LLM 질의응답에 활용:

```python
# 식물 정보를 자연어 문서로 변환 후 임베딩
def build_rag_document(plant_detail: dict) -> str:
    return f"""
식물명: {plant_detail['commonName']} ({plant_detail['scientificName']})
원산지: {plant_detail['origin']}
광량 조건: {plant_detail['lightName']}
생육 온도: {plant_detail['tempName']}
겨울 최저 온도: {plant_detail['winterTempName']}
습도: {plant_detail['humidityName']}
물주기(봄): {plant_detail['waterSpring']}
물주기(여름): {plant_detail['waterSummer']}
물주기(가을): {plant_detail['waterAutumn']}
물주기(겨울): {plant_detail['waterWinter']}
관리 수준: {plant_detail['managementLevel']}
토양: {plant_detail['soil']}
비료: {plant_detail['fertilizer']}
병충해: {plant_detail['pestNames']}
병충해 관리: {plant_detail['pestManagement']}
특별 관리: {plant_detail['specialManagement']}
독성: {plant_detail['toxicity']}
조언: {plant_detail['advice']}
배치 장소: {plant_detail['placementName']}
"""
```

---

## 9. 주의사항

- **HTTPS 미지원**: API 기본 URL이 `http://`임. 프로덕션에서는 서버 사이드에서 호출하거나 프록시 처리 필요.
- **AJAX 방식**: 신청 시 등록한 도메인에서만 호출 가능 (결과코드 15). 개발 시 REST 방식 권장.
- **결과코드 00이지만 데이터 없음**: 검색 조건이 너무 좁을 때 정상 응답이지만 `items`가 비어있을 수 있음. `totalCount` 확인 필요.
- **복수값 필드**: `dlthtsCode`, `grwhstleCode` 등 일부 필드는 콤마로 구분된 복수값 반환. 파싱 시 `.split(",")` 처리 필요.
- **인증키 보안**: `.env` 파일에 `NONGSARO_API_KEY=...` 형태로 저장. 절대 레포에 커밋하지 말 것.
