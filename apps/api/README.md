# Backend API

FastAPI backend for LeafLog.

## Implemented

- `GET /health`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /images/preprocess-plant`
- `POST /images/remove-background`

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
DATABASE_URL=postgresql://leaflog_user:비밀번호@100.70.205.63:5432/leaflog
```

The code normalizes this to SQLAlchemy's `postgresql+psycopg://` driver internally.

## Plant Image Preprocessing

The image preprocessing endpoints use `rembg` to separate the plant from a complex photo background. They default to a two-pass `birefnet-general` pipeline that first locates the subject, then reruns segmentation on a tighter high-resolution crop. Pass `quality_mode=fast` to use the one-pass `isnet-general-use` path for quicker local iteration.

- `POST /images/preprocess-plant`: upload the user's original plant photo as form field `file`. The response includes:
  - `sdxl_input_png_base64`: 1024x1024 PNG with the plant centered on a white background for SDXL img2img / ControlNet.
  - `transparent_png_base64`: 1024x1024 transparent PNG for previews or fallback mobile display.
- `POST /images/remove-background`: upload the generated SDXL character image as form field `file`. The response includes `transparent_png_base64` for mobile use.

The first request can take longer because the segmentation model may be downloaded into the local model cache. For production or Runpod deployment, pre-warm the model cache before serving user requests.
