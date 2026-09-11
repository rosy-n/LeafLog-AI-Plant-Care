"""아이폰 원본 사진(HEIC/HEIF) 지원.

앱은 고른 사진을 변환 없이 올려서 HEIC가 그대로 들어올 수 있다. Ollama·학교 worker·다른
기기의 이미지 뷰어는 HEIC를 못 읽으므로, API가 받자마자 JPEG로 바꿔 이후 경로는 기존 형식만 다룬다.
"""
from __future__ import annotations

import io

from PIL import Image, ImageOps

try:  # pillow-heif가 없으면 HEIC만 못 읽고 나머지는 그대로 동작한다
    from pillow_heif import register_heif_opener
except ImportError:  # pragma: no cover - 설치 누락 대비
    HEIF_SUPPORTED = False
else:
    register_heif_opener()
    HEIF_SUPPORTED = True

JPEG_QUALITY = 92


def heif_to_jpeg(data: bytes) -> tuple[bytes, bool]:
    """HEIC/HEIF면 (JPEG 바이트, True), 아니면 (원본, False).

    읽을 수 없는 데이터는 원본을 그대로 돌려준다 — 형식 검증과 오류 안내는 호출부 몫이다.
    """
    try:
        with Image.open(io.BytesIO(data)) as opened:
            if opened.format != "HEIF":
                return data, False
            image = ImageOps.exif_transpose(opened).convert("RGB")
    except (OSError, ValueError, Image.DecompressionBombError):
        return data, False
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    return buffer.getvalue(), True
