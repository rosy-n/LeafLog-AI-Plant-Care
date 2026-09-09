import base64
from dataclasses import replace
import hashlib
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw

from app import character_generation as generation
from app.character_framing import FRAMING_VERSION, normalize_character_framing


class CharacterGenerationFramingTests(unittest.TestCase):
    def test_all_three_candidates_store_framed_pixels_coordinates_and_checksum(self):
        image = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(image)
        draw.rectangle((550, 570, 880, 940), fill=(210, 170, 100, 255))
        draw.rectangle((690, 100, 730, 600), fill=(10, 150, 50, 255))
        output = BytesIO()
        image.save(output, format="PNG")
        raw = output.getvalue()
        encoded = base64.b64encode(raw).decode()
        bounds = (610, 700, 810, 820)
        expected = normalize_character_framing(raw, bounds)
        with TemporaryDirectory() as directory:
            manager = generation.CharacterGenerationManager()
            self.addCleanup(manager._executor.shutdown)
            manager._jobs["fixture"] = generation.CharacterGenerationJob(id="fixture", user_id=1)
            manager._inputs["fixture"] = raw
            settings = replace(generation.settings, character_output_dir=Path(directory), character_mock_generation=False)
            with (
                patch.object(generation, "settings", settings),
                patch.object(generation, "preprocess_plant_photo", return_value=SimpleNamespace(sdxl_input_png_base64=encoded)),
                patch.object(generation, "release_background_removal_sessions"),
                patch.object(generation, "_switch_gpu_mode") as switch,
                patch.object(generation, "_ensure_forge_tunnel"),
                patch.object(generation, "_wait_for_forge"),
                patch.object(generation, "_generate_with_forge", return_value=raw),
                patch.object(generation, "remove_background_for_sprite", return_value=SimpleNamespace(transparent_png_base64=encoded)),
                patch.object(generation, "remove_character_face", return_value=SimpleNamespace(face_removed_png_base64=encoded, face_bounds=bounds)),
            ):
                manager._run_job("fixture", "http://api.example.test")
            job = manager.get_job("fixture", 1)
            self.assertEqual(job.status, "completed", job.error)
            self.assertEqual(len(job.candidates), 3)
            self.assertEqual([call.args[0] for call in switch.call_args_list], ["sdxl", "ollama"])
            for index, candidate in enumerate(job.candidates, 1):
                data = (Path(directory) / "fixture" / f"candidate-{index}.png").read_bytes()
                self.assertEqual(data, expected.png_bytes)
                self.assertEqual(candidate.face_bounds, expected.face_bounds)
                self.assertEqual(candidate.checksum, "face-v1:" + ",".join(map(str, expected.face_bounds)) + ":" + hashlib.sha256(data).hexdigest())
                self.assertEqual(Image.open(BytesIO(data)).info["leaflog_framing"], FRAMING_VERSION)


if __name__ == "__main__":
    unittest.main()
