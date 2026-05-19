# Backend API

FastAPI backend for LeafLog.

## Implemented

- `GET /health`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

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
