# Backend API

FastAPI backend for LeafLog.

## Implemented

- `GET /health`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /images/preprocess-plant`
- `POST /images/remove-background`
- `GET /api/species` — 종 마스터 검색 (국명/영문명/학명 부분일치)
- `GET /api/species/{species_id}` — 종 상세 (돌봄 정보 + 출처)
- `POST /images/remove-character-face`

Passwords are hashed with bcrypt. Login and signup return a bearer access token.

## Setup With Conda

```bash
cd apps/api
conda env create -f environment.yml
conda activate leaflog-api
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Setup With venv

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Database

By default the API uses local SQLite at `apps/api/leaflog.db` so the login flow can run immediately.

For PostgreSQL, set `DATABASE_URL`.

```bash
DATABASE_URL=postgresql://leaflog_user:비밀번호@<database-host>:5432/leaflog
```

The code normalizes this to SQLAlchemy's `postgresql+psycopg://` driver internally.

### 마이그레이션

`docs/database-schema.sql` 이 정의의 기준이고, 이미 만들어진 DB 에는 `scripts/*.sql` 을
슈퍼유저로 실행해 반영한다. 모두 재실행 안전(idempotent).

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/db-setup.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-care-tables.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-species-source-tables.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-care-schedule-source.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-persona-column.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-affinity-column.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-diary-tables.sql
```

**psql 은 기본이 localhost 다.** `.env` 의 `DATABASE_URL` 이 다른 호스트를 가리키면
`-h <호스트>` 를 반드시 붙여야 한다 — 안 붙이면 로컬 사본만 바뀌고 앱이 쓰는 DB는 그대로다.

`add-affinity-column.sql` 뒤에는 기존 돌봄 기록으로 애정도 초기값을 채운다
(생략하면 이전 기록이 0점으로 시작한다):

```powershell
cd apps/api; .\.venv\Scripts\python.exe scripts\backfill-affinity.py --dry-run   # 계산만
cd apps/api; .\.venv\Scripts\python.exe scripts\backfill-affinity.py             # 저장
```

`add-species-source-tables.sql` 은 `CREATE EXTENSION pg_trgm` 을 포함해 슈퍼유저가 필요하다.
서버 startup 의 `create_all` 은 없는 테이블만 만들고 기존 테이블에 컬럼을 추가하지 못하므로,
이 스크립트를 돌리지 않으면 `/api/species` 가 없는 컬럼을 조회해 실패한다.

## 캐릭터 이미지 주소

학교 서버에서 생성한 캐릭터는 `media_asset.file_url`에
`/generated/characters/<작업 ID>/candidate-1.png`처럼 경로만 저장한다.
`object_key`, 이미지 파일, 얼굴 좌표가 포함된 `checksum`은 유지한다. DB 컬럼 변경은 없다.

앱 조회 응답에는 현재 API 주소를 붙여 반환한다. 별도 이미지 서버를 쓰면
`CHARACTER_PUBLIC_BASE_URL`이 우선한다. 이 값을 설정한 경우 주소 변경 시 환경 설정도 바꿔야 한다.
S3와 외부 이미지 URL은 기존 저장·서명 방식을 유지한다.

기존 주소 정리는 **이 변경을 API에 반영한 뒤, 실제 생성 이미지가 있는 서버의 `apps/api`에서** 실행한다.

```bash
python scripts/normalize-character-urls.py
python scripts/normalize-character-urls.py --apply --backup ~/leaflog-backups/character-urls-before.json
```

첫 명령은 조회만 한다. 두 번째 명령은 원래 값을 새 백업 파일에 기록한 뒤 `ready` 항목의
`file_url`만 한 트랜잭션으로 바꾼다. 기존 백업은 덮어쓰지 않는다. 백업은 Git에 올리지 않는다.
파일 누락·키 불일치·체크섬 불일치 항목은 변경하지 않는다.
이 도구는 파일을 다른 PC로 옮기지 않으며, 경로만 바꿔서는 없는 이미지를 복구할 수 없다.

## 캐릭터 위치와 표시 크기

생성 후보는 누끼와 얼굴 제거 후 `character_framing.py`에서 표시 규격을 맞춘다.
`spaghetti.png`를 정사각형 영역에 표시했을 때를 기준으로 전체 높이는 약 68%,
바닥은 높이의 85% 위치를 사용한다. 화분 몸통이 기준 폭(24%)보다 크게 표시될 경우에는
높이 기준 배율과 몸통 기준 배율의 기하평균으로 축소를 완화한다. 몸통 크기를 강제로
통일하거나 모든 캐릭터를 같은 높이로 늘리지 않고, 몸통 비중에 따라 연속적으로 보정한다.
전체 폭은 68% 이내로 제한하고 한쪽으로 뻗은 잎이 잘리지 않도록 여백을 확보한다.
화분의 중심을 기준으로 이동하고 가로세로 비율을 유지한다. 표정 좌표도 같은 변환을 적용한다.
결과는 1024px 투명 PNG이며, 도트 색상이 섞이지 않도록 nearest 보간을 사용한다.

기존 학교 이미지에 적용할 때는 이미지 파일이 있는 서버의 `apps/api`에서 실행한다.
먼저 위의 주소 정리를 완료하고, API에 새 생성 후처리 코드를 배포한다.

```bash
python scripts/reframe-characters.py
python scripts/reframe-characters.py --apply --backup-dir ~/leaflog-backups/character-framing-before
```

기본 실행은 조회만 한다. 적용 시 원본 PNG와 DB 값을 새 백업 폴더에 보관하고,
새 파일명으로 이미지를 저장한 뒤 `file_url`, `object_key`, `checksum`을 함께 갱신한다.
원본 파일은 지우지 않으며, 새 URL로 이미지 캐시를 갱신한다. 백업은 Git에 올리지 않는다.
이미 정렬된 파일은 다시 처리하지 않는다. S3·외부 URL은 이 도구의 대상이 아니다.
이전 표시 규격으로 축소된 이미지는 `--source-manifest <이전 백업 폴더>/manifest.json`을
추가해야 한다. 현재 DB 값과 이전 기록이 일치할 때만 보관된 최초 원본과 원래 표정 좌표로
다시 처리한다. 이미 축소된 PNG를 재확대하지 않는다.
유효한 기존 체크섬이 파일과 다르면 건너뛴다. 체크섬이 없거나 과거 형식이 잘못된 경우에는
현재 경로의 실제 원본 파일을 백업하고 해시를 기록한 뒤 처리한다. 얼굴 좌표 형식 오류는 건너뛴다.

## 문의 답변 (inquiry)

앱 설정 → 도움말 → 문의하기로 들어온 내용은 `inquiry` 테이블에 쌓이고,
**답변을 달면 사용자가 앱의 문의 내역에서 바로 본다** (메일을 보내지 않는다).

관리자 화면은 따로 없다 — **FastAPI 의 `/docs` (Swagger UI)** 를 그대로 쓴다.

1. 관리자 계정으로 `POST /auth/login` → `access_token` 복사
2. `/docs` 우측 상단 **Authorize** 에 `Bearer <token>` 입력
3. `GET /api/admin/inquiries` — 미답변 목록 (`only_open=false` 면 전체)
4. `PATCH /api/admin/inquiries/{inquiry_id}` 에 `{"answer": "..."}` — 상태가
   자동으로 `ANSWERED` 가 되고 사용자 앱에 즉시 보인다. 다시 호출하면 수정된다.

관리자는 `app_user.role = 'ADMIN'` 인 계정뿐이다. 일반 계정은 403.
현재 관리자는 `bbb@gmail.com` 이다. 바꾸려면 (관리자는 한 명만 두는 것을 권한다):

```sql
UPDATE app_user SET role = 'USER'  WHERE role = 'ADMIN' AND email <> '바꿀주소@example.com';
UPDATE app_user SET role = 'ADMIN' WHERE email = '바꿀주소@example.com';
```

**답변할 계정과 문의할 계정은 분리하는 편이 낫다** — 관리자 계정으로 문의를 넣으면
본인이 본인에게 답하는 모양이 된다.

DB 에서 직접 보고 싶다면:

```sql
SELECT i.inquiry_id, i.created_at, i.status, u.nickname, u.email, i.content, i.answer
FROM inquiry i JOIN app_user u ON u.user_id = i.user_id
ORDER BY i.created_at DESC;
```

사용자가 탈퇴하면 그 사람의 문의도 함께 지워진다.

## 종 마스터 적재 (plant_species)

`plant_species` 는 외부 4개 소스를 배치에서 병합해 미리 채워두는 마스터 테이블이다.
런타임 API 는 이 테이블만 읽고 외부 API 를 호출하지 않는다.

```bash
cd apps/api
./.venv/Scripts/python.exe -m scripts.ingest.run_all      # 4개 소스 적재 + 병합
./.venv/Scripts/python.exe -m scripts.ingest.merge        # 병합만 다시
./.venv/Scripts/python.exe -m scripts.ingest.aspca_snapshot  # ASPCA 스냅샷 CSV 재생성 (필요 시)
```

준비물:

- `NONGSARO_API_KEY` (.env) — 농사로 OpenAPI. 없으면 RDA_INDOOR 단계 실패
- `NATURE_KNA_API_KEY` (.env) — 국립수목원 API. 비어 있으면 해당 단계 자동 skip
- `data/kfs-standard-plants.csv` — 산림청 파일데이터 수동 다운로드. 없으면 해당 단계 skip
- `data/aspca-toxic-plants.csv` — 리포에 커밋되어 있음

매칭 키는 정규화 학명(`plant_species.scientific_name_norm`)이고, 붙이지 못한 소스 행은
`species_match_review` 에 쌓인다. 필드 충돌 우선순위는 `docs/database-schema.sql` 의 2-3 섹션 주석 참고.

## Plant Image Preprocessing

The image preprocessing endpoints use `rembg` to separate the plant from a complex photo background. They default to a two-pass `birefnet-general` pipeline that first locates the subject, then reruns segmentation on a tighter high-resolution crop. Pass `quality_mode=fast` to use the one-pass `isnet-general-use` path for quicker local iteration.

- `POST /images/preprocess-plant`: upload the user's original plant photo as form field `file`. The response includes:
  - `sdxl_input_png_base64`: 1024x1024 PNG with the plant centered on a white background for SDXL img2img / ControlNet.
  - `transparent_png_base64`: 1024x1024 transparent PNG for previews or fallback mobile display.
- `POST /images/remove-background`: upload the generated SDXL character image as form field `file`. The response includes `transparent_png_base64` for mobile use.
- `POST /images/remove-character-face`: upload the generated SDXL character image as form field `file`. The endpoint locates the symmetric eye pair, falls back to the blush pair when needed, and inpaints the face area independently of the pot color. It returns `face_removed_png_base64` for a later expression layer.

The first request can take longer because the segmentation model may be downloaded into the local model cache. For production or Runpod deployment, pre-warm the model cache before serving user requests.

## SDXL 캐릭터 생성

식물 등록 화면은 긴 생성 요청을 직접 기다리지 않고 작업 API를 폴링한다.

1. `POST /api/character-generations`에 로그인 토큰과 식물 사진(`file`)을 전송한다.
2. 응답의 `id`로 `GET /api/character-generations/{id}`를 2초 간격으로 조회한다.
3. `status=completed`가 되면 `candidates`에 투명 배경 PNG 3개의 URL, 체크섬, seed가 담긴다.

`progress`는 남은 시간 예측이 아닌 단계별 작업 진행률이다. 생성 요청마다 고유한
`force_task_id`를 지정하고 Forge의 `/internal/progress`를 1초 간격으로 조회해
샘플링 진행률을 반영한다. 미리보기 이미지는 요청하지 않는다. 조회 실패 시에도 생성은
계속하며, 작업 ID를 구분하지 않는 전역 진행률로 대체하지 않는다.
재시도 중 진행률은 후퇴하지 않고, 후보 3개 후처리와 Ollama 복귀가 끝나야 100%가 된다.
정확한 진행률이 없는 전처리·모델 준비 구간에서는 앱의 처리 중 표시와 단계 안내를 유지한다.

사진 누끼는 메모리 사용을 제한하기 위해 작업용 사본의 긴 변을 최대 1536px로 줄인 후 처리한다.
JPEG는 축소 디코딩도 사용한다. 원본 파일과 최종 출력 크기는 바꾸지 않으며, 얼굴 좌표를
다루는 생성 캐릭터에는 이 입력 축소를 적용하지 않는다.
누끼 모델의 ONNX CPU 메모리 풀과 메모리 패턴 캐시는 사용하지 않고, CPU 연산 스레드는
2개로 제한한다. 품질 모델과 경계 보정은 유지하면서 반복 추론의 메모리 점유를 줄인다.

작업은 프로세스 내 단일 worker에서 직렬 처리한다. 각 작업은 원본 사진 전처리 후 서로 다른 seed로
Forge img2img + ControlNet Canny를 3회 실행하고, 결과 배경을 제거한다. 학교 PC처럼 Ollama와
Forge가 GPU를 번갈아 쓰는 환경에서는 다음 값을 `apps/api/.env`에 설정한다.

```dotenv
FORGE_API_URL=http://127.0.0.1:7860
CHARACTER_GPU_MODE_COMMAND=/usr/local/bin/leaflog-gpu
CHARACTER_RESTORE_OLLAMA=true
```

FastAPI를 개발 PC에서 실행하고 학교 PC의 Forge를 사용할 때는 비밀번호 대신 SSH 키 인증을 설정한다.
생성 요청이 들어오면 백엔드가 원격 GPU를 SDXL 모드로 전환하고, Forge용 SSH 터널이 끊겼으면 자동으로
다시 연다. 작업이 끝나거나 실패하면 원격 GPU를 Ollama 모드로 복구한다.

```dotenv
FORGE_API_URL=http://127.0.0.1:7860
CHARACTER_GPU_MODE_COMMAND=
CHARACTER_GPU_SSH_HOST=<school-gpu-host>
CHARACTER_GPU_SSH_USER=<windows-ssh-user>
CHARACTER_GPU_SSH_IDENTITY_FILE=~/.ssh/<private-key-file>
CHARACTER_GPU_SSH_WSL_DISTRO=Ubuntu
CHARACTER_GPU_SSH_WSL_USER=leaflog
CHARACTER_RESTORE_OLLAMA=true
```

SSH 공개 키는 학교 Windows OpenSSH 계정에 등록돼 있어야 하며, `ssh -o BatchMode=yes ...`가
비밀번호 입력 없이 성공해야 한다. Forge의 인증 없는 7860 포트를 외부에 직접 공개하지 않는다.

GPU 없이 앱 흐름만 확인할 때는 `CHARACTER_MOCK_GENERATION=true`를 사용한다. 이 모드는 실제 도트
캐릭터 대신 입력 사진으로 후보 응답 형식만 검증한다.

현재 생성 파일은 `apps/api/generated/characters`에 저장되고 `/generated/characters/...`로 제공된다.
실험용 로컬 저장 방식이므로 운영 배포 전에는 생성 결과 저장을 S3로 교체해야 한다. 프록시를 쓰거나
외부 공개 주소와 요청 주소가 다르면 `CHARACTER_PUBLIC_BASE_URL`을 앱에서 접근 가능한 API 주소로 지정한다.
