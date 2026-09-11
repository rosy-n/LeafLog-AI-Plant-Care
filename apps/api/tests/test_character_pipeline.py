import base64
import os
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

os.environ.update(APP_ROLE="api", DATABASE_URL="sqlite://", AWS_EC2_METADATA_DISABLED="true")

from app import character_generation as generation
from app.character_types import CharacterGenerationJob


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.steps = []
        encoded = base64.b64encode(b"fake-png-from-model-double").decode()
        replacements = {
            "settings": replace(generation.settings, character_output_dir=self.root,
                                character_mock_generation=False, character_restore_ollama=True, character_max_jobs=1),
            "preprocess_plant_photo": lambda **kw: SimpleNamespace(sdxl_input_png_base64=encoded),
            "release_background_removal_sessions": lambda: self.steps.append("release"),
            "_switch_gpu_mode": lambda mode: self.steps.append(mode),
            "_ensure_forge_tunnel": lambda: None,
            "_wait_for_forge": lambda: None,
            "_generate_with_forge": lambda **kw: b"generated",
            "remove_background_for_sprite": lambda **kw: SimpleNamespace(transparent_png_base64=encoded),
            "normalize_character_framing": lambda data, bounds: SimpleNamespace(png_bytes=data, face_bounds=bounds),
            "remove_character_face": lambda data: SimpleNamespace(face_removed_png_base64=encoded, face_bounds=(300, 600, 700, 800)),
        }
        for name, value in replacements.items():
            p = patch.object(generation, name, value)
            p.start()
            self.addCleanup(p.stop)

    def manager(self, callback=None):
        manager = generation.CharacterGenerationManager(on_update=callback)
        self.addCleanup(manager.shutdown)
        return manager

    def test_three_candidates_keep_face_metadata_and_restore_ollama_before_completion(self):
        def update(job_id, fields):
            if fields.get("status") == "completed":
                self.assertEqual(self.steps[-1], "ollama")
        result = self.manager(update).run_inline("a"*32, 1, b"input")
        self.assertEqual(result.status, "completed")
        self.assertEqual(len(result.candidates), 3)
        self.assertTrue(all(c.checksum.startswith("face-v1:300,600,700,800:") for c in result.candidates))
        self.assertEqual(self.steps.count("sdxl"), 1)
        self.assertEqual(self.steps.count("ollama"), 1)

    def test_failed_gpu_switch_still_attempts_ollama_restore(self):
        def switch(mode):
            self.steps.append(mode)
            if mode == "sdxl":
                raise RuntimeError("startup failed")
        with patch.object(generation, "_switch_gpu_mode", switch):
            result = self.manager().run_inline("b"*32, 1, b"input")
        self.assertEqual(result.status, "failed")
        self.assertIn("ollama", self.steps)

    def test_a_lost_callback_during_inference_restores_ollama(self):
        def update(job_id, fields):
            if fields.get("status") in {"generating", "failed"}:
                raise RuntimeError("lease lost")
        with self.assertRaises(RuntimeError):
            self.manager(update).run_inline("c"*32, 1, b"input")
        self.assertIn("ollama", self.steps)

    def test_memory_pruning_does_not_delete_registered_character_files(self):
        job_id = "d"*32
        folder = self.root / job_id
        folder.mkdir()
        file = folder / "candidate-1.png"
        file.write_bytes(b"registered-image")
        manager = self.manager()
        manager._jobs[job_id] = CharacterGenerationJob(id=job_id, user_id=1, status="completed")
        manager._prune_jobs()
        self.assertNotIn(job_id, manager._jobs)
        self.assertEqual(file.read_bytes(), b"registered-image")
