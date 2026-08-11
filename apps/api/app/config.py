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
    # 종 마스터 적재(scripts/ingest) 전용 외부 API 키 — 앱의 EXPO_PUBLIC_* 과 분리해 관리
    # 농사로 OpenAPI (농촌진흥청_실내정원용 식물)
    nongsaro_api_key: str = os.getenv("NONGSARO_API_KEY", "")
    # 국립수목원 오픈API (국가생물종지식정보시스템) — 미발급 상태면 빈 값
    nature_kna_api_key: str = os.getenv("NATURE_KNA_API_KEY", "")
    # 공공데이터포털 — 기상청 단기예보 조회서비스 / 에어코리아 대기오염정보 조회서비스
    # (디코딩된 서비스키를 그대로 넣는다 — requests가 쿼리스트링 인코딩을 알아서 처리)
    kma_api_key: str = os.getenv("KMA_API_KEY", "")
    airkorea_api_key: str = os.getenv("AIRKOREA_API_KEY", "")


settings = Settings()
