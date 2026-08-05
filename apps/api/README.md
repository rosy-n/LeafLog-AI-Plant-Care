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
DATABASE_URL=postgresql://leaflog:leaflog@localhost:5432/leaflog
```

The code normalizes this to SQLAlchemy's `postgresql+psycopg://` driver internally.

### 마이그레이션

`docs/database-schema.sql` 이 정의의 기준이고, 이미 만들어진 DB 에는 `scripts/*.sql` 을
슈퍼유저로 실행해 반영한다. 모두 재실행 안전(idempotent).

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/db-setup.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-care-tables.sql
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-species-source-tables.sql
```

`add-species-source-tables.sql` 은 `CREATE EXTENSION pg_trgm` 을 포함해 슈퍼유저가 필요하다.
서버 startup 의 `create_all` 은 없는 테이블만 만들고 기존 테이블에 컬럼을 추가하지 못하므로,
이 스크립트를 돌리지 않으면 `/api/species` 가 없는 컬럼을 조회해 실패한다.

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

The first request can take longer because the segmentation model may be downloaded into the local model cache. For production or Runpod deployment, pre-warm the model cache before serving user requests.
