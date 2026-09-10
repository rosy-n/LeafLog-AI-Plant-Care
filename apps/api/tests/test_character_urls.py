import unittest

from app.storage import character_file_url, character_public_url, generated_character_path


PATH = "/generated/characters/0123456789abcdef/candidate-1.png"


class CharacterUrlTests(unittest.TestCase):
    def test_own_server_url_is_stored_without_host_or_query(self):
        self.assertEqual(
            character_file_url("http://api.example.test:8000" + PATH + "?cache=1#image", "http://api.example.test:8000/"),
            PATH,
        )

    def test_relative_path_is_idempotent(self):
        self.assertEqual(character_file_url(PATH, "https://api.example.test"), PATH)

    def test_separate_image_server_is_recognized(self):
        self.assertEqual(
            character_file_url("https://media.example.test" + PATH, "http://api.example.test", "https://media.example.test"),
            PATH,
        )

    def test_mount_prefix_is_removed_for_storage_and_restored_for_reading(self):
        base = "https://api.example.test/leaflog"
        self.assertEqual(character_file_url(base + PATH, base), PATH)
        self.assertEqual(character_public_url(PATH, base + "/"), base + PATH)

    def test_external_and_s3_urls_are_not_rewritten(self):
        for url in (
            "https://cdn.example.test" + PATH,
            "https://bucket.s3.ap-northeast-2.amazonaws.com" + PATH + "?X-Amz-Signature=test",
            "https://s3.ap-northeast-2.amazonaws.com/bucket/character.png",
            "https://api.example.test/static/uploads/photo.png",
        ):
            with self.subTest(url=url):
                self.assertEqual(character_file_url(url, "https://api.example.test"), url)
                self.assertIsNone(character_public_url(url, "https://new.example.test"))

    def test_public_url_follows_current_server_host_and_port(self):
        for base in ("http://api.example.test:8000", "https://new.example.test"):
            with self.subTest(base=base):
                self.assertEqual(character_public_url(PATH, base + "/"), base + PATH)

    def test_recovered_character_paths_are_supported(self):
        path = "/generated/characters/recovered/test/plant.png"
        self.assertEqual(generated_character_path("http://old.example.test" + path), path)
        self.assertEqual(character_public_url(path, "https://new.example.test"), "https://new.example.test" + path)

    def test_unsafe_or_unrelated_paths_are_not_rebased(self):
        for value in (
            "//evil.example.test" + PATH,
            "/generated/characters/../private.png",
            "/generated/characters/%2e%2e/private.png",
            "/generated/characters/job\\private.png",
            "/generated/characters/job/%2fprivate.png",
            "/static/uploads/photo.png",
            "file:///generated/characters/job/plant.png",
            "http://name:password@api.example.test" + PATH,
            None,
        ):
            with self.subTest(value=value):
                self.assertIsNone(character_public_url(value, "https://api.example.test"))


if __name__ == "__main__":
    unittest.main()
