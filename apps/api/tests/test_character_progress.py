import base64
from contextlib import ExitStack
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import requests

from app import character_generation as generation


class CharacterProgressTests(unittest.TestCase):
    def run_job(self, rejected=0, restore_error=False):
        manager = generation.CharacterGenerationManager()
        self.addCleanup(manager._executor.shutdown)
        manager._jobs['test'] = generation.CharacterGenerationJob(id='test', user_id=1)
        manager._inputs['test'] = b'fixture'
        events = []
        gpu_events = []
        calls = 0
        update = manager._update

        def record(job_id, **changes):
            update(job_id, **changes)
            job = manager.get_job(job_id, 1)
            events.append((job.status, job.progress, job.message))

        def generate(**kwargs):
            for fraction in (0, .25, .5, 1):
                kwargs['on_progress'](fraction)
            return b'fixture'

        def cutout(**kwargs):
            nonlocal calls
            calls += 1
            if calls <= rejected:
                raise generation.ImagePreprocessingError('test rejection')
            return SimpleNamespace(transparent_png_base64=base64.b64encode(b'fixture').decode())

        def switch(mode):
            gpu_events.append((mode, manager.get_job('test', 1).progress))
            if mode == 'ollama' and restore_error:
                raise generation.CharacterGenerationError('test restore failure')

        with TemporaryDirectory() as directory, ExitStack() as stack:
            mocks = {
                'settings': replace(generation.settings, character_output_dir=Path(directory), character_mock_generation=False),
                'preprocess_plant_photo': lambda **kw: SimpleNamespace(sdxl_input_png_base64='fixture'),
                'release_background_removal_sessions': lambda: None,
                '_switch_gpu_mode': switch,
                '_ensure_forge_tunnel': lambda: None,
                '_wait_for_forge': lambda: None,
                '_generate_with_forge': generate,
                'remove_background_for_sprite': cutout,
                'remove_character_face': lambda data: SimpleNamespace(face_removed_png_base64=base64.b64encode(data).decode(), face_bounds=None),
                'normalize_character_framing': lambda data, bounds: SimpleNamespace(png_bytes=data, face_bounds=None),
            }
            for name, value in mocks.items():
                stack.enter_context(patch.object(generation, name, value))
            stack.enter_context(patch.object(manager, '_update', record))
            manager._run_job('test', 'http://api.example.test')
        return manager, events, gpu_events

    def test_sampling_and_postprocessing_advance_before_completion(self):
        manager, events, gpu = self.run_job()
        progress = [event[1] for event in events]
        self.assertEqual(progress, sorted(progress))
        self.assertTrue({24, 29, 38, 40, 43, 44, 92, 95, 100}.issubset(progress))
        self.assertEqual(gpu, [('sdxl', 20), ('ollama', 95)])
        self.assertTrue(all(value < 100 for status, value, _ in events if status != 'completed'))
        self.assertEqual(len(manager.get_job('test', 1).candidates), 3)

    def test_rejected_candidate_never_moves_bar_backwards(self):
        manager, events, _ = self.run_job(rejected=1)
        progress = [event[1] for event in events]
        self.assertEqual(progress, sorted(progress))
        self.assertEqual(manager.get_job('test', 1).status, 'completed')
        self.assertTrue(any('다시' in message for _, _, message in events))

    def test_exhausted_retries_and_restore_failure_never_report_completion(self):
        for options in ({'rejected': 6}, {'restore_error': True}):
            with self.subTest(options=options):
                manager, events, _ = self.run_job(**options)
                self.assertEqual(manager.get_job('test', 1).status, 'failed')
                self.assertTrue(all(value < 100 for _, value, _ in events))

    def test_terminal_job_ignores_late_progress(self):
        manager, _, _ = self.run_job()
        before = manager.get_job('test', 1)
        manager._update('test', status='generating', progress=50)
        self.assertEqual(manager.get_job('test', 1), before)

    def test_nonterminal_progress_is_clamped(self):
        manager = generation.CharacterGenerationManager()
        self.addCleanup(manager._executor.shutdown)
        manager._jobs['test'] = generation.CharacterGenerationJob(id='test', user_id=1)
        manager._update('test', progress=-30)
        self.assertEqual(manager.get_job('test', 1).progress, 0)
        manager._update('test', progress=130)
        self.assertEqual(manager.get_job('test', 1).progress, 99)


class ForgeProgressTests(unittest.TestCase):
    def poll(self, responses):
        stopped = Mock()
        stopped.wait.side_effect = [False] * len(responses) + [True]
        stopped.is_set.return_value = False
        observed = []
        with patch.object(generation.requests, 'post', side_effect=responses) as post:
            generation._poll_forge_progress('task(test)', observed.append, stopped)
        for call in post.call_args_list:
            self.assertEqual(call.kwargs['json'], {'id_task': 'task(test)', 'live_preview': False})
            self.assertEqual(call.kwargs['timeout'], (1, 2))
        return observed

    @staticmethod
    def response(data):
        response = Mock()
        response.json.return_value = data
        return response

    def test_only_observes_own_active_or_completed_task(self):
        self.assertEqual(self.poll([
            self.response({'active': False, 'queued': True, 'progress': .9}),
            self.response({'active': True, 'progress': .25}),
            self.response({'completed': True, 'progress': None}),
        ]), [.25, 1.0])

    def test_invalid_progress_and_temporary_request_failure_are_ignored(self):
        invalid = [None, '0.8', True, float('nan'), float('inf')]
        responses = [requests.Timeout(), self.response([])]
        responses += [self.response({'active': True, 'progress': value}) for value in invalid]
        responses += [self.response({'active': True, 'progress': .5})]
        self.assertEqual(self.poll(responses), [.5])

    def test_progress_stops_without_late_callback(self):
        stopped = Mock()
        stopped.wait.return_value = False
        stopped.is_set.return_value = True
        callback = Mock()
        with patch.object(generation.requests, 'post', return_value=self.response({'active': True, 'progress': .8})):
            generation._poll_forge_progress('task(test)', callback, stopped)
        callback.assert_not_called()

    def test_generation_and_observer_share_unique_task_id_and_stop(self):
        observed = threading.Event()
        payload = {}
        fractions = []

        def post(url, **kwargs):
            if url.endswith('/img2img'):
                payload.update(kwargs['json'])
                self.assertTrue(observed.wait(3), 'progress was not observed during generation')
                return self.response({'images': [base64.b64encode(b'result').decode()]})
            self.assertTrue(url.endswith('/internal/progress'))
            if not payload:
                return self.response({'active': False})
            self.assertEqual(kwargs['json']['id_task'], payload['force_task_id'])
            return self.response({'active': True, 'progress': .5})

        def callback(fraction):
            fractions.append(fraction)
            observed.set()

        with patch.object(generation.requests, 'post', side_effect=post), patch.object(generation, 'FORGE_PROGRESS_INTERVAL_SECONDS', .01):
            self.assertEqual(generation._generate_with_forge('input', 123, callback), b'result')
        self.assertTrue(fractions and all(value == .5 for value in fractions))
        self.assertTrue(payload['force_task_id'].startswith('task(leaflog-'))
        self.assertEqual(payload['seed'], 123)
        self.assertFalse(any(t.name == 'forge-progress' for t in threading.enumerate()))

    def test_image_request_failure_stops_observer_and_keeps_error(self):
        with patch.object(generation.requests, 'post', side_effect=requests.Timeout()):
            with self.assertRaises(generation.CharacterGenerationError):
                generation._generate_with_forge('input', 123, lambda value: None)
        self.assertFalse(any(t.name == 'forge-progress' for t in threading.enumerate()))

    def test_unavailable_progress_endpoint_does_not_fail_image_request(self):
        attempted = threading.Event()

        def post(url, **kwargs):
            if url.endswith('/img2img'):
                self.assertTrue(attempted.wait(3))
                return self.response({'images': [base64.b64encode(b'result').decode()]})
            attempted.set()
            raise requests.HTTPError('progress endpoint unavailable')

        callback = Mock()
        with patch.object(generation.requests, 'post', side_effect=post), patch.object(generation, 'FORGE_PROGRESS_INTERVAL_SECONDS', .01):
            self.assertEqual(generation._generate_with_forge('input', 123, callback), b'result')
        callback.assert_not_called()


if __name__ == '__main__':
    unittest.main()
