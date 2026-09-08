import base64
from io import BytesIO
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from PIL import Image

from app import image_preprocessing as preprocessing


def photo(size, format='PNG', **kwargs):
    output = BytesIO()
    Image.new('RGB', size, (50, 150, 70)).save(output, format=format, **kwargs)
    return output.getvalue()


class PreprocessingLimitTests(unittest.TestCase):
    def test_session_limits_cpu_memory_reuse_without_changing_model(self):
        options = SimpleNamespace()
        session_class = Mock()
        session_class.name.return_value = 'birefnet-general'
        modules = {
            'onnxruntime': SimpleNamespace(SessionOptions=lambda: options),
            'rembg': SimpleNamespace(),
            'rembg.sessions': SimpleNamespace(sessions_class=[session_class]),
        }
        preprocessing._background_removal_session.cache_clear()
        self.addCleanup(preprocessing._background_removal_session.cache_clear)
        with patch.dict('sys.modules', modules):
            result = preprocessing._background_removal_session('birefnet-general')
            self.assertIs(preprocessing._background_removal_session('birefnet-general'), result)
        session_class.assert_called_once_with('birefnet-general', options)
        self.assertFalse(options.enable_cpu_mem_arena)
        self.assertFalse(options.enable_mem_pattern)
        self.assertEqual(options.intra_op_num_threads, 2)
        self.assertEqual(options.inter_op_num_threads, 1)

    def test_large_photo_is_bounded_before_model_and_alpha_matting(self):
        raw = photo((4032, 3024), 'JPEG')
        sizes = []

        def remove(image, mode):
            sizes.append((image.size, mode))
            return image

        with patch.object(preprocessing, '_remove_background', side_effect=remove):
            result = preprocessing.preprocess_plant_photo(raw)
        self.assertEqual(sizes, [((1536, 1152), 'quality')])
        image = Image.open(BytesIO(base64.b64decode(result.sdxl_input_png_base64)))
        self.assertEqual(image.size, (1024, 1024))
        self.assertEqual(Image.open(BytesIO(raw)).size, (4032, 3024))

    def test_both_quality_passes_and_fast_pass_receive_bounded_images(self):
        raw = photo((3072, 2048))
        for mode, expected_passes in [('quality', 2), ('fast', 1)]:
            with self.subTest(mode=mode):
                calls = []

                def remove(image, **kwargs):
                    calls.append((image.size, kwargs['alpha_matting']))
                    return image

                with patch.object(preprocessing, '_background_removal_session'), patch.object(preprocessing, '_run_background_removal', side_effect=remove):
                    preprocessing.remove_background_for_sprite(raw, quality_mode=mode)
                self.assertEqual(len(calls), expected_passes)
                self.assertTrue(all(max(size) <= 1536 for size, _ in calls))
                self.assertTrue(calls[-1][1])

    def test_exif_orientation_and_aspect_ratio_are_preserved(self):
        exif = Image.Exif()
        exif[274] = 6
        raw = photo((4032, 3024), 'JPEG', exif=exif)
        image = preprocessing._load_image(raw, max_size=1536)
        self.assertEqual(image.size, (1152, 1536))

    def test_small_transparent_image_is_not_upscaled_or_flattened(self):
        source = Image.new('RGBA', (800, 600), (10, 20, 30, 100))
        output = BytesIO()
        source.save(output, format='PNG')
        image = preprocessing._load_image(output.getvalue(), max_size=1536)
        self.assertEqual(image.size, source.size)
        self.assertEqual(image.tobytes(), source.tobytes())

    def test_face_coordinate_loader_keeps_original_dimensions(self):
        image = preprocessing._load_image(photo((1800, 1600)))
        self.assertEqual(image.size, (1800, 1600))

    def test_invalid_output_size_fails_before_expensive_processing(self):
        with patch.object(preprocessing, '_load_image') as load:
            with self.assertRaises(preprocessing.ImagePreprocessingError):
                preprocessing.preprocess_plant_photo(b'photo', canvas_size=2048)
            load.assert_not_called()


if __name__ == '__main__':
    unittest.main()
