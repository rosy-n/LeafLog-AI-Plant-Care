import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# apps/api/.env 로드 — 실행 위치와 무관하게 config.py 기준으로 탐색
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./leaflog.db")
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@dataclass(frozen=True)
class Settings:
    database_url: str = _database_url()
    secret_key: str = os.getenv("SECRET_KEY", "dev-only-change-this-secret")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:19006,http://localhost:8081,http://localhost:3000",
        ).split(",")
        if origin.strip()
    )
    # S3 — media_asset object_key로 presigned GET URL 생성용
    # 자격증명은 boto3 기본 체인(환경변수 / ~/.aws / IAM 역할)에서 자동 로드
    s3_bucket: str = os.getenv("S3_BUCKET", "")
    s3_region: str = os.getenv("S3_REGION", os.getenv("AWS_REGION", "ap-northeast-2"))
    s3_presign_expire: int = int(os.getenv("S3_PRESIGN_EXPIRE_SECONDS", "3600"))
    # 백엔드가 object_key로 직접 presign할지 여부.
    # 버킷에 GetObject 가능한 자격증명이 있을 때만 true (실서비스/배포 환경).
    # false면 저장된 file_url을 그대로 반환 (예: 콘솔에서 만든 presigned URL로 로컬 테스트).
    s3_presign_enabled: bool = os.getenv("S3_PRESIGN", "false").strip().lower() in ("1", "true", "yes", "on")
    # 문의하기 메일 발송 (설정 화면 → 지원 메일함)
    # 비어 있으면 문의 API 가 503 을 돌려준다 — 접수된 것처럼 보이고 사라지면 안 된다
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    # STARTTLS(587) 이 기본. 465(SMTPS)를 쓰면 false 로 두고 SMTP_SSL 을 켠다
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "true").strip().lower() in ("1", "true", "yes", "on")
    smtp_use_ssl: bool = os.getenv("SMTP_USE_SSL", "false").strip().lower() in ("1", "true", "yes", "on")
    # 보내는 주소. 비우면 smtp_user 를 쓴다 (대부분의 제공자가 계정 주소만 허용한다)
    smtp_from: str = os.getenv("SMTP_FROM", "")
    # 문의를 받을 주소
    support_email: str = os.getenv("SUPPORT_EMAIL", "")

    # 종 마스터 적재(scripts/ingest) 전용 외부 API 키 — 앱의 EXPO_PUBLIC_* 과 분리해 관리
    # 농사로 OpenAPI (농촌진흥청_실내정원용 식물)
    nongsaro_api_key: str = os.getenv("NONGSARO_API_KEY", "")
    # 국립수목원 오픈API (국가생물종지식정보시스템) — 미발급 상태면 빈 값
    nature_kna_api_key: str = os.getenv("NATURE_KNA_API_KEY", "")
    # 공공데이터포털 — 기상청 단기예보 조회서비스 / 에어코리아 대기오염정보 조회서비스
    # (디코딩된 서비스키를 그대로 넣는다 — requests가 쿼리스트링 인코딩을 알아서 처리)
    kma_api_key: str = os.getenv("KMA_API_KEY", "")
    airkorea_api_key: str = os.getenv("AIRKOREA_API_KEY", "")
    # 병해충 상담 Visual RAG (ai/diagnosis/) — 로컬 Docker 기본값. RunPod 등 원격 전환 시 URL/API 키로 교체
    qdrant_url: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key: str = os.getenv("QDRANT_API_KEY", "")
    qdrant_collection: str = os.getenv("QDRANT_COLLECTION", "leaflog-diagnosis")

    # SDXL 캐릭터 생성. FastAPI와 Forge가 같은 학교 WSL에서 실행되면 기본 URL을 그대로 쓴다.
    forge_api_url: str = os.getenv("FORGE_API_URL", "http://127.0.0.1:7860")
    character_output_dir: Path = Path(
        os.getenv(
            "CHARACTER_OUTPUT_DIR",
            str(Path(__file__).resolve().parent.parent / "generated" / "characters"),
        )
    )
    character_public_base_url: str = os.getenv("CHARACTER_PUBLIC_BASE_URL", "").rstrip("/")
    character_gpu_mode_command: str = os.getenv("CHARACTER_GPU_MODE_COMMAND", "")
    character_restore_ollama: bool = os.getenv("CHARACTER_RESTORE_OLLAMA", "true").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    character_mock_generation: bool = os.getenv("CHARACTER_MOCK_GENERATION", "false").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    character_canvas_size: int = int(os.getenv("CHARACTER_CANVAS_SIZE", "1024"))
    character_preprocess_quality: str = os.getenv("CHARACTER_PREPROCESS_QUALITY", "quality")
    character_postprocess_quality: str = os.getenv("CHARACTER_POSTPROCESS_QUALITY", "quality")
    character_forge_startup_timeout_seconds: int = int(
        os.getenv("CHARACTER_FORGE_STARTUP_TIMEOUT_SECONDS", "180")
    )
    character_generation_timeout_seconds: int = int(
        os.getenv("CHARACTER_GENERATION_TIMEOUT_SECONDS", "600")
    )
    character_gpu_switch_timeout_seconds: int = int(
        os.getenv("CHARACTER_GPU_SWITCH_TIMEOUT_SECONDS", "240")
    )
    character_max_jobs: int = int(os.getenv("CHARACTER_MAX_JOBS", "100"))


settings = Settings()
