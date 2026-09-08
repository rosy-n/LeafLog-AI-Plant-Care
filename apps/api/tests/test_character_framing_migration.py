import hashlib
import importlib.util
from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import MediaAsset
from app import character_framing

SPEC = importlib.util.spec_from_file_location(
    "reframe_characters", Path(__file__).resolve().parents[1] / "scripts" / "reframe-characters.py",
)
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)


class CharacterFramingMigrationTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.output = self.root / "characters"
        (self.output / "job").mkdir(parents=True)
        self.engine = create_engine("sqlite://")
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)

    def asset(self, index=1):
        image = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(image)
        draw.rectangle((410, 560, 850, 940), fill=(200, 150, 100, 255))
        draw.rectangle((610, 100, 650, 600), fill=(20, 130, 60, 255))
        output = BytesIO()
        image.save(output, format="PNG")
        data = output.getvalue()
        key = f"generated/characters/job/candidate-{index}.png"
        (self.output / "job" / f"candidate-{index}.png").write_bytes(data)
        asset = MediaAsset(asset_id=index, asset_type="CHARACTER_IMAGE", object_key=key, file_url="/" + key,
                           checksum="face-v1:510,670,730,790:" + hashlib.sha256(data).hexdigest())
        with self.session_factory.begin() as db:
            db.add(asset)
        return asset, data

    def test_new_file_and_face_metadata_are_saved_with_original_backup(self):
        asset, original = self.asset()
        plan = migration.plan_asset(asset, self.output)
        self.assertEqual(plan[0]["status"], "ready")
        self.assertEqual(migration.apply_plan([plan], self.session_factory, self.output, self.root / "backup"), 1)
        self.assertEqual((self.root / "backup/asset-1-original.png").read_bytes(), original)
        self.assertEqual(migration.file_path(self.output, asset.file_url).read_bytes(), original)
        manifest = json.loads((self.root / "backup/manifest.json").read_text())
        self.assertEqual(manifest["entries"][0]["before"], migration.snapshot(asset))
        with self.session_factory() as db:
            updated = db.get(MediaAsset, 1)
            self.assertNotEqual(updated.file_url, asset.file_url)
            self.assertEqual(updated.file_url, "/" + updated.object_key)
            self.assertEqual(updated.checksum, plan[0]["checksum"])
            self.assertEqual(migration.plan_asset(updated, self.output)[0]["status"], "already_framed")

    def test_concurrent_record_change_rolls_back_all_updates(self):
        first, _ = self.asset(1)
        second, _ = self.asset(2)
        plans = [migration.plan_asset(a, self.output) for a in (first, second)]
        with self.session_factory.begin() as db:
            db.get(MediaAsset, 2).checksum = "updated-by-another-request"
        with self.assertRaises(RuntimeError):
            migration.apply_plan(plans, self.session_factory, self.output, self.root / "backup")
        with self.session_factory() as db:
            self.assertEqual(db.get(MediaAsset, 1).file_url, first.file_url)
            self.assertEqual(db.get(MediaAsset, 2).file_url, second.file_url)

    def test_original_checksum_mismatch_is_skipped(self):
        asset, _ = self.asset()
        asset.checksum = "face-v1:510,670,730,790:" + "a" * 64
        self.assertEqual(migration.plan_asset(asset, self.output)[0]["status"], "checksum_mismatch")

    def test_legacy_malformed_digest_preserves_face_and_backs_up_current_local_file(self):
        asset, original = self.asset()
        asset.checksum = "face-v1:510,670,730,790:legacy-incomplete-digest"
        entry, content = migration.plan_asset(asset, self.output)
        self.assertEqual(entry["original_sha256"], hashlib.sha256(original).hexdigest())
        self.assertEqual(entry["status"], "ready")
        self.assertIsNotNone(entry["face_bounds"])
        self.assertEqual(entry["sha256"], hashlib.sha256(content).hexdigest())

    def test_external_path_is_never_reinterpreted_as_a_local_file(self):
        asset, _ = self.asset()
        asset.file_url = "https://external.example.test" + asset.file_url
        self.assertEqual(migration.plan_asset(asset, self.output)[0]["status"], "unsupported")
        with self.assertRaises(ValueError):
            migration.file_path(self.output, "/generated/characters/../outside.png")

    def test_existing_backup_and_output_files_are_never_overwritten(self):
        asset, _ = self.asset()
        plan = migration.plan_asset(asset, self.output)
        backup = self.root / "backup"
        backup.mkdir()
        with self.assertRaises(FileExistsError):
            migration.apply_plan([plan], self.session_factory, self.output, backup)
        target = migration.file_path(self.output, plan[0]["file_url"])
        target.write_bytes(b"existing")
        with self.assertRaises(RuntimeError):
            migration.apply_plan([plan], self.session_factory, self.output, self.root / "new-backup")
        self.assertEqual(target.read_bytes(), b"existing")

    def old_version(self):
        original, data = self.asset()
        with patch.object(character_framing, "FRAMING_VERSION", "pot-v1"), patch.object(migration, "FRAMING_VERSION", "pot-v1"):
            old_plan = migration.plan_asset(original, self.output)
            migration.apply_plan([old_plan], self.session_factory, self.output, self.root / "old-backup")
        with self.session_factory() as db:
            current = db.get(MediaAsset, original.asset_id)
            db.expunge(current)
        # The first deployed manifest did not yet have explicit source fields.
        entry = {k: v for k, v in old_plan[0].items() if not k.startswith("source_")}
        return original, data, current, entry

    def test_old_framing_requires_its_original_manifest(self):
        _, _, current, _ = self.old_version()
        self.assertEqual(migration.plan_asset(current, self.output)[0]["status"], "original_required")

    def test_upgrade_uses_original_pixels_and_original_face_coordinates(self):
        original, data, current, entry = self.old_version()
        plan = migration.plan_asset(current, self.output, entry)
        expected = character_framing.normalize_character_framing(data, (510, 670, 730, 790))
        self.assertEqual(plan[1], expected.png_bytes)
        self.assertEqual(plan[0]["face_bounds"], expected.face_bounds)
        self.assertEqual(plan[0]["source_file_url"], original.file_url)
        self.assertEqual(migration.apply_plan([plan], self.session_factory, self.output, self.root / "new-backup"), 1)
        self.assertEqual(migration.file_path(self.output, original.file_url).read_bytes(), data)
        with self.session_factory() as db:
            updated = db.get(MediaAsset, current.asset_id)
            self.assertEqual(migration.plan_asset(updated, self.output, entry)[0]["status"], "already_framed")

    def test_stale_manifest_cannot_change_a_newer_image(self):
        _, _, current, entry = self.old_version()
        entry["checksum"] = "stale"
        self.assertEqual(migration.plan_asset(current, self.output, entry)[0]["status"], "source_manifest_mismatch")

    def test_changed_original_is_not_used_for_upgrading(self):
        original, _, current, entry = self.old_version()
        migration.file_path(self.output, original.file_url).write_bytes(b"changed")
        self.assertEqual(migration.plan_asset(current, self.output, entry)[0]["status"], "original_checksum_mismatch")

    def test_missing_original_does_not_upscale_the_small_image(self):
        original, _, current, entry = self.old_version()
        migration.file_path(self.output, original.file_url).unlink()
        self.assertEqual(migration.plan_asset(current, self.output, entry)[0]["status"], "missing_original")


if __name__ == "__main__":
    unittest.main()
