from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AppUser(Base):
    __tablename__ = "app_user"

    user_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    nickname: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    coin_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    role: Mapped[str] = mapped_column(String(30), default="USER")
    # 계정 상태 — ACTIVE(정상) / INACTIVE(휴면) / DELETED(탈퇴, 소프트 삭제)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint("coin_balance >= 0", name="ck_app_user_coin_balance"),
        CheckConstraint("role IN ('USER', 'ADMIN')", name="ck_app_user_role"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'DELETED')", name="ck_app_user_status"),
    )


class PlantSpecies(Base):
    __tablename__ = "plant_species"

    species_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    common_name_ko: Mapped[str] = mapped_column(String(100), nullable=False)
    common_name_en: Mapped[str | None] = mapped_column(String(100), nullable=True)
    scientific_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    family_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    genus_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    origin: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    difficulty: Mapped[str] = mapped_column(String(30), default="UNKNOWN")
    # 요구 광량 — LOW(음지) / MEDIUM(반양지·반음지) / HIGH(양지)
    light_level: Mapped[str] = mapped_column(String(30), default="UNKNOWN")
    light_min_lux: Mapped[int | None] = mapped_column(Integer, nullable=True)
    light_max_lux: Mapped[int | None] = mapped_column(Integer, nullable=True)

    temp_min_c: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    temp_max_c: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    humidity_min_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    humidity_max_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    watering_interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    flowering_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 꽃 색상 코드 목록 (스키마의 TEXT[] → SQLite 호환 위해 JSON 배열로 저장)
    flower_color_codes: Mapped[list | None] = mapped_column(JSON, nullable=True)

    is_toxic: Mapped[bool] = mapped_column(Boolean, default=False)
    toxicity_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 병충해 정보
    bug_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    care_tips: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 'metadata'는 SQLAlchemy 예약어라 속성명은 extra_metadata, 컬럼명은 metadata 유지
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "difficulty IN ('EASY', 'MEDIUM', 'HARD', 'UNKNOWN')",
            name="ck_plant_species_difficulty",
        ),
        CheckConstraint(
            "light_level IN ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN')",
            name="ck_plant_species_light_level",
        ),
    )


class Plant(Base):
    __tablename__ = "plant"

    plant_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    species_id: Mapped[int | None] = mapped_column(
        ForeignKey("plant_species.species_id", ondelete="SET NULL"), nullable=True
    )

    nickname: Mapped[str] = mapped_column(String(100), nullable=False)
    location_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    light_condition: Mapped[str | None] = mapped_column(String(30), nullable=True)

    pot_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pot_size: Mapped[str | None] = mapped_column(String(100), nullable=True)
    soil_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    height: Mapped[str | None] = mapped_column(String(100), nullable=True)

    status: Mapped[str] = mapped_column(String(30), default="ALIVE")
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    dead_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "location_name IN ('LIVING_ROOM', 'BEDROOM', 'BALCONY', 'KITCHEN', 'OFFICE')",
            name="ck_plant_location_name",
        ),
        CheckConstraint(
            "light_condition IN ('DIRECT', 'BRIGHT', 'INDIRECT', 'LOW')",
            name="ck_plant_light_condition",
        ),
        CheckConstraint(
            "status IN ('ALIVE', 'SICK', 'DEAD')",
            name="ck_plant_status",
        ),
    )


class MediaAsset(Base):
    __tablename__ = "media_asset"

    asset_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="SET NULL"), nullable=True
    )
    plant_id: Mapped[int | None] = mapped_column(
        ForeignKey("plant.plant_id", ondelete="SET NULL"), nullable=True
    )

    # 최상위 저장 공간 이름
    bucket_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 저장소 안의 파일 위치
    object_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # 프로그램이 자동으로 채우는 값 — 파일 형식 및 사이즈
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 파일 무결성 검증용 해시값 (SHA-256 등) — 중복 업로드 감지에 활용
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        CheckConstraint(
            "asset_type IN ("
            "'PLANT_PHOTO', 'GROWTH_DIARY_PHOTO', 'CHARACTER_IMAGE', "
            "'DIAGNOSIS_PHOTO', 'DIAGNOSIS_MASKED', 'ITEM_IMAGE', "
            "'RAG_REFERENCE_IMAGE', 'PROFILE_IMAGE', 'OTHER')",
            name="ck_media_asset_type",
        ),
    )