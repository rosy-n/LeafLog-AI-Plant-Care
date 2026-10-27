# LeafLog — AI 식물 돌봄 애플리케이션

LeafLog는 식물 등록과 돌봄 일정, 식물 사진 기반 캐릭터 생성, 병해충 상담,
식물 캐릭터와의 페르소나 대화, 토양 수분 센서 연동을 다루는 졸업 프로젝트다.
이 자료는 모바일 앱·API·AI 실험 및 설정·펌웨어의 소스코드 제출본이다.

## 구성

| 경로 | 내용 |
|---|---|
| `apps/mobile` | Expo / React Native / TypeScript 모바일 앱과 UI·음원 리소스 |
| `apps/api` | FastAPI 백엔드, SQL 스키마 변경 스크립트, 테스트 |
| `apps/firmware` | ESP32-S3 토양 수분 센서 펌웨어와 설정 예시 |
| `ai/character-generation` | SDXL LoRA 학습·추론 설정, 모델 출처·해시·환경 기록 |
| `ai/diagnosis` | CLIP·Qdrant 기반 유사 사례 검색 및 진단 프로토타입 |
| `ai/persona-chat` | 페르소나 프롬프트와 대화 테스트 CLI |
| `data` | 식물 정보 적재에 사용하는 참고 데이터 |
| `docs` | 데이터베이스 스키마, 기술 설계와 검증 안내 |
| `ops` | AWS 및 GPU 서버 배포 템플릿 |

## 모바일 실행

Node.js 22.13.0 이상과 Expo SDK 57을 지원하는 실행 환경이 필요하다.

```powershell
cd apps/mobile
npm ci
Copy-Item .env.example .env.local
npm start -- --clear
```

`apps/mobile/.env.local`의 `EXPO_PUBLIC_API_BASE_URL`을 휴대폰에서 접근할 수 있는
백엔드 주소로 지정한다. 같은 네트워크의 개발 PC를 사용할 때는 PC의 LAN IP와
8000 포트를 지정한다. 휴대폰의 `localhost`는 휴대폰 자신을 가리킨다.
식물 종 식별에는 PlantNet 키 등 해당 기능의 외부 API 설정이 추가로 필요하다.
Expo 계정과 기기 조건 등 상세 절차는 [모바일 안내](apps/mobile/README.md)를 참고한다.

## API 기본 실행 및 제한된 로컬 확인

Python 3.11 환경에서 아래 명령을 실행한다. 설치 의존성에는 이미지 처리와
AI 관련 패키지가 포함되어 있어 설치 용량과 시간이 필요하다.

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

로컬 실행용 `apps/api/.env`에서 아래 값을 명시적으로 설정한다.
`.env.example`의 PostgreSQL 주소 예시를 그대로 사용하는 대신 SQLite로 변경한다.

```dotenv
APP_ROLE=standalone
DATABASE_URL=sqlite:///./leaflog.db
SECRET_KEY=replace-with-your-own-random-secret
CHARACTER_GENERATION_ENABLED=true
CHARACTER_MOCK_GENERATION=true
CHARACTER_GPU_MODE_COMMAND=
CHARACTER_GPU_SSH_HOST=
CHARACTER_RESTORE_OLLAMA=false
```

`SECRET_KEY`는 본인이 생성한 임의 값으로 교체한다. 이후 API를 시작한다.

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`http://127.0.0.1:8000/health`와 `/docs`에서 상태와 API 명세를 확인할 수 있다.
이 구성은 기본 로그인·API 연결 및 등록 응답 흐름을 확인하기 위한 설정이다.
`CHARACTER_MOCK_GENERATION=true`는 입력 사진을 활용하는 모의 생성이며 실제
SDXL 캐릭터 생성이나 전체 AI 기능을 재현하지 않는다. 이미지 처리 기능은
최초 사용 시 추가 모델 다운로드가 필요할 수 있다. 제출본에 대해 전체 서비스
실행 또는 운영 환경의 재현이 검증되었다는 의미는 아니다.

## 전체 기능의 외부 준비 사항

- 운영 DB 및 기존 데이터: PostgreSQL, [DB 스키마](docs/database-schema.sql),
  필요한 마이그레이션과 식물 정보 적재. 새 DB와 기존 DB의 적용 순서를 구분한다.
- 캐릭터 생성: Forge, SDXL 베이스, 자체 LoRA, VAE, ControlNet 및 GPU 환경.
  [모델 목록·출처](ai/character-generation/ARTIFACTS.md)와
  [추론 안내](ai/character-generation/INFERENCE.md)를 따른다.
- 병해충 상담: CLIP 모델, Qdrant와 실제 참고 이미지·라벨 인덱스,
  Ollama 및 코드에서 사용하는 Qwen 모델.
- 페르소나 대화: Ollama 및 Qwen 모델, `ai/persona-chat/prompts`.
- 외부 정보: PlantNet, 농사로, 기상청·에어코리아 등 사용하는 기능별 API 설정.
- 분리 배포: AWS API·GPU worker 설정, S3·SQS·접근 권한 및 서비스 간 인증.
  [AWS 템플릿](ops/aws/README.md)을 참고한다.
- 센서: ESP32-S3, 토양 수분 센서, Wi-Fi 설정과 기기 등록 토큰.
  [펌웨어 안내](apps/firmware/README.md)를 참고한다.

## 제출본 범위 및 제한

모델 가중치, 학습용 원본 이미지·캡션, 실제 진단 이미지·라벨과 Qdrant 저장소,
운영 DB, 개인 업로드 사진, API 키와 접속 인증정보는 포함하지 않는다.
모델의 파일명·해시와 알려진 출처는 설정 및 모델 목록 문서에 보존했다.
따라서 소스 ZIP만으로 운영 데이터와 모든 AI 기능을 즉시 실행할 수는 없다.

현재 모바일 구현에서 달력 일지 텍스트·사진은 화면 상태에 보관되며 화면을
벗어나면 사라질 수 있다. 영양제·분갈이 화면의 사진 버튼은 아직 사진 선택·업로드
기능과 연결되어 있지 않다. 물주기·비료 돌봄 기록의 API 저장과 구분해야 한다.

외부 데이터·모델·음원·폰트 등은 각 원 출처의 조건을 따른다. 관련 출처 및
기존 라이선스 안내는 해당 폴더 문서에 보존했다. 이 제출본이 제삼자 자료에
새로운 이용 허락을 부여하는 것은 아니다.
