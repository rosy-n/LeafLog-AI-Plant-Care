from io import BytesIO
import unittest

import numpy as np
from PIL import Image, ImageDraw, ImageOps

from app.character_framing import CANVAS_SIZE, FRAMING_VERSION, _pot_anchor, normalize_character_framing
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
        self.assertAlmostEqual(heights[0], 1024 * 0.68, delta=2)
        self.assertGreater(heights[0], heights[1])
        self.assertGreater(heights[1], heights[2])
        for height, pot_width in zip(heights[1:], (360, 520)):
            body_only_height = 1024 * 0.24 / pot_width * 740
            self.assertGreater(height, body_only_height + 20)
            self.assertLess(height, heights[0])

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
