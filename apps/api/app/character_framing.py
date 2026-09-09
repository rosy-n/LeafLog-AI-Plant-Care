from dataclasses import dataclass
from io import BytesIO
from math import sqrt

import numpy as np
from PIL import Image, PngImagePlugin

from .image_preprocessing import ImagePreprocessingError, _load_image, _longest_opaque_run


CANVAS_SIZE = 1024
FRAMING_VERSION = "sprite-v2"
# Spaghetti proportions guide both height and visual weight, not a hard pot cap.
GROUND_Y = 0.85
TOP_MARGIN = 0.17
REFERENCE_POT_WIDTH = 0.24
MAX_WIDTH = 0.68
SIDE_MARGIN = 0.10


@dataclass(frozen=True)
class FramedCharacter:
    png_bytes: bytes
    face_bounds: tuple[int, int, int, int] | None


def _pot_anchor(image: Image.Image, bounds: tuple[int, int, int, int]) -> tuple[float, float] | None:
    """Use the lower body, excluding the rim and leaves that overhang one side."""
    left, top, right, bottom = bounds
    alpha = np.asarray(image)[:, :, 3] >= 128
    rows = []
    for y in range(round(top + (bottom - top) * 0.75), round(top + (bottom - top) * 0.94)):
        run = _longest_opaque_run(alpha[y])
        if run and run[1] - run[0] >= max(4, (right - left) * 0.08):
            rows.append(run)
    if len(rows) < max(4, (bottom - top) * 0.05):
        return None
    centers = [(start + end) / 2 for start, end in rows]
    widths = [end - start for start, end in rows]
    return float(np.median(centers)), float(np.quantile(widths, 0.8))


def normalize_character_framing(
    image_bytes: bytes,
    face_bounds: tuple[int, int, int, int] | None = None,
) -> FramedCharacter:
    """Align a transparent sprite and its face together without changing its shape."""
    source = _load_image(image_bytes)
    if max(source.size) > 2048:
        raise ImagePreprocessingError("Character image dimensions must not exceed 2048 pixels.")
    if face_bounds is not None:
        left, top, right, bottom = face_bounds
        if not (0 <= left < right <= source.width and 0 <= top < bottom <= source.height):
            raise ImagePreprocessingError("Face bounds must fit inside the character image.")
    if source.info.get("leaflog_framing") == FRAMING_VERSION and source.size == (CANVAS_SIZE, CANVAS_SIZE):
        return FramedCharacter(image_bytes, face_bounds)

    bounds = source.getchannel("A").getbbox()
    if bounds is None:
        raise ImagePreprocessingError("Character image is empty.")
    left, top, right, bottom = bounds
    anchor = _pot_anchor(source, bounds)
    center_x = anchor[0] if anchor else (left + right) / 2
    target_x = CANVAS_SIZE / 2
    target_y = round(CANVAS_SIZE * GROUND_Y)
    scale = (target_y - CANVAS_SIZE * TOP_MARGIN) / (bottom - top)
    if anchor:
        body_scale = CANVAS_SIZE * REFERENCE_POT_WIDTH / anchor[1]
        if body_scale < scale:
            # Blend height and body size continuously; do not classify plant types.
            scale = sqrt(scale * body_scale)
    scale = min(scale, CANVAS_SIZE * MAX_WIDTH / (right - left))
    # Keep even asymmetric foliage on the canvas while the pot stays centered.
    side_room = CANVAS_SIZE * (0.5 - SIDE_MARGIN)
    scale = min(scale, side_room / max(center_x - left, right - center_x))
    offset_x = target_x - center_x * scale
    offset_y = target_y - bottom * scale
    framed = source.transform(
        (CANVAS_SIZE, CANVAS_SIZE), Image.Transform.AFFINE,
        (1 / scale, 0, -offset_x / scale, 0, 1 / scale, -offset_y / scale),
        resample=Image.Resampling.NEAREST, fillcolor=(0, 0, 0, 0),
    )
    transformed_face = None
    if face_bounds is not None:
        left, top, right, bottom = face_bounds
        transformed_face = (
            round(left * scale + offset_x), round(top * scale + offset_y),
            round(right * scale + offset_x), round(bottom * scale + offset_y),
        )
        if not (0 <= transformed_face[0] < transformed_face[2] <= CANVAS_SIZE
                and 0 <= transformed_face[1] < transformed_face[3] <= CANVAS_SIZE):
            raise ImagePreprocessingError("Framed face bounds fall outside the canvas.")
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("leaflog_framing", FRAMING_VERSION)
    output = BytesIO()
    framed.save(output, format="PNG", pnginfo=metadata)
    return FramedCharacter(output.getvalue(), transformed_face)
