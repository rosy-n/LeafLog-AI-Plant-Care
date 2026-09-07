from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

CharacterJobStatus = Literal[
    "queued", "preprocessing", "starting_gpu", "generating", "postprocessing", "completed", "failed"
]


@dataclass(frozen=True)
class CharacterCandidate:
    id: str
    image_url: str
    checksum: str
    seed: int
    face_bounds: tuple[int, int, int, int] | None = None


@dataclass
class CharacterGenerationJob:
    id: str
    user_id: int
    status: CharacterJobStatus = "queued"
    progress: int = 0
    message: str = "생성 작업을 기다리고 있어요."
    current_candidate: int = 0
    candidate_count: int = 3
    candidates: list[CharacterCandidate] = field(default_factory=list)
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
