from dataclasses import dataclass
from io import BytesIO
from math import sqrt

import numpy as np
from PIL import Image, PngImagePlugin

from .image_preprocessing import ImagePreprocessingError, _load_image, _longest_opaque_run


CANVAS_SIZE = 1024
FRAMING_VERSION = "sprite-v5"
# Spaghetti proportions guide both height and visual weight, not a hard pot cap.
GROUND_Y = 0.85
TOP_MARGIN = 0.17
REFERENCE_POT_WIDTH = 0.24
MAX_WIDTH = 0.68
SIDE_MARGIN = 0.10
# Prefer readable pots and faces over matching the area of dissimilar foliage.
EXTREME_VISIBLE_AREA = 0.28
MIN_BODY_WIDTH = 0.25
REFERENCE_BODY_WIDTH = 0.30
REFERENCE_BODY_AREA = 0.09
MIN_FACE_WIDTH = 0.125
TARGET_FACE_WIDTH = 0.14
SMALL_FACE_TRANSITION = 0.06
MIN_VISUAL_SCALE = 0.85
MAX_VISUAL_SCALE = 1.18
MAX_READABLE_HEIGHT = 0.81
MAX_READABLE_WIDTH = 0.76
READABLE_SIDE_MARGIN = 0.055


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


def _body_footprint(
    image: Image.Image, bounds: tuple[int, int, int, int], center_x: float,
    anchor_width: float,
) -> tuple[float, float]:
    """Estimate lower-body width and area, not a semantic pot segmentation."""
    _, top, _, bottom = bounds
    alpha = np.asarray(image)[:, :, 3] >= 128
    widths = []
    for y in range(round(top + (bottom - top) * 0.60), bottom):
        # Detached, low-hanging leaves must not widen the body measurement.
        edges = np.diff(np.pad(alpha[y].astype(np.int8), (1, 1)))
        starts, ends = np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)
        index = int(np.searchsorted(starts, center_x, side="right")) - 1
        if index < 0 or center_x >= ends[index]:
            continue
        start, end = int(starts[index]), int(ends[index])
        if (abs((start + end) / 2 - center_x) <= anchor_width * 0.20
                and end - start <= anchor_width * 1.40):
            widths.append(end - start)
    if len(widths) < max(4, (bottom - top) * 0.05):
        return 0.0, 0.0
    return float(np.quantile(widths, 0.9)), float(sum(widths))


def _visual_weight_scale(
    image: Image.Image, bounds: tuple[int, int, int, int],
    center_x: float, scale: float, anchor_width: float | None,
    face_bounds: tuple[int, int, int, int] | None = None,
) -> float:
    area = float(np.asarray(image.getchannel("A"), dtype=np.float64).sum() / 255)
    ceiling = sqrt(CANVAS_SIZE ** 2 * EXTREME_VISIBLE_AREA / (area * scale ** 2))
    preferred = 1.0
    if anchor_width is not None:
        width, body_area = _body_footprint(image, bounds, center_x, anchor_width)
        if width and body_area:
            ceiling = min(
                ceiling,
                CANVAS_SIZE * REFERENCE_BODY_WIDTH / (width * scale),
                sqrt(CANVAS_SIZE ** 2 * REFERENCE_BODY_AREA / (body_area * scale ** 2)),
            )
            if face_bounds is not None:
                preferred = max(preferred, CANVAS_SIZE * MIN_BODY_WIDTH / (width * scale))
    face_floor = 0.0
    if face_bounds is not None and anchor_width is not None:
        face_width = (face_bounds[2] - face_bounds[0]) * scale
        face_floor = CANVAS_SIZE * MIN_FACE_WIDTH / face_width
        if face_floor > 1:
            # Ignore near-threshold pixel noise, but use the full readability
            # allowance for genuinely small faces on narrow pots.
            deficit = min(1.0, (face_floor - 1) / SMALL_FACE_TRANSITION)
            blend = deficit * deficit * (3 - 2 * deficit)
            preferred = max(preferred, 1 + blend * (CANVAS_SIZE * TARGET_FACE_WIDTH / face_width - 1))
    if ceiling < 1:
        # A large pot must not be shrunk at the expense of an already small face.
        correction = max(MIN_VISUAL_SCALE, ceiling, min(1.0, face_floor))
    else:
        correction = min(MAX_VISUAL_SCALE, preferred, ceiling)
    return scale * correction


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
    baseline_scale = scale
    scale = _visual_weight_scale(source, bounds, center_x, scale, anchor[1] if anchor else None, face_bounds)
    # Readability may use a little more padding, never clip or distort the sprite.
    if scale > baseline_scale:
        side_room = CANVAS_SIZE * (0.5 - READABLE_SIDE_MARGIN)
    scale = min(scale, CANVAS_SIZE * MAX_READABLE_HEIGHT / (bottom - top),
                CANVAS_SIZE * MAX_READABLE_WIDTH / (right - left),
                side_room / max(center_x - left, right - center_x))
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
