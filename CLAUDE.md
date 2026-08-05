# LeafLog — Mobile App

AI 기반 반려식물 관리 앱. 초보 식집사가 식물을 등록·관리하고, 도트 캐릭터와 상호작용하는 React Native 앱.

## Tech Stack

- **Mobile**: React Native + Expo + TypeScript
- **Navigation**: Expo Router (file-based)
- **Backend**: Python FastAPI + PostgreSQL (apps/api/)
- **AI**: PlantNet API (식물종 인식), 농사로 OpenAPI (식물 상세 정보), FLUX (도트 캐릭터 생성 — 현재 미완성)

## Key Commands

```bash
# Mobile
cd apps/mobile && npx expo start

# Backend
cd apps/api && uvicorn main:app --reload

# DB
docker-compose up -d
```

## Project Structure (Mobile)

```
apps/mobile/
├── app/
│   ├── index.tsx              # 홈
│   └── add-plant/
│       ├── index.tsx          # 1단계: 식물종 선택 (카메라 | 검색)
│       ├── info.tsx           # 2단계: 도트 캐릭터 생성
│       ├── name.tsx           # 3단계: 이름 붙이기
│       └── character.tsx      # 4단계: 개체 정보 입력
├── constants/
│   ├── colors.ts
│   ├── fonts.ts
│   ├── nongsaro-codes.json    # 농사로 코드 표 — 앱/백엔드 공용 단일 정의
│   └── nongsaro-codes.ts      # 위 JSON에 타입만 붙인 re-export
└── services/
    ├── plantnet.ts            # PlantNet API 호출
    └── nongsaro.ts            # 농사로 API 호출
```

## 종 마스터 적재 (apps/api/scripts/ingest/)

`plant_species`는 외부 4개 소스를 **배치에서 병합해 미리 채워두는 마스터 테이블**이다.
런타임(`GET /api/species`)은 이 테이블 한 행만 읽고 외부 API를 호출하지 않는다.

```
apps/api/scripts/ingest/
├── nongsaro_codes.py   # 앱과 공용인 nongsaro-codes.json 로더
├── _common.py          # 학명 정규화, ingest_run, upsert
├── kfs_file.py         # 산림청 CSV      → src_kfs_species    (크기/개화기/결실기)
├── rda_indoor.py       # 농사로 OpenAPI  → src_rda_indoor     (광원/물주기/온습도/난이도)
├── aspca_snapshot.py   # ASPCA 스크래핑  → data/aspca-toxic-plants.csv (1회 실행)
├── aspca.py            # 위 CSV          → src_aspca_toxicity (반려동물 독성)
├── nature_kna.py       # 국립수목원 API  → src_nature_taxon   (분류/원산지/분포, 키 미발급)
├── merge.py            # src_* → plant_species 병합
└── run_all.py          # 위 전체를 순서대로
```

필드 충돌 우선순위와 소스별 담당 필드는 `docs/database-schema.sql`의 "2-3" 섹션 주석이 기준.

## Design Tokens
- 색상/폰트는 `constants/colors.ts`, `constants/fonts.ts` 만 사용
- 인라인 hex, 하드코딩 스타일 금지


## Active Branch

`feature/plant-registration` — 현재 개발 중

## Coding Rules

- 컴포넌트는 함수형 + TypeScript 타입 필수
- API 키는 `.env`에만, 코드에 하드코딩 금지
- `services/` 밖에서 직접 fetch 호출 금지 — 반드시 service 함수 경유
- 농사로 코드 표는 `constants/nongsaro-codes.json` 에만 정의 — 앱은
  `constants/nongsaro-codes.ts`, 백엔드는 `scripts/ingest/nongsaro_codes.py` 경유로만 접근.
  코드 값을 TS/Python 어느 쪽에도 다시 적지 말 것 (표가 어긋난다)
- HTML 렌더링 코드(`render_html`, `webbrowser` 등)는 웹 테스트용 — 앱에 절대 이식 금지

## Currently Implementing: 개체 추가탭 (add-plant/)

세부 로직은 `@docs/add-plant-flow.md` 참조.
API 연동 세부사항은 `@docs/api-integration.md` 참조.
