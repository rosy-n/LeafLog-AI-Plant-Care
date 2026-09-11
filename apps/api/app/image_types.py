from typing import Literal

QualityMode = Literal["fast", "quality"]


class ImagePreprocessingError(ValueError):
    pass


class ImagePreprocessingUnavailable(RuntimeError):
    pass
