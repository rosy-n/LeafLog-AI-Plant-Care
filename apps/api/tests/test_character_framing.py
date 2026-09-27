from io import BytesIO
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw, ImageOps, PngImagePlugin

from app.character_framing import (
    CANVAS_SIZE, FRAMING_VERSION, MIN_VISUAL_SCALE, MAX_VISUAL_SCALE,
    MAX_READABLE_HEIGHT, MAX_READABLE_WIDTH, READABLE_SIDE_MARGIN, _body_footprint,
    _pot_anchor, _visual_weight_scale, normalize_character_framing,
)
from app.image_preprocessing import ImagePreprocessingError


def png(image):
    stream = BytesIO()
    image.save(stream, format="PNG")
    return stream.getvalue()


def sprite(offset=0):
    image = Image.new("RGBA", (1024, 1024))
    draw = ImageDraw.Draw(image)
    draw.rectangle((330 + offset, 600, 689 + offset, 919), fill=(220, 180, 100, 255))
    draw.rectangle((490 + offset, 180, 529 + offset, 619), fill=(0, 150, 50, 255))
    draw.rectangle((270 + offset, 240, 669 + offset, 360), fill=(0, 150, 50, 255))
    draw.rectangle((440 + offset, 710, 579 + offset, 789), fill=(220, 80, 110, 255))
    return image


class CharacterFramingTests(unittest.TestCase):
    def test_left_and_right_shift_produce_the_same_centered_sprite(self):
        results = []
        for offset in (-180, 0, 180):
            framed = normalize_character_framing(png(sprite(offset)), (440 + offset, 710, 580 + offset, 790))
            image = Image.open(BytesIO(framed.png_bytes))
            bounds = image.getchannel("A").getbbox()
            center, _ = _pot_anchor(image, bounds)
            self.assertAlmostEqual(center, 512, delta=1)
            self.assertGreater(bounds[3] - bounds[1], 1024 * 0.49)
            self.assertLess(bounds[3] - bounds[1], 1024 * 0.68)
            self.assertAlmostEqual(image.getchannel("A").getbbox()[3], 1024 * 0.85, delta=1)
            results.append((np.asarray(image), framed.face_bounds))
        for pixels, face in results[1:]:
            np.testing.assert_array_equal(pixels, results[0][0])
            self.assertEqual(face, results[0][1])

    def test_face_coordinates_follow_the_image_transform(self):
        result = normalize_character_framing(png(sprite()), (440, 710, 580, 790))
        rgba = np.asarray(Image.open(BytesIO(result.png_bytes)))
        y, x = np.where(np.all(rgba == (220, 80, 110, 255), axis=2))
        measured = (x.min(), y.min(), x.max() + 1, y.max() + 1)
        for actual, expected in zip(measured, result.face_bounds):
            self.assertAlmostEqual(actual, expected, delta=1)

    def test_asymmetric_leaves_stay_visible_without_moving_the_pot(self):
        image = sprite()
        ImageDraw.Draw(image).rectangle((10, 250, 510, 350), fill=(0, 150, 50, 255))
        output = Image.open(BytesIO(normalize_character_framing(png(image)).png_bytes))
        bounds = output.getchannel("A").getbbox()
        center, _ = _pot_anchor(output, bounds)
        self.assertAlmostEqual(center, 512, delta=1)
        self.assertGreaterEqual(bounds[0], 100)
        self.assertLessEqual(bounds[2], 924)

    def test_tall_thin_plant_is_not_stretched_or_clipped(self):
        image = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(image)
        draw.rectangle((480, 700, 539, 999), fill=(200, 100, 80, 255))
        draw.rectangle((505, 1, 514, 750), fill=(0, 150, 50, 255))
        output = Image.open(BytesIO(normalize_character_framing(png(image)).png_bytes))
        bounds = output.getchannel("A").getbbox()
        self.assertGreaterEqual(bounds[1], 173)
        self.assertLessEqual(bounds[3], 871)
        self.assertLess(bounds[2] - bounds[0], 60)

    def test_large_pots_get_a_soft_reduction_between_body_only_and_height_only(self):
        heights = []
        for pot_width in (180, 360, 520):
            image = Image.new("RGBA", (1024, 1024))
            draw = ImageDraw.Draw(image)
            draw.rectangle((512 - pot_width // 2, 550, 511 + pot_width // 2, 919), fill=(200, 140, 80, 255))
            draw.rectangle((300, 180, 720, 600), fill=(20, 150, 60, 255))
            output = Image.open(BytesIO(normalize_character_framing(png(image)).png_bytes))
            bounds = output.getchannel("A").getbbox()
            heights.append(bounds[3] - bounds[1])
        # Body limits may reduce the height, but never collapse a wide pot.
        self.assertGreaterEqual(heights[0], 1024 * 0.68 * MIN_VISUAL_SCALE - 2)
        self.assertLessEqual(heights[0], 1024 * 0.68 + 2)
        self.assertGreater(heights[0], heights[1])
        self.assertGreater(heights[1], heights[2])
        for height, pot_width in zip(heights[1:], (360, 520)):
            body_only_height = 1024 * 0.24 / pot_width * 740
            self.assertGreater(height, body_only_height + 20)
            self.assertLess(height, heights[0])

    def test_foliage_density_alone_does_not_shrink_a_readable_pot(self):
        sparse = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(sparse)
        draw.rectangle((402, 660, 621, 919), fill=(180, 100, 50, 255))
        draw.rectangle((502, 180, 521, 660), fill=(20, 140, 40, 255))
        draw.rectangle((300, 180, 723, 199), fill=(20, 140, 40, 255))
        dense = sparse.copy()
        ImageDraw.Draw(dense).rectangle((300, 180, 723, 659), fill=(20, 140, 40, 255))
        self.assertEqual(sparse.getbbox(), dense.getbbox())
        heights = []
        for image in (sparse, dense):
            output = Image.open(BytesIO(normalize_character_framing(png(image)).png_bytes))
            bounds = output.getchannel("A").getbbox()
            heights.append(bounds[3] - bounds[1])
        self.assertAlmostEqual(heights[1], heights[0], delta=1)

    def test_small_face_can_grow_but_only_within_the_readability_allowance(self):
        image = sprite()
        bounds = image.getchannel("A").getbbox()
        with patch("app.character_framing._body_footprint", return_value=(250, 50000)):
            scale = _visual_weight_scale(image, bounds, 512, 1.0, 250, (462, 700, 562, 750))
        self.assertEqual(scale, MAX_VISUAL_SCALE)

    def test_oversized_pot_does_not_shrink_an_already_small_face(self):
        image = sprite()
        bounds = image.getchannel("A").getbbox()
        with patch("app.character_framing._body_footprint", return_value=(450, 150000)):
            scale = _visual_weight_scale(image, bounds, 512, 1.0, 450, (462, 700, 562, 750))
        self.assertEqual(scale, 1.0)

    def test_face_readability_threshold_has_no_abrupt_scale_jump(self):
        image = sprite()
        bounds = image.getchannel("A").getbbox()
        with patch("app.character_framing._body_footprint", return_value=(270, 50000)):
            factors = [_visual_weight_scale(image, bounds, 512, 1.0, 270, (400, 700, 400 + width, 750))
                       for width in (127, 128, 129)]
        self.assertLess(factors[0] - factors[1], 0.02)
        self.assertEqual(factors[1:], [1.0, 1.0])

    def test_small_pot_and_face_use_more_space_than_a_readable_pot(self):
        image = sprite()
        bounds = image.getchannel("A").getbbox()
        with patch("app.character_framing._body_footprint", return_value=(230, 40000)):
            small = _visual_weight_scale(image, bounds, 512, 1.0, 230, (451, 700, 573, 770))
        with patch("app.character_framing._body_footprint", return_value=(280, 55000)):
            readable = _visual_weight_scale(image, bounds, 512, 1.0, 280, (444, 700, 580, 780))
        self.assertGreater(small, 1.15)
        self.assertLessEqual(small, MAX_VISUAL_SCALE)
        self.assertEqual(readable, 1.0)

    def test_readability_scale_is_continuous_across_the_full_transition(self):
        image = sprite()
        bounds = image.getchannel("A").getbbox()
        with patch("app.character_framing._body_footprint", return_value=(270, 50000)):
            factors = [_visual_weight_scale(image, bounds, 512, 1.0, 270, (400, 700, 400 + width, 750))
                       for width in np.arange(110, 140, 0.1)]
        changes = np.diff(factors)
        self.assertTrue(np.all(changes <= 1e-9))
        self.assertLess(float(np.max(np.abs(changes))), 0.005)

    def test_small_asymmetric_plant_can_use_padding_without_shifting_its_pot(self):
        image = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(image)
        draw.rectangle((397, 650, 626, 869), fill=(200, 140, 80, 255))
        draw.rectangle((506, 174, 517, 650), fill=(20, 150, 60, 255))
        draw.rectangle((340, 240, 893, 250), fill=(20, 150, 60, 255))
        framed = normalize_character_framing(png(image), (454, 728, 570, 806))
        output = Image.open(BytesIO(framed.png_bytes))
        bounds = output.getchannel("A").getbbox()
        center, _ = _pot_anchor(output, bounds)
        self.assertAlmostEqual(center, 512, delta=1)
        self.assertGreater(bounds[3] - bounds[1], 800)
        self.assertGreater(bounds[2], 924)
        self.assertGreaterEqual(bounds[0], CANVAS_SIZE * READABLE_SIDE_MARGIN - 1)
        self.assertLessEqual(bounds[2], CANVAS_SIZE * (1 - READABLE_SIDE_MARGIN) + 1)
        self.assertGreaterEqual(bounds[1], CANVAS_SIZE * (0.85 - MAX_READABLE_HEIGHT) - 1)
        self.assertAlmostEqual(bounds[3], 870, delta=1)
        self.assertGreater(framed.face_bounds[2] - framed.face_bounds[0], 130)
        # Scaling remains uniform; both leaf endpoints remain represented.
        self.assertAlmostEqual((bounds[2] - bounds[0]) / (bounds[3] - bounds[1]), 554 / 696, delta=0.005)

    def test_small_face_never_allows_foliage_to_escape_the_canvas(self):
        image = sprite()
        ImageDraw.Draw(image).rectangle((5, 220, 1000, 350), fill=(10, 150, 40, 255))
        framed = normalize_character_framing(png(image), (495, 710, 525, 730))
        output = Image.open(BytesIO(framed.png_bytes))
        bounds = output.getchannel("A").getbbox()
        self.assertGreaterEqual(bounds[0], CANVAS_SIZE * READABLE_SIDE_MARGIN - 1)
        self.assertLessEqual(bounds[2], CANVAS_SIZE * (1 - READABLE_SIDE_MARGIN) + 1)
        self.assertLessEqual(bounds[2] - bounds[0], CANVAS_SIZE * MAX_READABLE_WIDTH + 2)
        self.assertLessEqual(bounds[3] - bounds[1], CANVAS_SIZE * MAX_READABLE_HEIGHT + 2)

    def test_enlarged_small_face_tracks_the_actual_pixels(self):
        image = sprite()
        ImageDraw.Draw(image).rectangle((495, 710, 524, 729), fill=(20, 30, 240, 255))
        result = normalize_character_framing(png(image), (495, 710, 525, 730))
        rgba = np.asarray(Image.open(BytesIO(result.png_bytes)))
        y, x = np.where(np.all(rgba == (20, 30, 240, 255), axis=2))
        for actual, expected in zip((x.min(), y.min(), x.max() + 1, y.max() + 1), result.face_bounds):
            self.assertAlmostEqual(actual, expected, delta=1)

    def test_visual_correction_is_bounded_and_never_enlarges(self):
        image = sprite()
        bounds = image.getchannel("A").getbbox()
        center, width = _pot_anchor(image, bounds)
        for scale in (0.1, 0.8, 2.0):
            result = _visual_weight_scale(image, bounds, center, scale, width)
            self.assertGreaterEqual(result, scale * MIN_VISUAL_SCALE)
            self.assertLessEqual(result, scale)

    def test_body_measurement_ignores_detached_and_one_sided_leaves(self):
        image = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(image)
        draw.rectangle((450, 620, 573, 919), fill=(200, 100, 60, 255))
        bounds = (100, 180, 1000, 920)
        expected = _body_footprint(image, bounds, 512, 124)
        draw.rectangle((650, 620, 999, 730), fill=(10, 150, 40, 255))
        self.assertEqual(_body_footprint(image, bounds, 512, 124), expected)
        draw.rectangle((574, 620, 649, 730), fill=(10, 150, 40, 255))
        width, area = _body_footprint(image, bounds, 512, 124)
        self.assertEqual(width, 124)
        self.assertLess(area, expected[1])

    def test_flared_body_is_measured_above_narrow_base(self):
        image = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(image)
        draw.rectangle((462, 750, 561, 919), fill=(200, 100, 60, 255))
        draw.rectangle((447, 624, 576, 749), fill=(200, 100, 60, 255))
        width, area = _body_footprint(image, (300, 180, 724, 920), 512, 100)
        self.assertEqual(width, 130)
        self.assertGreater(area, 100 * (920 - 624))

    def test_body_width_and_area_can_reduce_even_a_sparse_sprite(self):
        image = sprite()
        bounds = image.getchannel("A").getbbox()
        for footprint in ((500, 100), (100, 200000)):
            with patch("app.character_framing._body_footprint", return_value=footprint):
                result = _visual_weight_scale(image, bounds, 512, 1.0, 360)
                self.assertAlmostEqual(result, MIN_VISUAL_SCALE)

    def test_old_version_is_upgraded_once_with_face_alignment(self):
        for version in ("sprite-v2", "sprite-v4"):
            with self.subTest(version=version):
                metadata = PngImagePlugin.PngInfo()
                metadata.add_text("leaflog_framing", version)
                stream = BytesIO()
                sprite().save(stream, format="PNG", pnginfo=metadata)
                first = normalize_character_framing(stream.getvalue(), (440, 710, 580, 790))
                self.assertNotEqual(first.png_bytes, stream.getvalue())
                self.assertEqual(Image.open(BytesIO(first.png_bytes)).info["leaflog_framing"], FRAMING_VERSION)
                self.assertEqual(normalize_character_framing(first.png_bytes, first.face_bounds), first)

    def test_equivalent_image_at_double_resolution_has_same_framing(self):
        original = sprite()
        doubled = original.resize((2048, 2048), Image.Resampling.NEAREST)
        first = normalize_character_framing(png(original), (440, 710, 580, 790))
        second = normalize_character_framing(png(doubled), (880, 1420, 1160, 1580))
        for actual, expected in zip(second.face_bounds, first.face_bounds):
            self.assertAlmostEqual(actual, expected, delta=1)
        bounds1 = Image.open(BytesIO(first.png_bytes)).getchannel("A").getbbox()
        bounds2 = Image.open(BytesIO(second.png_bytes)).getchannel("A").getbbox()
        for actual, expected in zip(bounds2, bounds1):
            self.assertAlmostEqual(actual, expected, delta=1)

    def test_very_wide_silhouette_is_width_limited_without_stretching(self):
        image = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(image)
        draw.rectangle((450, 620, 573, 819), fill=(200, 140, 80, 255))
        draw.rectangle((20, 430, 1003, 650), fill=(20, 150, 60, 255))
        output = Image.open(BytesIO(normalize_character_framing(png(image)).png_bytes))
        bounds = output.getchannel("A").getbbox()
        self.assertAlmostEqual(bounds[2] - bounds[0], 1024 * 0.68, delta=2)
        self.assertAlmostEqual((bounds[2] - bounds[0]) / (bounds[3] - bounds[1]), 984 / 390, delta=0.02)

    def test_nearest_sampling_preserves_pixel_colors_and_transparency(self):
        original = sprite()
        output = Image.open(BytesIO(normalize_character_framing(png(original)).png_bytes))
        self.assertTrue(set(output.getdata()).issubset(set(original.getdata())))
        self.assertEqual(output.size, (1024, 1024))

    def test_framed_image_is_not_repeatedly_resized(self):
        first = normalize_character_framing(png(sprite()), (440, 710, 580, 790))
        second = normalize_character_framing(first.png_bytes, first.face_bounds)
        self.assertEqual(first, second)
        self.assertEqual(Image.open(BytesIO(first.png_bytes)).info["leaflog_framing"], FRAMING_VERSION)

    def test_non_square_canvas_and_missing_face_are_supported(self):
        image = ImageOps.crop(sprite(), border=(200, 0, 200, 0))
        result = normalize_character_framing(png(image))
        self.assertIsNone(result.face_bounds)
        self.assertEqual(Image.open(BytesIO(result.png_bytes)).size, (CANVAS_SIZE, CANVAS_SIZE))

    def test_empty_image_and_invalid_bounds_are_rejected(self):
        with self.assertRaises(ImagePreprocessingError):
            normalize_character_framing(png(Image.new("RGBA", (1024, 1024))))
        with self.assertRaises(ImagePreprocessingError):
            normalize_character_framing(png(sprite()), (-1, 0, 500, 500))


if __name__ == "__main__":
    unittest.main()
