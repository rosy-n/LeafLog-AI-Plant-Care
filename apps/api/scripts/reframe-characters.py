"""Align existing local sprites. Dry-run by default; originals are never overwritten."""
import argparse
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image
from sqlalchemy import select

from app.character_framing import FRAMING_VERSION, normalize_character_framing
from app.config import settings
from app.database import SessionLocal
from app.models import MediaAsset
from app.storage import generated_character_path


FIELDS = ("asset_id", "plant_id", "user_id", "asset_type", "bucket_name", "object_key", "file_url", "checksum")


def snapshot(asset):
    return {name: getattr(asset, name) for name in FIELDS}


def file_path(output_dir, url):
    root = Path(output_dir).resolve()
    path = generated_character_path(url)
    if not path or path != url:
        raise ValueError("Only normalized local character paths can be migrated")
    target = (root / path.removeprefix("/generated/characters/")).resolve()
    if not target.is_relative_to(root):
        raise ValueError("Image path is outside the character directory")
    return target


def plan_asset(asset, output_dir, source_entry=None):
    entry = {"before": snapshot(asset), "status": "unsupported"}
    if (asset.asset_type != "CHARACTER_IMAGE" or asset.bucket_name
            or generated_character_path(asset.file_url) != asset.file_url
            or not asset.file_url or asset.object_key != asset.file_url.lstrip("/")):
        return entry, None
    source = file_path(output_dir, asset.file_url)
    if not source.is_file():
        return dict(entry, status="missing_file"), None
    if source.stat().st_size > 12 * 1024 * 1024:
        return dict(entry, status="file_too_large"), None
    content = source.read_bytes()
    original_hash = hashlib.sha256(content).hexdigest()
    with Image.open(BytesIO(content)) as image:
        previous_version = image.info.get("leaflog_framing")
        if previous_version == FRAMING_VERSION:
            return dict(entry, status="already_framed"), None
    digest = (asset.checksum or "").rsplit(":", 1)[-1]
    if re.fullmatch(r"[a-fA-F0-9]{64}", digest) and digest.lower() != original_hash:
        return dict(entry, status="checksum_mismatch"), None
    source_url, source_checksum = asset.file_url, asset.checksum
    if previous_version:
        if not source_entry:
            return dict(entry, status="original_required"), None
        expected = dict(source_entry["before"], **{
            name: source_entry[name] for name in ("file_url", "object_key", "checksum")
        })
        if expected != snapshot(asset) or source_entry["sha256"] != original_hash:
            return dict(entry, status="source_manifest_mismatch"), None
        source_url = source_entry.get("source_file_url", source_entry["before"]["file_url"])
        source_checksum = source_entry.get("source_checksum", source_entry["before"]["checksum"])
        source = file_path(output_dir, source_url)
        if not source.is_file() or source.stat().st_size > 12 * 1024 * 1024:
            return dict(entry, status="missing_original"), None
        content = source.read_bytes()
        source_hash = source_entry.get("source_sha256", source_entry["original_sha256"])
        if hashlib.sha256(content).hexdigest() != source_hash:
            return dict(entry, status="original_checksum_mismatch"), None
        with Image.open(BytesIO(content)) as image:
            if image.info.get("leaflog_framing"):
                return dict(entry, status="original_required"), None
    face = None
    if (source_checksum or "").startswith("face-v1:"):
        match = re.match(r"face-v1:(\d+),(\d+),(\d+),(\d+):", source_checksum)
        if not match:
            return dict(entry, status="invalid_face_bounds"), None
        face = tuple(map(int, match.groups()))
    framed = normalize_character_framing(content, face)
    digest = hashlib.sha256(framed.png_bytes).hexdigest()
    name = f"{source.stem}-framed-{FRAMING_VERSION}-{digest[:12]}.png"
    url = str(Path(source_url).with_name(name)).replace("\\", "/")
    checksum = digest
    if framed.face_bounds:
        checksum = "face-v1:" + ",".join(map(str, framed.face_bounds)) + ":" + digest
    return dict(entry, status="ready", original_sha256=original_hash,
                source_file_url=source_url, source_checksum=source_checksum,
                source_sha256=hashlib.sha256(content).hexdigest(),
                file_url=url, object_key=url.lstrip("/"), checksum=checksum,
                sha256=digest, face_bounds=framed.face_bounds), framed.png_bytes


def apply_plan(plans, session_factory, output_dir, backup_dir):
    ready = [(entry, content) for entry, content in plans if entry["status"] == "ready"]
    if not ready:
        return 0
    backup = Path(backup_dir)
    backup.mkdir(mode=0o700, parents=True, exist_ok=False)
    for entry, _ in ready:
        original = file_path(output_dir, entry["before"]["file_url"]).read_bytes()
        if hashlib.sha256(original).hexdigest() != entry["original_sha256"]:
            raise RuntimeError("Original image changed; no DB records were updated")
        with (backup / f"asset-{entry['before']['asset_id']}-original.png").open("xb") as stream:
            stream.write(original)
    fd = os.open(backup / "manifest.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        json.dump({"created_at": datetime.now(timezone.utc).isoformat(),
                   "entries": [entry for entry, _ in ready]}, stream, indent=2)
    for entry, content in ready:
        target = file_path(output_dir, entry["file_url"])
        if target.exists():
            if hashlib.sha256(target.read_bytes()).hexdigest() != entry["sha256"]:
                raise RuntimeError("Output path exists with different image content")
        else:
            with target.open("xb") as stream:
                stream.write(content)
    with session_factory() as db, db.begin():
        for entry, _ in ready:
            asset = db.scalar(select(MediaAsset).where(
                MediaAsset.asset_id == entry["before"]["asset_id"],
            ).with_for_update())
            if asset is None or snapshot(asset) != entry["before"]:
                raise RuntimeError("Asset changed; entire DB transaction rolled back")
            source = file_path(output_dir, asset.file_url)
            unscaled = file_path(output_dir, entry["source_file_url"])
            target = file_path(output_dir, entry["file_url"])
            if (hashlib.sha256(source.read_bytes()).hexdigest() != entry["original_sha256"]
                    or hashlib.sha256(unscaled.read_bytes()).hexdigest() != entry["source_sha256"]
                    or hashlib.sha256(target.read_bytes()).hexdigest() != entry["sha256"]):
                raise RuntimeError("Image changed; entire DB transaction rolled back")
            asset.file_url, asset.object_key, asset.checksum = entry["file_url"], entry["object_key"], entry["checksum"]
    return len(ready)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--source-manifest", type=Path, help="Previous backup manifest, required when replacing older framing")
    args = parser.parse_args()
    if args.apply and not args.backup_dir:
        parser.error("--apply requires a new --backup-dir")
    sources = {}
    if args.source_manifest:
        entries = json.loads(args.source_manifest.read_text(encoding="utf-8"))["entries"]
        sources = {entry["before"]["asset_id"]: entry for entry in entries}
        if len(sources) != len(entries):
            parser.error("Source manifest contains duplicate assets")
    with SessionLocal() as db:
        assets = db.scalars(select(MediaAsset).where(
            MediaAsset.asset_type == "CHARACTER_IMAGE",
        ).order_by(MediaAsset.asset_id)).all()
        plans = [plan_asset(asset, settings.character_output_dir, sources.get(asset.asset_id)) for asset in assets]
    for entry, _ in plans:
        print(json.dumps({"asset_id": entry["before"]["asset_id"], "status": entry["status"],
                          "face_bounds": entry.get("face_bounds")}))
    if args.apply:
        print(json.dumps({"updated": apply_plan(plans, SessionLocal, settings.character_output_dir, args.backup_dir),
                          "backup_dir": str(args.backup_dir)}))


if __name__ == "__main__":
    main()
