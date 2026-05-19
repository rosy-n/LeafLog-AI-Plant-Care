import os
from dataclasses import dataclass


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


settings = Settings()
