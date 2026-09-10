import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from app.image_preprocessing import (
    ImagePreprocessingError,
    _constrain_expression_bounds_to_pot,
    _detect_pot_bounds,
    remove_character_face,
)


class ExpressionPlacementTests(unittest.TestCase):
    def test_left_and_right_faces_move_to_pot_center(self):
        pot = (200, 600, 800, 920)
        for face in ((220, 650, 420, 790), (580, 650, 780, 790)):
            with self.subTest(face=face):
                self.assertEqual(
                    _constrain_expression_bounds_to_pot(face, pot, (1024, 1024)),
                    (400, 650, 600, 790),
                )

    def test_center_uses_pot_not_canvas(self):
        self.assertEqual(
            _constrain_expression_bounds_to_pot(
                (160, 610, 360, 750), (100, 600, 500, 920), (1024, 1024)
            ),
            (200, 610, 400, 750),
        )

    def test_already_centered_face_is_unchanged(self):
        face = (390, 640, 610, 800)
        self.assertEqual(
            _constrain_expression_bounds_to_pot(
                face, (200, 600, 800, 920), (1024, 1024)
            ),
            face,
        )

    def test_narrow_pot_keeps_half_width_limit(self):
        self.assertEqual(
            _constrain_expression_bounds_to_pot(
                (250, 640, 750, 800), (420, 600, 620, 920), (1024, 1024)
            ),
            (470, 640, 570, 800),
        )

    def test_small_face_is_not_enlarged(self):
        self.assertEqual(
            _constrain_expression_bounds_to_pot(
                (210, 640, 310, 800), (200, 600, 800, 920), (1024, 1024)
            ),
            (450, 640, 550, 800),
        )

    def test_odd_width_is_preserved_without_rounding_growth(self):
        face = (220, 640, 421, 800)
        result = _constrain_expression_bounds_to_pot(
            face, (200, 600, 800, 920), (1024, 1024)
        )
        self.assertEqual(result[2] - result[0], 201)
        self.assertLessEqual(abs((result[0] + result[2]) / 2 - 500), 0.5)
        self.assertEqual((result[1], result[3]), (640, 800))

    def test_missing_or_invalid_pot_preserves_detected_face(self):
        face = (352, 603, 600, 771)
        for pot in (None, (500, 600, 500, 900), (600, 600, 500, 900)):
            with self.subTest(pot=pot):
                self.assertEqual(
                    _constrain_expression_bounds_to_pot(face, pot, (1024, 1024)),
                    face,
                )

    def test_known_off_center_bounds_regression(self):
        self.assertEqual(
            _constrain_expression_bounds_to_pot(
                (352, 603, 600, 771), (327, 666, 822, 936), (1024, 1024)
            ),
            (450, 603, 698, 771),
        )

    def test_detected_off_center_pot_centers_overlay(self):
        rgba = np.zeros((1024, 1024, 4), dtype=np.uint8)
        rgba[610:930, 120:520] = (180, 170, 150, 255)
        pot = _detect_pot_bounds(Image.fromarray(rgba))
        self.assertIsNotNone(pot)
        result = _constrain_expression_bounds_to_pot(
            (130, 640, 310, 770), pot, (1024, 1024)
        )
        self.assertEqual(result, (230, 640, 410, 770))

    def test_removal_uses_original_bounds_but_returns_centered_overlay(self):
        source = Image.new("RGBA", (1024, 1024), (180, 170, 150, 255))
        detected = (220, 640, 420, 790)
        with (
            patch("app.image_preprocessing._load_image", return_value=source),
            patch("app.image_preprocessing._detect_face_bounds", return_value=detected),
            patch("app.image_preprocessing._detect_pot_bounds", return_value=(200, 600, 800, 920)),
            patch("app.image_preprocessing._inpaint_face_region", return_value=source) as inpaint,
        ):
            result = remove_character_face(b"test-image")
        inpaint.assert_called_once_with(source, detected)
        self.assertEqual(result.face_bounds, (400, 640, 600, 790))

    def test_face_detection_failure_is_not_hidden_by_centering(self):
        source = Image.new("RGBA", (1024, 1024))
        with (
            patch("app.image_preprocessing._load_image", return_value=source),
            patch("app.image_preprocessing._detect_face_bounds", side_effect=ImagePreprocessingError("No face")),
            patch("app.image_preprocessing._inpaint_face_region") as inpaint,
        ):
            with self.assertRaises(ImagePreprocessingError):
                remove_character_face(b"test-image")
        inpaint.assert_not_called()


if __name__ == "__main__":
    unittest.main()
