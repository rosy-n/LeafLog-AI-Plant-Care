from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
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
    # 외부 소스 매칭 키 — 저자명/변종표기 제거 + 소문자 (예: 'monstera deliciosa')
    scientific_name_norm: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    family_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    genus_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # origin(자생지) / origin_country(원산지) / distribution(분포) — nature.go.kr 기준으로 분리
    origin: Mapped[str | None] = mapped_column(String(255), nullable=True)
    origin_country: Mapped[str | None] = mapped_column(String(255), nullable=True)
    distribution: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    difficulty: Mapped[str] = mapped_column(String(30), default="UNKNOWN")
    # 요구 광량 — LOW(음지) / MEDIUM(반양지·반음지) / HIGH(양지)
    light_level: Mapped[str] = mapped_column(String(30), default="UNKNOWN")
    light_min_lux: Mapped[int | None] = mapped_column(Integer, nullable=True)
    light_max_lux: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 생육 적정 온도
    temp_min_c: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    temp_max_c: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    # 겨울 최저온도 — 생육 적정 하한과 다른 값
    temp_min_winter_c: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    humidity_min_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    humidity_max_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    watering_interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    flowering_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 결실기
    fruiting_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 꽃 색상 코드 목록 — PostgreSQL 은 스키마 정의대로 TEXT[], SQLite 는 JSON 배열
    flower_color_codes: Mapped[list | None] = mapped_column(
        JSON().with_variant(ARRAY(Text()), "postgresql"), nullable=True
    )

    # 크기 — 원문 문자열 보존 + 파싱값 병행
    size_raw: Mapped[str | None] = mapped_column(String(200), nullable=True)
    height_min_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height_max_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # is_toxic 은 아래 셋 중 하나라도 true 면 true (파생값). None = 자료 없음
    is_toxic: Mapped[bool] = mapped_column(Boolean, default=False)
    toxic_to_dogs: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    toxic_to_cats: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    toxic_to_horses: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
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

    # persona-chat 캐릭터 성격 — 선택 전에는 NULL (persona_chat.PERSONA_SLUG_TO_FILE 키와 일치)
    persona: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # 애정도 — 돌봄 상호작용(물주기/영양제/분갈이)마다 점수를 더해 쌓는다.
    # 하트/단계 환산은 app/affinity.py 가 이 숫자를 나눠서 계산한다 (상한 = affinity.MAX_SCORE).
    affinity_score: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    # 캐릭터를 문질러 애정도를 받은 마지막 날짜(한국 기준) — 하루 1회 제한 판정용.
    # 문지르기는 돌봄 기록이 아니라서 care_record 를 남기지 않는다.
    last_petted_on: Mapped[date | None] = mapped_column(Date, nullable=True)

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
        CheckConstraint(
            "persona IN ('SUNSHINE', 'CHIC', 'RELAXED', 'TIMID', 'SAGE', 'PLAYFUL', 'DILIGENT', 'DREAMER')",
            name="ck_plant_persona",
        ),
        CheckConstraint("affinity_score >= 0", name="ck_plant_affinity_score"),
    )


class CareSchedule(Base):
    __tablename__ = "care_schedule"

    schedule_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plant.plant_id", ondelete="CASCADE"), nullable=False, index=True
    )
    care_type: Mapped[str] = mapped_column(String(30), nullable=False)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False)
    # 주기 출처 — SPECIES(종 권장값) / DEFAULT(자료 없어 기본값) / USER(사용자 설정).
    # USER 는 다른 값으로 덮지 않는다.
    interval_source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEFAULT")
    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "care_type IN ('WATERING', 'FERTILIZING', 'REPOTTING')",
            name="ck_care_schedule_care_type",
        ),
        CheckConstraint("interval_days > 0", name="ck_care_schedule_interval_days"),
        CheckConstraint(
            "interval_source IN ('SPECIES', 'DEFAULT', 'USER')",
            name="ck_care_schedule_interval_source",
        ),
        UniqueConstraint("plant_id", "care_type", name="uq_care_schedule_plant_care"),
        UniqueConstraint(
            "schedule_id", "plant_id", "care_type", name="uq_care_schedule_id_plant_care"
        ),
    )


class CareRecord(Base):
    __tablename__ = "care_record"

    care_record_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plant.plant_id", ondelete="CASCADE"), nullable=False, index=True
    )
    schedule_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    care_type: Mapped[str] = mapped_column(String(30), nullable=False)

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    asset_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_asset.asset_id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "care_type IN ('WATERING', 'FERTILIZING', 'REPOTTING')",
            name="ck_care_record_care_type",
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


# =========================================================
# AI 대화 (docs/database-schema.sql "4. AI 대화")
# =========================================================


class ChatSession(Base):
    __tablename__ = "chat_session"

    session_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    plant_id: Mapped[int | None] = mapped_column(
        ForeignKey("plant.plant_id", ondelete="SET NULL"), nullable=True
    )

    session_type: Mapped[str] = mapped_column(String(30), default="PERSONA")
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint(
            "session_type IN ('PERSONA', 'CONSULTATION', 'DIAGNOSIS')",
            name="ck_chat_session_type",
        ),
    )


class ChatMessage(Base):
    __tablename__ = "chat_message"

    message_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_session.session_id", ondelete="CASCADE"), nullable=False, index=True
    )

    # USER: 앱 사용자가 보낸 메시지, ASSISTANT: AI가 답변한 메시지
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 사진과 함께 보낸 메시지(진단 상담)만 값이 있다. care_record.asset_id와 같은 패턴.
    asset_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_asset.asset_id", ondelete="SET NULL"), nullable=True
    )
    # ASSISTANT 메시지가 RAG 검색으로 근거 삼은 유사 사례 스냅샷 (schemas.DiagnosisSimilarCase 형태의
    # dict 리스트). 응답 시점에 만든 값을 그대로 굳혀서, 과거 상담을 다시 열어도 그때 근거를 보여줄 수 있다.
    rag_context: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        CheckConstraint("role IN ('USER', 'ASSISTANT')", name="ck_chat_message_role"),
    )


# =========================================================
# 종 정보 외부 데이터 소스 (docs/database-schema.sql 2-3)
# 적재 배치 전용 — 런타임 API 는 plant_species 만 조회한다
# =========================================================

SOURCE_CODES = ("KFS_STD", "RDA_INDOOR", "ASPCA", "NATURE_KNA")


class DataSource(Base):
    __tablename__ = "data_source"

    source_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    source_name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    license_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 낮을수록 우선 (분류 정보 병합 시 tie-break)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        CheckConstraint(
            "source_code IN ('KFS_STD', 'RDA_INDOOR', 'ASPCA', 'NATURE_KNA')",
            name="ck_data_source_code",
        ),
    )


class IngestRun(Base):
    __tablename__ = "ingest_run"

    run_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source_code: Mapped[str] = mapped_column(
        ForeignKey("data_source.source_code"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="RUNNING")
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('RUNNING', 'SUCCESS', 'FAILED')",
            name="ck_ingest_run_status",
        ),
    )


class SpeciesSourceLink(Base):
    """정본(plant_species) ↔ 소스 레코드 연결. 재적재 시 UPSERT 기준.

    이 테이블에 연결이 하나도 없는 plant_species 행 = 사용자 등록 유래(마스터 미수록) 종.
    """

    __tablename__ = "species_source_link"

    link_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    species_id: Mapped[int] = mapped_column(
        ForeignKey("plant_species.species_id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_code: Mapped[str] = mapped_column(
        ForeignKey("data_source.source_code"), nullable=False
    )
    source_key: Mapped[str] = mapped_column(String(200), nullable=False)
    match_method: Mapped[str] = mapped_column(String(30), nullable=False)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(3, 2), nullable=True)
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        # 소스 1건이 여러 종에 걸릴 수 있다 (ASPCA 의 종 단위 독성 → 품종별 행)
        UniqueConstraint(
            "source_code", "source_key", "species_id", name="uq_species_source_link_src"
        ),
        CheckConstraint(
            "match_method IN ('SCI_NAME', 'KO_NAME', 'MANUAL')",
            name="ck_species_source_link_match_method",
        ),
    )


class SrcKfsSpecies(Base):
    """산림청 표준식물종정보 — 크기, 개화기, 결실기 (+ 과국명)."""

    __tablename__ = "src_kfs_species"

    source_key: Mapped[str] = mapped_column(String(200), primary_key=True)
    ko_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sci_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sci_name_norm: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    # 과국명 — NATURE_KNA 미연동 상태에서 과 정보의 유일한 소스
    family_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    size_raw: Mapped[str | None] = mapped_column(String(200), nullable=True)
    flowering_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fruiting_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 원본 행 전체 보존 — 매핑 누락분을 재적재 없이 복구하기 위함 (PG: JSONB)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    ingest_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingest_run.run_id", ondelete="SET NULL"), nullable=True
    )
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SrcRdaIndoor(Base):
    """농촌진흥청 실내정원용 식물 — 코드값 원본 그대로. 코드→값 변환은 병합 단계에서."""

    __tablename__ = "src_rda_indoor"

    # cntntsNo
    source_key: Mapped[str] = mapped_column(String(200), primary_key=True)
    ko_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sci_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sci_name_norm: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    light_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    water_cycle_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    winter_temp_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    growth_temp_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    humidity_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    manage_level_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    toxic_desc: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    ingest_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingest_run.run_id", ondelete="SET NULL"), nullable=True
    )
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SrcAspcaToxicity(Base):
    """ASPCA 독성 목록 — 동물별 독성 여부. None = 해당 동물 자료 없음."""

    __tablename__ = "src_aspca_toxicity"

    # 학명 원문
    source_key: Mapped[str] = mapped_column(String(200), primary_key=True)
    common_name_en: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sci_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sci_name_norm: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    toxic_to_dogs: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    toxic_to_cats: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    toxic_to_horses: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    clinical_signs: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    ingest_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingest_run.run_id", ondelete="SET NULL"), nullable=True
    )
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SrcNatureTaxon(Base):
    """국가생물종지식정보시스템 — 분류/이름의 정본 소스.

    다운로드 파일 3종(자생/외래/재배)을 한 테이블에 모은다. ID 컬럼이 없어
    source_key 는 '<그룹>:<학명>|<국명>' 복합키.
    native_habitat/origin_country/distribution 은 파일에 컬럼이 없어 비어 있다.
    """

    __tablename__ = "src_nature_taxon"

    source_key: Mapped[str] = mapped_column(String(200), primary_key=True)
    ko_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    en_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sci_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sci_name_norm: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    family_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    genus_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 자생 / 외래 / 재배 — 재배식물이 실내 관엽식물 커버리지의 핵심
    plant_group: Mapped[str | None] = mapped_column(String(20), nullable=True)
    native_habitat: Mapped[str | None] = mapped_column(String(255), nullable=True)
    origin_country: Mapped[str | None] = mapped_column(String(255), nullable=True)
    distribution: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    ingest_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingest_run.run_id", ondelete="SET NULL"), nullable=True
    )
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        CheckConstraint(
            "plant_group IN ('NATIVE', 'ALIEN', 'CULTIVATED')",
            name="ck_src_nature_taxon_plant_group",
        ),
    )


class SpeciesMatchReview(Base):
    """학명 매칭 실패 → 사람이 확인할 큐."""

    __tablename__ = "species_match_review"

    review_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source_code: Mapped[str] = mapped_column(
        ForeignKey("data_source.source_code"), nullable=False
    )
    source_key: Mapped[str] = mapped_column(String(200), nullable=False)
    raw_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # 후보 목록 [{species_id, name, score}, ...]
    candidates: Mapped[list | None] = mapped_column(JSON, nullable=True)
    resolved_species_id: Mapped[int | None] = mapped_column(
        ForeignKey("plant_species.species_id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint("source_code", "source_key", name="uq_species_match_review_src"),
    )


class Item(Base):
    """꾸미기 아이템 마스터 — 액세서리(개체 착용)와 홈 배경.

    해금 여부는 저장하지 않는다. affinity.level_for_score(plant.affinity_score) 가
    required_level 이상이면 해금이다 (DDL: apps/api/scripts/add-item-tables.sql).
    """

    __tablename__ = "item"

    item_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # 앱 번들 이미지 맵(apps/mobile/src/data/decor.js)의 키 —
    # 아래 asset 이 비었거나 URL이 만료됐을 때 앱이 이 키로 fallback 한다
    item_key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    item_name: Mapped[str] = mapped_column(String(100), nullable=False)
    item_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # 목록 카드 이미지 (액세서리 아이콘 / 배경 미리보기)
    asset_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_asset.asset_id", ondelete="SET NULL"), nullable=True
    )
    # 그 액세서리를 착용한 캐릭터 이미지. 배경은 NULL
    sprite_asset_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_asset.asset_id", ondelete="SET NULL"), nullable=True
    )
    # 해금에 필요한 꽉 찬 하트 수 (0 = 기본 제공, 상한은 affinity.MAX_HEARTS)
    required_level: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        CheckConstraint("item_type IN ('BACKGROUND', 'ACCESSORY')", name="ck_item_type"),
        CheckConstraint("required_level BETWEEN 0 AND 5", name="ck_item_required_level"),
    )


class PlantDecoration(Base):
    """개체에 지금 적용된 꾸미기 — position_key 당 한 개.

    'HEAD' = 착용 중인 액세서리, 'BACKGROUND' = 개체탭 배경.
    배경도 액세서리와 똑같이 개체마다 적용되고 그 개체의 애정도로 해금된다.
    """

    __tablename__ = "plant_decoration"

    decoration_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plant.plant_id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("item.item_id", ondelete="CASCADE"), nullable=False
    )
    # 현재 UI는 슬롯이 하나뿐이라 'HEAD' 만 쓴다
    position_key: Mapped[str] = mapped_column(String(50), nullable=False)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint("plant_id", "position_key", name="uq_plant_decoration_position"),
    )


class UserSetting(Base):
    __tablename__ = "user_setting"

    # docs/database-schema.sql의 user_setting 전체 컬럼 중 날씨/대기질 기능
    # 범위(default_location)만 구현한다. push_enabled 등 알림 관련 컬럼은 제외.
    # 배경은 개체별이라 여기가 아니라 plant_decoration 에 있다.
    setting_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    # "서울특별시 마포구" 형태 — region_data.Region.name과 정확히 일치해야 한다.
    default_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class WeatherLog(Base):
    __tablename__ = "weather_log"

    weather_log_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False
    )
    # 날씨는 유저/위치 단위지 식물 단위가 아니라 이번 기능에서는 항상 NULL —
    # Plant.location_name(실내 위치 enum)과는 별개 개념이다.
    plant_id: Mapped[int | None] = mapped_column(
        ForeignKey("plant.plant_id", ondelete="SET NULL"), nullable=True
    )

    location_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    temperature_c: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    humidity_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    pm10: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    pm25: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)

    weather_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    air_quality_status: Mapped[str | None] = mapped_column(String(50), nullable=True)

    source_api: Mapped[str | None] = mapped_column(String(50), nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


# =========================================================
# 고객 문의 (docs/database-schema.sql "8. 고객 문의")
# =========================================================


class Inquiry(Base):
    __tablename__ = "inquiry"

    inquiry_id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 앱에서 5~2000자로 제한한다 (schemas.InquiryCreate)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # 운영자가 처리 여부를 표시하는 용도 — 지금은 DB에서 직접 바꾼다
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="OPEN", server_default="OPEN"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    __table_args__ = (
        CheckConstraint("status IN ('OPEN', 'CLOSED')", name="ck_inquiry_status"),
    )

