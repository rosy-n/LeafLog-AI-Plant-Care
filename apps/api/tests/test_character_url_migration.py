import hashlib
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import MediaAsset


SPEC = importlib.util.spec_from_file_location(
    "normalize_character_urls", Path(__file__).resolve().parents[1] / "scripts" / "normalize-character-urls.py",
)
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)


class CharacterUrlMigrationTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory(prefix="leaflog-url-migration-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.output = self.root / "characters"
        self.output.mkdir()
        self.engine = create_engine("sqlite://")
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(self.engine)

    def asset(self, index):
        name = f"candidate-{index}.png"
        target = self.output / "job" / name
        target.parent.mkdir(exist_ok=True)
        contents = f"fixture-{index}".encode()
        target.write_bytes(contents)
        key = "generated/characters/job/" + name
        asset = MediaAsset(
            asset_id=index, asset_type="CHARACTER_IMAGE", object_key=key,
            file_url="http://old.example.test:8000/" + key,
            checksum="face-v1:450,603,698,771:" + hashlib.sha256(contents).hexdigest(),
        )
        with Session(self.engine) as db:
            db.add(asset)
            db.commit()
            db.refresh(asset)
            db.expunge(asset)
        return asset, target

    def test_verified_file_url_changes_with_backup_but_metadata_is_preserved(self):
        asset, _ = self.asset(1)
        entry = migration.inspect_asset(asset, self.output)
        self.assertEqual(entry["status"], "ready")
        backup = self.root / "backup.json"
        self.assertEqual(migration.apply_plan([entry], self.session_factory, self.output, backup), 1)
        self.assertEqual(json.loads(backup.read_text())["entries"][0]["before"]["file_url"], asset.file_url)
        with Session(self.engine) as db:
            updated = db.get(MediaAsset, asset.asset_id)
            self.assertEqual(updated.file_url, "/" + asset.object_key)
            self.assertEqual(updated.object_key, asset.object_key)
            self.assertEqual(updated.checksum, asset.checksum)
            self.assertEqual(migration.inspect_asset(updated, self.output)["status"], "already_normalized")

    def test_missing_or_modified_images_are_skipped(self):
        asset, target = self.asset(1)
        target.unlink()
        self.assertEqual(migration.inspect_asset(asset, self.output)["status"], "missing_file")
        target.write_bytes(b"changed")
        self.assertEqual(migration.inspect_asset(asset, self.output)["status"], "checksum_mismatch")

    def test_external_assets_and_mismatched_keys_are_not_migrated(self):
        asset, _ = self.asset(1)
        asset.bucket_name = "external-bucket"
        self.assertEqual(migration.inspect_asset(asset, self.output)["status"], "external")
        asset.bucket_name = None
        asset.object_key = "another/key.png"
        self.assertEqual(migration.inspect_asset(asset, self.output)["status"], "key_mismatch")

    def test_missing_checksum_is_not_guessed(self):
        asset, _ = self.asset(1)
        asset.checksum = None
        self.assertEqual(migration.inspect_asset(asset, self.output)["status"], "missing_checksum")

    def test_changed_record_rolls_back_entire_batch(self):
        first, _ = self.asset(1)
        second, _ = self.asset(2)
        plan = [migration.inspect_asset(asset, self.output) for asset in (first, second)]
        with self.session_factory.begin() as db:
            db.get(MediaAsset, second.asset_id).checksum = "newer-value"
        with self.assertRaises(RuntimeError):
            migration.apply_plan(plan, self.session_factory, self.output, self.root / "backup.json")
        with Session(self.engine) as db:
            self.assertEqual(db.get(MediaAsset, first.asset_id).file_url, first.file_url)
            self.assertEqual(db.get(MediaAsset, second.asset_id).checksum, "newer-value")

    def test_existing_backup_is_never_overwritten(self):
        asset, _ = self.asset(1)
        entry = migration.inspect_asset(asset, self.output)
        backup = self.root / "backup.json"
        backup.write_text("existing backup")
        with self.assertRaises(FileExistsError):
            migration.apply_plan([entry], self.session_factory, self.output, backup)
        with Session(self.engine) as db:
            self.assertEqual(db.get(MediaAsset, asset.asset_id).file_url, asset.file_url)


if __name__ == "__main__":
    unittest.main()
