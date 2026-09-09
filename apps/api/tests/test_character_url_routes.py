from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import config, storage
from app.database import Base
from app.models import AppUser, MediaAsset


PATH = "/generated/characters/0123456789abcdef/candidate-1.png"
BOUNDS = [450, 603, 698, 771]
CHECKSUM = "face-v1:450,603,698,771:" + "a" * 64


class CharacterUrlRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = TemporaryDirectory(prefix="leaflog-url-tests-")
        settings = replace(
            config.settings,
            character_output_dir=Path(cls.directory.name) / "characters",
            character_public_base_url="",
        )
        with (
            patch.object(config, "settings", settings),
            patch.object(storage, "LOCAL_UPLOAD_DIR", Path(cls.directory.name) / "uploads"),
        ):
            from app import main
        cls.main = main
        cls.settings_patch = patch.object(main, "settings", settings)
        cls.settings_patch.start()

    @classmethod
    def tearDownClass(cls):
        cls.settings_patch.stop()
        cls.directory.cleanup()

    def setUp(self):
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.engine_patch = patch.object(self.main, "engine", self.engine)
        self.engine_patch.start()
        self.signer_patch = patch.object(self.main, "presigned_get_url", return_value=None)
        self.signer = self.signer_patch.start()
        self.user = AppUser(user_id=1, email="test@example.test", nickname="Test", role="USER")
        with Session(self.engine) as db:
            db.add(self.user)
            db.commit()
            db.refresh(self.user)
            db.expunge(self.user)

        def get_db():
            with Session(self.engine) as db:
                yield db

        self.main.app.dependency_overrides[self.main.get_db] = get_db
        self.main.app.dependency_overrides[self.main.get_current_user] = lambda: self.user
        # No lifespan: startup and GPU shutdown handlers are not part of these tests.
        self.client = TestClient(self.main.app, base_url="http://api.example.test:8000")

    def tearDown(self):
        self.client.close()
        self.main.app.dependency_overrides.clear()
        self.signer_patch.stop()
        self.engine_patch.stop()
        self.engine.dispose()

    def create_plant(self, url):
        response = self.client.post("/api/plants", json={
            "commonNameKo": "Fixture species", "nickname": "Fixture plant",
            "characterImageUrl": url, "characterChecksum": CHECKSUM,
        })
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"]

    def test_store_path_then_list_detail_and_update_with_new_host(self):
        plant_id = self.create_plant("http://api.example.test:8000" + PATH)
        with Session(self.engine) as db:
            asset = db.scalar(select(MediaAsset).where(MediaAsset.plant_id == plant_id))
            self.assertEqual(asset.file_url, PATH)
            self.assertEqual(asset.object_key, PATH.lstrip("/"))
            self.assertIsNone(asset.bucket_name)
            self.assertEqual(asset.checksum, CHECKSUM)

        with_host = TestClient(self.main.app, base_url="https://new.example.test")
        self.addCleanup(with_host.close)
        results = [
            with_host.get("/api/plants").json()[0],
            with_host.get(f"/api/plants/{plant_id}").json(),
            with_host.patch(f"/api/plants/{plant_id}", json={"nickname": "Changed"}).json(),
        ]
        for result in results:
            self.assertEqual(result["character_image_url"], "https://new.example.test" + PATH)
            self.assertTrue(result["character_face_removed"])
            self.assertEqual(result["character_face_bounds"], BOUNDS)
        self.signer.assert_not_called()

    def test_explicit_image_server_is_used_without_persisting_its_host(self):
        with patch.object(self.main, "settings", replace(self.main.settings, character_public_base_url="https://media.example.test")):
            plant_id = self.create_plant("https://media.example.test" + PATH)
            result = self.client.get(f"/api/plants/{plant_id}").json()
            self.assertEqual(result["character_image_url"], "https://media.example.test" + PATH)
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(MediaAsset.file_url)), PATH)

    def test_legacy_and_external_urls_are_preserved_until_verified_migration(self):
        url = "http://old.example.test:8000" + PATH
        plant_id = self.create_plant(url)
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(MediaAsset.file_url)), url)
        self.assertEqual(self.client.get(f"/api/plants/{plant_id}").json()["character_image_url"], url)

    def test_s3_reference_keeps_bucket_key_and_existing_signing(self):
        url = "https://fixture.s3.ap-northeast-2.amazonaws.com/characters/example.png"
        plant_id = self.create_plant(url)
        with Session(self.engine) as db:
            asset = db.scalar(select(MediaAsset))
            self.assertEqual((asset.bucket_name, asset.object_key, asset.file_url), ("fixture", "characters/example.png", url))
        self.signer.return_value = "https://signed.example.test/image.png?signature=test"
        result = self.client.get(f"/api/plants/{plant_id}").json()
        self.assertEqual(result["character_image_url"], self.signer.return_value)
        self.signer.assert_called_once_with("characters/example.png", "fixture")

    def test_another_users_plant_is_not_exposed(self):
        plant_id = self.create_plant("http://api.example.test:8000" + PATH)
        self.main.app.dependency_overrides[self.main.get_current_user] = lambda: AppUser(user_id=2)
        self.assertEqual(self.client.get("/api/plants").json(), [])
        self.assertEqual(self.client.get(f"/api/plants/{plant_id}").status_code, 404)


if __name__ == "__main__":
    unittest.main()
