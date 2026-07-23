from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from typing import Any, Literal

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


@lru_cache(maxsize=2)
def _background_removal_session(model_name: str) -> Any:
    try:
        from rembg import new_session
    except ImportError as exc:
        raise ImagePreprocessingUnavailable(
            "Image preprocessing dependencies are not installed. Run `pip install -r requirements.txt`."
        ) from exc

    return new_session(model_name)


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


def _image_to_base64_png(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")
