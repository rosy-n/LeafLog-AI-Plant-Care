"""Plan/copy/verify media without deleting originals. Run from apps/api with -m."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlparse

from botocore.exceptions import ClientError
from PIL import Image
from sqlalchemy import select

from app.database import SessionLocal
from app.models import MediaAsset
from app.storage import _s3, bucket_from_url

MAX_BYTES = 50 * 1024 * 1024
OLD_FIELDS = ("bucket_name", "object_key", "file_url", "checksum")


def confined(root: Path, relative: str) -> Path:
    target = (root / relative).resolve()
    if not target.is_relative_to(root.resolve()) or target == root.resolve():
        raise ValueError("Media path escapes the backup root")
    return target


def read_object(s3, bucket, key):
    body = s3.get_object(Bucket=bucket, Key=key)["Body"]
    try:
        data = body.read(MAX_BYTES + 1)
    finally:
        body.close()
    if len(data) > MAX_BYTES:
        raise ValueError("Media exceeds 50MB; review manually")
    return data


def source_for(asset):
    bucket = asset.bucket_name or bucket_from_url(asset.file_url)
    if bucket:
        return {"kind": "s3", "bucket": bucket, "key": asset.object_key}
    path = unquote(urlparse(asset.file_url).path)
    if path.startswith("/generated/characters/"):
        return {"kind": "local", "path": path.lstrip("/")}
    if path.startswith("/static/uploads/"):
        return {"kind": "local", "path": "app/" + path.lstrip("/")}
    return None


def source_bytes(source, root, s3):
    if source["kind"] == "s3":
        return read_object(s3, source["bucket"], source["key"])
    if source["kind"] != "local":
        raise ValueError("Unknown source kind")
    path = confined(root, source["path"])
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Media exceeds 50MB; review manually")
    return path.read_bytes()


def plan(db, s3, root, bucket):
    result = {"version": 1, "bucket": bucket, "entries": [], "skipped": []}
    for asset in db.scalars(select(MediaAsset).order_by(MediaAsset.asset_id)):
        source = source_for(asset)
        if source is None:
            result["skipped"].append({"asset_id": asset.asset_id, "reason": "unmapped URL; review original manually"})
            continue
        try:
            data = source_bytes(source, root, s3)
        except (OSError, ValueError, ClientError):
            result["skipped"].append({"asset_id": asset.asset_id, "reason": "source unreadable; restore backup/permissions"})
            continue
        digest = hashlib.sha256(data).hexdigest()
        recorded = (asset.checksum or "").rsplit(":", 1)[-1]
        if re.fullmatch(r"[0-9a-f]{64}", recorded) and recorded != digest:
            result["skipped"].append({"asset_id": asset.asset_id, "reason": "original checksum mismatch"})
            continue
        try:
            with Image.open(io.BytesIO(data)) as image:
                content_type = Image.MIME.get(image.format, "application/octet-stream")
                image.verify()
        except (OSError, ValueError, Image.DecompressionBombError):
            result["skipped"].append({"asset_id": asset.asset_id, "reason": "invalid/unsupported image; review manually"})
            continue
        result["entries"].append({
            "asset_id": asset.asset_id, "old": {name: getattr(asset, name) for name in OLD_FIELDS},
            "source": source, "sha256": digest, "size": len(data), "content_type": content_type,
            "key": f"leaflog/migrated/{asset.asset_id}/{digest}",
        })
    return result


def upload(manifest, root, s3):
    for entry in manifest["entries"]:
        data = source_bytes(entry["source"], root, s3)
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f'Source changed: asset {entry["asset_id"]}')
        try:
            s3.put_object(Bucket=manifest["bucket"], Key=entry["key"], Body=data,
                          ContentType=entry["content_type"], IfNoneMatch="*",
                          Metadata={"sha256": entry["sha256"]})
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "PreconditionFailed":
                raise
        verify_entry(manifest, entry, s3)


def verify_entry(manifest, entry, s3):
    actual = read_object(s3, manifest["bucket"], entry["key"])
    if len(actual) != entry["size"] or hashlib.sha256(actual).hexdigest() != entry["sha256"]:
        raise ValueError(f'Target verification failed: asset {entry["asset_id"]}')


def apply_db(db, manifest, s3):
    # A single transaction updates only rows still matching the reviewed manifest.
    for entry in manifest["entries"]:
        verify_entry(manifest, entry, s3)
        asset = db.scalar(select(MediaAsset).where(MediaAsset.asset_id == entry["asset_id"]).with_for_update())
        if asset is None:
            raise ValueError(f'Asset was removed: {entry["asset_id"]}')
        current = {name: getattr(asset, name) for name in OLD_FIELDS}
        intended = {**entry["old"], "bucket_name": manifest["bucket"], "object_key": entry["key"],
                    "file_url": f's3://{manifest["bucket"]}/{entry["key"]}'}
        if current == intended:
            continue
        if current != entry["old"]:
            raise ValueError(f'Asset changed since plan: {entry["asset_id"]}')
        for name, value in intended.items():
            setattr(asset, name, value)
        # checksum, face-v1 coordinates, asset IDs and all references remain unchanged.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("plan", "upload", "verify", "apply-db"))
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--media-root", type=Path, default=Path("."))
    parser.add_argument("--bucket")
    parser.add_argument("--confirm-restored-db", action="store_true")
    args = parser.parse_args()
    s3 = _s3()
    if args.action == "plan":
        if not args.bucket:
            parser.error("plan requires --bucket")
        with SessionLocal() as db:
            manifest = plan(db, s3, args.media_root, args.bucket)
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        # Never overwrite a reviewed report that may be the rollback record.
        with args.manifest.open("x", encoding="utf-8") as file:
            json.dump(manifest, file, ensure_ascii=False, indent=2)
        print(f'Ready: {len(manifest["entries"])}; manual review: {len(manifest["skipped"])}')
        return
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    if manifest.get("version") != 1:
        parser.error("Unsupported manifest version")
    if args.action == "upload":
        upload(manifest, args.media_root, s3)
    elif args.action == "verify":
        for entry in manifest["entries"]:
            verify_entry(manifest, entry, s3)
    else:
        if not args.confirm_restored_db:
            parser.error("apply-db requires --confirm-restored-db; point DATABASE_URL at the restored AWS DB")
        if manifest["skipped"]:
            parser.error("Resolve skipped assets and regenerate the manifest before applying DB changes")
        with SessionLocal.begin() as db:
            apply_db(db, manifest, s3)
    print(f'{args.action}: {len(manifest["entries"])} assets verified; originals were not deleted')


if __name__ == "__main__":
    main()
