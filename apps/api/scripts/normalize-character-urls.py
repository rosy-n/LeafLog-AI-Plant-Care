"""Replace verified local character URLs with paths. Dry-run unless --apply is set.

Run on the server that owns CHARACTER_OUTPUT_DIR:
    python scripts/normalize-character-urls.py
    python scripts/normalize-character-urls.py --apply --backup /private/backup.json

Only file_url changes. Image files, object keys, face bounds, and external assets
are preserved. A missing file or checksum mismatch is reported and skipped.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import MediaAsset
from app.storage import bucket_from_url, generated_character_path


FIELDS = ("asset_id", "plant_id", "user_id", "asset_type", "bucket_name", "object_key", "file_url", "checksum")
MAX_BYTES = 12 * 1024 * 1024


def snapshot(asset):
    return {name: getattr(asset, name) for name in FIELDS}


def inspect_asset(asset, output_dir):
    before = snapshot(asset)
    entry = {"before": before, "status": "external"}
    path = generated_character_path(asset.file_url)
    if asset.bucket_name or bucket_from_url(asset.file_url) or path is None:
        return entry
    if asset.file_url == path:
        entry["status"] = "already_normalized"
        return entry
    if asset.object_key != path.lstrip("/"):
        entry["status"] = "key_mismatch"
        return entry

    root = Path(output_dir).resolve()
    target = (root / path.removeprefix("/generated/characters/")).resolve()
    if not target.is_relative_to(root):
        entry["status"] = "unsafe_path"
        return entry
    if not target.is_file():
        entry["status"] = "missing_file"
        return entry
    if target.stat().st_size > MAX_BYTES:
        entry["status"] = "file_too_large"
        return entry
    expected = (asset.checksum or "").rsplit(":", 1)[-1].lower()
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        entry["status"] = "missing_checksum"
        return entry
    with target.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if digest != expected:
        entry["status"] = "checksum_mismatch"
        return entry
    entry.update(status="ready", file_url=path, sha256=digest)
    return entry


def apply_plan(entries, session_factory, output_dir, backup_path):
    ready = [entry for entry in entries if entry["status"] == "ready"]
    if not ready:
        return 0
    backup = Path(backup_path)
    backup.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        json.dump({"created_at": datetime.now(timezone.utc).isoformat(), "entries": ready}, stream, indent=2)
        stream.write("\n")

    with session_factory() as db, db.begin():
        for entry in ready:
            asset = db.scalar(select(MediaAsset).where(
                MediaAsset.asset_id == entry["before"]["asset_id"],
            ).with_for_update())
            if asset is None or snapshot(asset) != entry["before"]:
                raise RuntimeError("Asset changed after planning; transaction rolled back")
            checked = inspect_asset(asset, output_dir)
            if checked != entry:
                raise RuntimeError("Image changed after planning; transaction rolled back")
            asset.file_url = entry["file_url"]
    return len(ready)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup", type=Path)
    args = parser.parse_args()
    if args.apply and args.backup is None:
        parser.error("--apply requires a new --backup file")
    with SessionLocal() as db:
        assets = db.scalars(select(MediaAsset).where(
            MediaAsset.asset_type == "CHARACTER_IMAGE",
        ).order_by(MediaAsset.asset_id)).all()
        entries = [inspect_asset(asset, settings.character_output_dir) for asset in assets]
    for entry in entries:
        print(json.dumps({"asset_id": entry["before"]["asset_id"], "status": entry["status"]}))
    if args.apply:
        count = apply_plan(entries, SessionLocal, settings.character_output_dir, args.backup)
        print(json.dumps({"updated": count, "backup": str(args.backup)}))
    else:
        print(json.dumps({"dry_run": True, "ready": sum(e["status"] == "ready" for e in entries)}))


if __name__ == "__main__":
    main()
