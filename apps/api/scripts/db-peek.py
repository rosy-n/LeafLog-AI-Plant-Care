"""DB 상태 빠른 확인 — 각 테이블 건수 + 최근 행.
실행: cd apps/api && ./.venv/Scripts/python.exe scripts/db-peek.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.database import engine

QUERIES = {
    "app_user": "SELECT user_id, email, nickname, created_at FROM app_user ORDER BY user_id DESC LIMIT 5",
    "plant_species": "SELECT species_id, common_name_ko, scientific_name FROM plant_species ORDER BY species_id DESC LIMIT 5",
    "plant": "SELECT plant_id, user_id, species_id, nickname, location_name, light_condition, created_at FROM plant ORDER BY plant_id DESC LIMIT 5",
    "media_asset": "SELECT asset_id, plant_id, asset_type, file_url FROM media_asset ORDER BY asset_id DESC LIMIT 5",
}

with engine.connect() as c:
    for table, q in QUERIES.items():
        count = c.execute(text(f"SELECT count(*) FROM {table}")).scalar()
        print(f"\n=== {table} (총 {count}건, 최근 5건) ===")
        rows = c.execute(text(q)).fetchall()
        for r in rows:
            print("  ", tuple(r))