from __future__ import annotations

import base64
import gc
import os
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from typing import Any, Literal

import cv2
import numpy as np
import pillow_avif  # Registers AVIF support with Pillow.
from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError

QualityMode = Literal["fast", "quality"]

FAST_BACKGROUND_REMOVAL_MODEL = "isnet-general-use"
QUALITY_BACKGROUND_REMOVAL_MODEL = "birefnet-general"


class ImagePreprocessingError(ValueError):
    pass


class ImagePreprocessingUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class PlantPreprocessResult:
    canvas_size: int
    sdxl_input_png_base64: str
    transparent_png_base64: str


@dataclass(frozen=True)
class BackgroundRemovalResult:
    canvas_size: int
    transparent_png_base64: str


@dataclass(frozen=True)
class CharacterFaceRemovalResult:
    width: int
    height: int
    face_removed_png_base64: str


@lru_cache(maxsize=2)
def _background_removal_session(model_name: str) -> Any:
    try:
        from rembg import new_session
    except ImportError as exc:
        raise ImagePreprocessingUnavailable(
            "Image preprocessing dependencies are not installed. Run `pip install -r requirements.txt`."
        ) from exc

    return new_session(model_name)


def release_background_removal_sessions() -> None:
    """Release ONNX segmentation sessions before another large model is loaded."""
    _background_removal_session.cache_clear()
    gc.collect()


def preprocess_plant_photo(
    image_bytes: bytes,
    canvas_size: int = 1024,
    quality_mode: QualityMode = "quality",
) -> PlantPreprocessResult:
    transparent = _remove_background_to_square(image_bytes, canvas_size, quality_mode)
    sdxl_input = _with_white_background(transparent)

    return PlantPreprocessResult(
        canvas_size=canvas_size,
        sdxl_input_png_base64=_image_to_base64_png(sdxl_input),
        transparent_png_base64=_image_to_base64_png(transparent),
    )


def remove_background_for_sprite(
    image_bytes: bytes,
    canvas_size: int = 1024,
    quality_mode: QualityMode = "quality",
) -> BackgroundRemovalResult:
    transparent = _remove_background_to_square(image_bytes, canvas_size, quality_mode)
    return BackgroundRemovalResult(
        canvas_size=canvas_size,
        transparent_png_base64=_image_to_base64_png(transparent),
    )


def remove_character_face(image_bytes: bytes) -> CharacterFaceRemovalResult:
    """Remove the generated eyes, mouth, and blush without regenerating the sprite."""
    if not image_bytes:
        raise ImagePreprocessingError("Image file is empty.")

    source = _load_image(image_bytes)
    if source.width > 2048 or source.height > 2048:
        raise ImagePreprocessingError("Character image dimensions must not exceed 2048 pixels.")

    face_bounds = _detect_face_bounds(source)
    restored = _inpaint_face_region(source, face_bounds)

    return CharacterFaceRemovalResult(
        width=restored.width,
        height=restored.height,
        face_removed_png_base64=_image_to_base64_png(restored),
    )


def _remove_background_to_square(
    image_bytes: bytes,
    canvas_size: int,
    quality_mode: QualityMode,
) -> Image.Image:
    if not image_bytes:
        raise ImagePreprocessingError("Image file is empty.")

    source = _load_image(image_bytes)
    cutout = _remove_background(source, quality_mode)
    cutout = _clean_alpha(cutout, crisp=quality_mode == "quality")
    return _fit_to_square_canvas(cutout, canvas_size)


def _load_image(image_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image)
        return image.convert("RGBA")
    except (UnidentifiedImageError, OSError) as exc:
        raise ImagePreprocessingError("Invalid image file.") from exc


def _remove_background(image: Image.Image, quality_mode: QualityMode) -> Image.Image:
    model_name = _background_removal_model(quality_mode)
    session = _background_removal_session(model_name)

    if quality_mode == "quality":
        coarse = _run_background_removal(
            image=image,
            session=session,
            alpha_matting=False,
        )
        image = _focus_source_on_foreground(image, coarse)

    return _run_background_removal(
        image=image,
        session=session,
        alpha_matting=model_name != "bria-rmbg",
    )


def _run_background_removal(
    image: Image.Image,
    session: Any,
    alpha_matting: bool,
) -> Image.Image:
    try:
        from rembg import remove
    except ImportError as exc:
        raise ImagePreprocessingUnavailable(
            "Image preprocessing dependencies are not installed. Run `pip install -r requirements.txt`."
        ) from exc

    try:
        output = remove(
            image,
            session=session,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
            post_process_mask=True,
        )
    except TypeError:
        output = remove(image, session=session)

    return _coerce_to_rgba(output)


def _focus_source_on_foreground(
    source: Image.Image,
    coarse_cutout: Image.Image,
) -> Image.Image:
    alpha = coarse_cutout.getchannel("A").point(lambda value: 255 if value >= 32 else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        return source

    left, top, right, bottom = bbox
    margin = round(max(right - left, bottom - top) * 0.10)
    focused_box = (
        max(0, left - margin),
        max(0, top - margin),
        min(source.width, right + margin),
        min(source.height, bottom + margin),
    )
    return source.crop(focused_box)


def _background_removal_model(quality_mode: QualityMode) -> str:
    if quality_mode == "fast":
        return FAST_BACKGROUND_REMOVAL_MODEL
    if quality_mode == "quality":
        return os.getenv("BACKGROUND_REMOVAL_MODEL", QUALITY_BACKGROUND_REMOVAL_MODEL)
    raise ImagePreprocessingError("Quality mode must be either 'fast' or 'quality'.")


def _coerce_to_rgba(output: Any) -> Image.Image:
    if isinstance(output, Image.Image):
        return output.convert("RGBA")
    if isinstance(output, bytes):
        return Image.open(BytesIO(output)).convert("RGBA")
    try:
        return Image.fromarray(output).convert("RGBA")
    except Exception as exc:
        raise ImagePreprocessingError("Background removal produced an unsupported image format.") from exc


def _clean_alpha(image: Image.Image, crisp: bool) -> Image.Image:
    red, green, blue, alpha = image.convert("RGBA").split()
    alpha = alpha.filter(ImageFilter.MedianFilter(size=3))

    if crisp:
        # Tighten uncertain matte pixels while retaining a short antialiased edge.
        background_cutoff = 40
        foreground_cutoff = 215
        alpha_range = foreground_cutoff - background_cutoff
        lut: list[int] = []
        for value in range(256):
            if value <= background_cutoff:
                lut.append(0)
            elif value >= foreground_cutoff:
                lut.append(255)
            else:
                normalized = (value - background_cutoff) / alpha_range
                smooth = normalized * normalized * (3 - 2 * normalized)
                lut.append(round(255 * (smooth**1.15)))
        alpha = alpha.point(lut)

    return Image.merge("RGBA", (red, green, blue, alpha))


def _fit_to_square_canvas(image: Image.Image, canvas_size: int) -> Image.Image:
    if canvas_size < 512 or canvas_size > 1536:
        raise ImagePreprocessingError("Canvas size must be between 512 and 1536 pixels.")

    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ImagePreprocessingError("Could not separate the plant from the background.")

    cropped = image.crop(bbox)
    max_foreground_size = int(canvas_size * 0.86)
    scale = min(max_foreground_size / cropped.width, max_foreground_size / cropped.height)
    resized_size = (
        max(1, int(cropped.width * scale)),
        max(1, int(cropped.height * scale)),
    )
    resized = cropped.resize(resized_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 0))
    x = (canvas_size - resized.width) // 2
    y = (canvas_size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def _with_white_background(image: Image.Image) -> Image.Image:
    white = Image.new("RGBA", image.size, (255, 255, 255, 255))
    white.alpha_composite(image.convert("RGBA"))
    return white.convert("RGB")


FaceComponent = tuple[int, int, int, int, int, float, float]
FacePair = tuple[FaceComponent, FaceComponent]


def _detect_face_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    rgba = np.asarray(image, dtype=np.uint8)
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]

    dark_mask = ((np.max(rgb, axis=2) < 80) & (alpha >= 128)).astype(np.uint8)
    dark_mask[: round(image.height * 0.52), :] = 0
    eye_pair = _best_feature_pair(
        _eye_components(dark_mask, image.width, image.height),
        image.width,
        image.height,
        kind="eye",
    )
    if eye_pair is not None:
        return _face_bounds_from_eyes(eye_pair, image.size)

    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    blush_mask = (
        (red >= 140)
        & (red - green >= 30)
        & (red - blue >= 20)
        & (green <= 205)
        & (alpha >= 128)
    ).astype(np.uint8)
    blush_mask[: round(image.height * 0.52), :] = 0
    cheek_pair = _best_feature_pair(
        _cheek_components(blush_mask, image.width, image.height),
        image.width,
        image.height,
        kind="cheek",
    )
    if cheek_pair is not None:
        return _face_bounds_from_cheeks(cheek_pair, image.size)

    raise ImagePreprocessingError("Could not locate the character face.")


def _eye_components(mask: np.ndarray, width: int, height: int) -> list[FaceComponent]:
    components = _connected_components(mask)
    minimum_area = max(12, round(width * height * 0.00004))
    return [
        component
        for component in components
        if width * 0.12 < component[5] < width * 0.88
        and height * 0.52 < component[6] < height * 0.95
        and width * 0.004 <= component[2] <= width * 0.065
        and height * 0.018 <= component[3] <= height * 0.13
        and component[3] / component[2] >= 1.15
        and component[4] >= minimum_area
    ]


def _cheek_components(mask: np.ndarray, width: int, height: int) -> list[FaceComponent]:
    components = _connected_components(mask)
    minimum_area = max(10, round(width * height * 0.000025))
    return [
        component
        for component in components
        if width * 0.10 < component[5] < width * 0.90
        and height * 0.52 < component[6] < height * 0.96
        and width * 0.004 <= component[2] <= width * 0.09
        and height * 0.004 <= component[3] <= height * 0.06
        and 0.4 <= component[2] / component[3] <= 5
        and component[4] >= minimum_area
    ]


def _connected_components(mask: np.ndarray) -> list[FaceComponent]:
    count, _, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    return [
        (
            int(stats[index, cv2.CC_STAT_LEFT]),
            int(stats[index, cv2.CC_STAT_TOP]),
            int(stats[index, cv2.CC_STAT_WIDTH]),
            int(stats[index, cv2.CC_STAT_HEIGHT]),
            int(stats[index, cv2.CC_STAT_AREA]),
            float(centroids[index, 0]),
            float(centroids[index, 1]),
        )
        for index in range(1, count)
    ]


def _best_feature_pair(
    components: list[FaceComponent],
    width: int,
    height: int,
    kind: Literal["eye", "cheek"],
) -> FacePair | None:
    best: tuple[float, FaceComponent, FaceComponent] | None = None
    for first_index, first in enumerate(components):
        for second in components[first_index + 1 :]:
            left, right = sorted((first, second), key=lambda component: component[5])
            separation = right[5] - left[5]

            if kind == "eye":
                scale = (left[3] + right[3]) / 2
                if not 1.3 * scale <= separation <= 5 * scale:
                    continue
                score = (
                    abs(left[6] - right[6]) / scale * 4
                    + abs(left[3] - right[3]) / scale * 2
                    + abs(left[2] - right[2]) / max(left[2], right[2])
                    + abs((left[5] + right[5]) / 2 - width / 2) / width * 5
                    - (left[4] + right[4]) / (width * height * 0.003)
                )
            else:
                if not width * 0.05 <= separation <= width * 0.4:
                    continue
                scale = max((left[3] + right[3]) / 2, 1)
                if abs(left[6] - right[6]) > max(left[3], right[3]) * 1.5:
                    continue
                score = (
                    abs(left[6] - right[6]) / scale * 5
                    + abs(left[4] - right[4]) / max(left[4], right[4])
                    + abs((left[5] + right[5]) / 2 - width / 2) / width * 5
                    - (left[4] + right[4]) / (width * height * 0.001)
                )

            if best is None or score < best[0]:
                best = score, left, right

    if best is None:
        return None
    return best[1], best[2]


def _face_bounds_from_eyes(pair: FacePair, size: tuple[int, int]) -> tuple[int, int, int, int]:
    left, right = pair
    eye_height = (left[3] + right[3]) / 2
    eye_top = (left[1] + right[1]) / 2
    return _clamp_bounds(
        (
            round(left[5] - eye_height * 0.9),
            round(eye_top - eye_height * 0.2),
            round(right[5] + eye_height * 0.9),
            round(eye_top + eye_height * 1.95),
        ),
        size,
    )


def _face_bounds_from_cheeks(pair: FacePair, size: tuple[int, int]) -> tuple[int, int, int, int]:
    left, right = pair
    separation = right[5] - left[5]
    center_y = (left[6] + right[6]) / 2
    return _clamp_bounds(
        (
            round(left[5] - separation * 0.18),
            round(center_y - separation * 0.65),
            round(right[5] + separation * 0.18),
            round(center_y + separation * 0.32),
        ),
        size,
    )


def _clamp_bounds(
    bounds: tuple[int, int, int, int],
    size: tuple[int, int],
) -> tuple[int, int, int, int]:
    left, top, right, bottom = bounds
    width, height = size
    return max(0, left), max(0, top), min(width - 1, right), min(height - 1, bottom)


def _inpaint_face_region(
    image: Image.Image,
    bounds: tuple[int, int, int, int],
) -> Image.Image:
    rgba = np.asarray(image, dtype=np.uint8)
    mask = np.zeros((image.height, image.width), dtype=np.uint8)
    left, top, right, bottom = bounds
    cv2.rectangle(mask, (left, top), (right, bottom), 255, thickness=-1)

    radius = max(3, round(min(image.size) / 256))
    restored_rgb = cv2.inpaint(rgba[:, :, :3], mask, radius, cv2.INPAINT_TELEA)
    restored_rgba = np.dstack((restored_rgb, rgba[:, :, 3]))
    return Image.fromarray(restored_rgba, mode="RGBA")


def _image_to_base64_png(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")
