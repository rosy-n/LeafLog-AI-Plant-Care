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
│   └── nongsaro-codes.ts      # 농사로 API 코드 매핑 (수정 금지)
└── services/
    ├── plantnet.ts            # PlantNet API 호출
    └── nongsaro.ts            # 농사로 API 호출
```

## Design Tokens
- 색상/폰트는 `constants/colors.ts`, `constants/fonts.ts` 만 사용
- 인라인 hex, 하드코딩 스타일 금지


## Active Branch

`feature/plant-registration` — 현재 개발 중

## Coding Rules

- 컴포넌트는 함수형 + TypeScript 타입 필수
- API 키는 `.env`에만, 코드에 하드코딩 금지
- `services/` 밖에서 직접 fetch 호출 금지 — 반드시 service 함수 경유
- 농사로 코드 파싱은 `constants/nongsaro-codes.ts`의 함수/맵만 사용
- HTML 렌더링 코드(`render_html`, `webbrowser` 등)는 웹 테스트용 — 앱에 절대 이식 금지

## Currently Implementing: 개체 추가탭 (add-plant/)

세부 로직은 `@docs/add-plant-flow.md` 참조.
API 연동 세부사항은 `@docs/api-integration.md` 참조.
