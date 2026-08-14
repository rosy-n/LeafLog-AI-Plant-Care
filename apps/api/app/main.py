from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from . import affinity, air_quality, asos, environment, persona_chat, region_data, weather
from .config import settings
from .database import Base, engine, get_db
from .image_preprocessing import (
    ImagePreprocessingError,
    ImagePreprocessingUnavailable,
    QualityMode,
    preprocess_plant_photo,
    remove_background_for_sprite,
)
from .models import (
    AppUser,
    CareRecord,
    CareSchedule,
    Item,
    MediaAsset,
    Plant,
    PlantDecoration,
    PlantSpecies,
    SpeciesSourceLink,
    UserSetting,
)
from .schemas import (
    AffinityAward,
    AffinityStatus,
    AvailabilityResponse,
    AirQualityHistoryPoint,
    AuthResponse,
    BackgroundRemovalResponse,
    CareRecordCreate,
    CareRecordCreated,
    CareRecordItem,
    CareSummary,
    CurrentEnvironmentResponse,
    EnvironmentHistoryResponse,
    HomeBackgroundUpdate,
    ItemRead,
    LoginRequest,
    PersonaChatRequest,
    PersonaChatResponse,
    PersonaOption,
    PlantCreate,
    PlantDecorationRead,
    PlantDecorationUpdate,
    PlantDetail,
    PlantImagePreprocessResponse,
    PlantListItem,
    PlantUpdate,
    PlantRead,
    SignupRequest,
    SpeciesDetail,
    SpeciesListItem,
    UserRead,
    UserSettingRead,
    UserSettingUpdate,
    UserUpdate,
    WeatherHistoryPoint,
    WateringScheduleUpdate,
)
from .security import create_access_token, decode_access_token, hash_password, verify_password
from .storage import bucket_from_url, presigned_get_url

app = FastAPI(title="LeafLog API", version="0.1.0")

MAX_IMAGE_UPLOAD_BYTES = 12 * 1024 * 1024
IMAGE_LAB_PATH = Path(__file__).parent / "static" / "image_lab.html"

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# plant CHECK 제약과 일치 — 허용되지 않는 값은 저장 시 NULL 처리해 제약 위반 방지
LOCATION_NAMES = {"LIVING_ROOM", "BEDROOM", "BALCONY", "KITCHEN", "OFFICE"}
LIGHT_CONDITIONS = {"DIRECT", "BRIGHT", "INDIRECT", "LOW"}
CARE_TYPES = {"WATERING", "FERTILIZING", "REPOTTING"}

# 종에 권장 물주기 자료가 없을 때 쓰는 기본값.
# 농사로 값은 3·5·10일에 몰려 있고 중간값이 5일이지만, 그 203종은 실내정원용으로
# 선별된 관엽식물이라 자주 주는 쪽으로 치우쳐 있다. 자료가 없는 종에는 과습을 피하는
# 쪽이 안전해(초보 실패 원인 1위) 하루~이틀 여유를 둔 7일로 잡았다. 주 1회라 기억하기도 쉽다.
DEFAULT_WATERING_INTERVAL_DAYS = 7
PLANT_STATUSES = {"ALIVE", "SICK", "DEAD"}


def _enum_or_none(value: str | None, allowed: set[str]) -> str | None:
    return value if value in allowed else None


def _object_key_from_url(url: str) -> str:
    """업로드된 S3 URL의 경로에서 object_key 추출.
    가상 호스팅 스타일(https://{bucket}.s3.{region}.amazonaws.com/{key}) 및 CDN 도메인 기준 —
    이 경우 URL 경로가 곧 object_key. (path-style: https://s3.../{bucket}/{key} 는 버킷명이 포함되니 주의)
    파일명 규칙은 업로더(클라이언트)가 정하고, 백엔드는 실제 객체 경로를 그대로 기록한다."""
    return unquote(urlparse(url).path).lstrip("/")


def _latest_character_url(plant_id: int, db: Session) -> str | None:
    """개체의 가장 최근 CHARACTER_IMAGE에 대한 presigned URL (실패 시 raw file_url)."""
    row = db.execute(
        select(MediaAsset.object_key, MediaAsset.file_url, MediaAsset.bucket_name)
        .where(MediaAsset.plant_id == plant_id, MediaAsset.asset_type == "CHARACTER_IMAGE")
        .order_by(MediaAsset.created_at.desc())
        .limit(1)
    ).first()
    if row is None:
        return None
    return _asset_url(*row)


def _asset_url(
    object_key: str | None, file_url: str | None, bucket_name: str | None = None
) -> str | None:
    """media_asset 한 건의 표시용 URL — presign 되면 그걸, 아니면 저장된 file_url.

    bucket_name 이 비어 있으면 기본 버킷(S3_BUCKET)의 객체로 본다.
    공개 객체(예: leaflog/item-images/*)는 서명 없이 file_url 이 그대로 나간다.
    """
    if object_key is None and file_url is None:
        return None
    return presigned_get_url(object_key, bucket_name) or file_url


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    # TIMESTAMP(무 tz) 컬럼에 세션 타임존 변환 없이 들어가도록 naive UTC로 통일
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _days_since(moment: datetime | None) -> int | None:
    if moment is None:
        return None
    # 저장·조회 모두 naive UTC 기준 — 캘린더 일수 차이로 "며칠 전" 계산
    aware = moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc).date() - aware.date()).days)


def _species_interval_days(plant: Plant, db: Session) -> int | None:
    """종 마스터의 권장 물주기. 개체 일정을 처음 만들 때의 기본값으로만 쓴다."""
    if not plant.species_id:
        return None
    species = db.get(PlantSpecies, plant.species_id)
    interval = species.watering_interval_days if species else None
    return interval if interval and interval > 0 else None


def _initial_interval(plant: Plant, db: Session) -> tuple[int, str]:
    """새 일정에 넣을 (주기, 출처).

    종 권장값이 있으면 그대로 쓰고, 없으면 앱 기본값을 쓴다.
    권장값이 있는 종은 전체의 1.1%(203/17,665)라 대부분 DEFAULT 로 시작한다.
    """
    interval = _species_interval_days(plant, db)
    if interval:
        return interval, "SPECIES"
    return DEFAULT_WATERING_INTERVAL_DAYS, "DEFAULT"


def _upsert_watering_schedule(
    plant: Plant, db: Session, last_watered: datetime | None = None
) -> CareSchedule | None:
    """물주기 일정을 만들거나 다음 예정일을 밀어준다.

    interval_days 는 종 값을 '복사'해 둔다. 참조가 아니라 복사인 이유:
      - 사용자가 개체별로 주기를 조정할 수 있어야 한다
      - 마스터 재적재로 사용자의 일정이 멋대로 바뀌면 안 된다
    이미 일정이 있으면 interval_days 는 건드리지 않고 next_due_date 만 갱신한다.

    care_schedule 은 WATERING 만 만든다. 비료·분갈이는 일정으로 관리하지 않고,
    비료는 마지막 기록 경과일수(days_since_fertilizing)만 보여주고
    분갈이는 분갈이탭에서 사용자가 기록을 확인하는 방식이다.
    (4개 소스에 권장 주기가 없어 임의 값으로 알림을 보내게 되는 문제도 있다)

    care_schedule 의 CHECK 은 세 유형을 다 허용하지만 의도적으로 좁히지 않았다 —
    나중에 '영양제 2주마다 알림' 같은 요구가 생기면 스키마를 다시 넓히는 비용이 더 크다.
    즉 "만들 수는 있지만 코드가 만들지 않는" 상태가 의도된 것이다.
    """
    schedule = db.scalar(
        select(CareSchedule).where(
            CareSchedule.plant_id == plant.plant_id, CareSchedule.care_type == "WATERING"
        )
    )

    if schedule is None:
        interval, source = _initial_interval(plant, db)
        schedule = CareSchedule(
            plant_id=plant.plant_id,
            care_type="WATERING",
            interval_days=interval,
            interval_source=source,
            next_due_date=(last_watered or datetime.now(timezone.utc)).date()
            + timedelta(days=interval),
        )
        db.add(schedule)
        return schedule

    # 이미 있는 일정은 주기·출처를 건드리지 않고 다음 예정일만 밀어준다
    base = (last_watered or datetime.now(timezone.utc)).date()
    schedule.next_due_date = base + timedelta(days=schedule.interval_days)
    return schedule


def _owned_plant_or_404(plant_id: int, current_user: "AppUser", db: Session) -> Plant:
    plant = db.get(Plant, plant_id)
    if plant is None or plant.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="식물을 찾을 수 없습니다.")
    return plant


# plant_species가 아직 미확인(species_id NULL)인 개체용 대체 문구.
# ai/persona-chat/test_persona.py의 원래 TODO 주석에서 예시로 든 표현을 그대로 사용 —
# 실제 문구는 팀 논의 후 바뀔 수 있다.
UNKNOWN_SPECIES_PLACEHOLDER = "미확인 식물종"


def _persona_plant_context(plant: Plant, current_user: AppUser, db: Session) -> dict[str, str]:
    species = db.get(PlantSpecies, plant.species_id) if plant.species_id else None
    return {
        "plant_name": plant.nickname,
        "species_name": species.common_name_ko if species else UNKNOWN_SPECIES_PLACEHOLDER,
        "user_name": current_user.nickname,
    }


def _persona_watering_schedule(plant_id: int, db: Session) -> persona_chat.WateringSchedule | None:
    schedule = db.scalar(
        select(CareSchedule).where(
            CareSchedule.plant_id == plant_id,
            CareSchedule.care_type == "WATERING",
        )
    )
    if schedule is None:
        return None
    return persona_chat.WateringSchedule(
        interval_days=schedule.interval_days,
        next_due_date=schedule.next_due_date,
    )


def _persona_weather_air_quality(
    current_user: AppUser, db: Session
) -> persona_chat.WeatherAirQuality | None:
    # 외부 API 실패/네트워크 예외는 반드시 잡아서 None을 반환한다 — persona-chat이
    # 날씨 API 장애 때문에 죽으면 안 된다. 프롬프트는 이미 None을 "등록되지 않음"으로
    # 우아하게 처리한다.
    setting = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.user_id))
    if setting is None or setting.default_location is None:
        return None

    region = region_data.find_region(setting.default_location)
    if region is None:
        return None

    try:
        current = environment.get_current_environment(region)
    except RuntimeError:
        return None

    return persona_chat.WeatherAirQuality(
        weather_status=current.weather_status,
        air_quality_status=current.air_quality_status,
    )


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AppUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 토큰이 필요합니다.")

    subject = decode_access_token(authorization.split(" ", 1)[1])
    if subject is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.")

    user = db.get(AppUser, int(subject))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다.")

    return user


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/image-lab")


@app.get("/image-lab", include_in_schema=False)
def image_lab() -> FileResponse:
    return FileResponse(IMAGE_LAB_PATH)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


async def _read_image_upload(file: UploadFile) -> bytes:
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload an image file.")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image file is empty.")
    if len(image_bytes) > MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image file is too large.")
    return image_bytes


def _image_error_response(exc: Exception) -> HTTPException:
    if isinstance(exc, ImagePreprocessingUnavailable):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if isinstance(exc, ImagePreprocessingError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Image preprocessing failed.")


@app.post("/images/preprocess-plant", response_model=PlantImagePreprocessResponse)
async def preprocess_plant_image(
    file: UploadFile = File(...),
    canvas_size: int = Query(default=1024, ge=512, le=1536),
    quality_mode: QualityMode = Query(default="quality"),
) -> PlantImagePreprocessResponse:
    image_bytes = await _read_image_upload(file)

    try:
        result = preprocess_plant_photo(
            image_bytes=image_bytes,
            canvas_size=canvas_size,
            quality_mode=quality_mode,
        )
    except Exception as exc:
        raise _image_error_response(exc) from exc

    return PlantImagePreprocessResponse(
        canvas_size=result.canvas_size,
        sdxl_input_png_base64=result.sdxl_input_png_base64,
        transparent_png_base64=result.transparent_png_base64,
    )


@app.post("/images/remove-background", response_model=BackgroundRemovalResponse)
async def remove_image_background(
    file: UploadFile = File(...),
    canvas_size: int = Query(default=1024, ge=512, le=1536),
    quality_mode: QualityMode = Query(default="quality"),
) -> BackgroundRemovalResponse:
    image_bytes = await _read_image_upload(file)

    try:
        result = remove_background_for_sprite(
            image_bytes=image_bytes,
            canvas_size=canvas_size,
            quality_mode=quality_mode,
        )
    except Exception as exc:
        raise _image_error_response(exc) from exc

    return BackgroundRemovalResponse(
        canvas_size=result.canvas_size,
        transparent_png_base64=result.transparent_png_base64,
    )


@app.get("/auth/check-email", response_model=AvailabilityResponse)
def check_email(
    email: str = Query(min_length=5, max_length=255),
    db: Session = Depends(get_db),
) -> AvailabilityResponse:
    normalized_email = email.strip().lower()
    exists = db.scalar(select(AppUser.user_id).where(AppUser.email == normalized_email))
    return AvailabilityResponse(available=exists is None)


@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    exists = db.scalar(select(AppUser).where(AppUser.email == payload.email))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다.")

    user = AppUser(
        email=payload.email,
        password_hash=hash_password(payload.password),
        nickname=payload.nickname,
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다.") from None

    db.refresh(user)
    return AuthResponse(access_token=create_access_token(str(user.user_id)), user=UserRead.model_validate(user))


@app.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(AppUser).where(AppUser.email == payload.email))
    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
        )

    return AuthResponse(access_token=create_access_token(str(user.user_id)), user=UserRead.model_validate(user))


@app.get("/api/species", response_model=list[SpeciesListItem])
def search_species(
    q: str = Query(..., min_length=1, max_length=100, description="국명/영문명/학명 부분검색"),
    limit: int = Query(20, ge=1, le=50),
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SpeciesListItem]:
    """종 마스터 검색 — 등록 1단계에서 외부 API 대신 이 엔드포인트를 사용한다.

    ilike 부분검색이라 PostgreSQL/SQLite 양쪽에서 동작한다.
    PG 에서는 pg_trgm GIN 인덱스(idx_plant_species_name_*_trgm)가 사용된다.
    """
    keyword = q.strip()
    if not keyword:
        return []

    pattern = f"%{keyword}%"
    # 접두 일치를 부분 일치보다 앞에
    prefix_rank = case((PlantSpecies.common_name_ko.ilike(f"{keyword}%"), 0), else_=1)
    # 돌봄 정보(농진청 실내정원용 식물)가 있는 종을 앞에 —
    # 산림청 표준식물종정보에는 야생 식물이 대량으로 들어와 있어 그것만으로는 목록이 산만해진다
    care_rank = case((PlantSpecies.watering_interval_days.is_(None), 1), else_=0)

    rows = db.scalars(
        select(PlantSpecies)
        .where(
            or_(
                PlantSpecies.common_name_ko.ilike(pattern),
                PlantSpecies.common_name_en.ilike(pattern),
                PlantSpecies.scientific_name.ilike(pattern),
            )
        )
        .order_by(
            prefix_rank,
            care_rank,
            func.length(PlantSpecies.common_name_ko),
            PlantSpecies.species_id,
        )
        .limit(limit)
    ).all()

    return [SpeciesListItem.model_validate(row) for row in rows]


def _to_species_detail(species: PlantSpecies, db: Session) -> SpeciesDetail:
    """plant_species 한 행 → SpeciesDetail. 종 상세와 개체 상세가 같이 쓴다."""
    detail = SpeciesDetail.model_validate(species)

    # 카드별 원문은 metadata 에 들어 있다 (merge 의 from_rda 참고)
    extra = species.extra_metadata or {}
    for field in (
        "water_cycle_label",
        "light_label",
        "fertilizer_info",
        "soil_info",
        "special_manage_info",
        "placement",
        "propagation",
        "growth_rate",
        "flower_color_names",
    ):
        value = extra.get(field)
        if value:
            setattr(detail, field, value)

    # 출처 표기용 — 연결이 없으면 사용자 등록 유래 종이라 빈 목록
    detail.sources = list(
        db.scalars(
            select(SpeciesSourceLink.source_code)
            .where(SpeciesSourceLink.species_id == species.species_id)
            .order_by(SpeciesSourceLink.source_code)
        ).all()
    )
    return detail


@app.get("/api/species/{species_id}", response_model=SpeciesDetail)
def get_species(
    species_id: int,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpeciesDetail:
    """종 상세 — 4개 소스를 배치에서 병합해 둔 결과를 한 행 조회로 반환."""
    species = db.get(PlantSpecies, species_id)
    if species is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="종을 찾을 수 없습니다.")
    return _to_species_detail(species, db)


@app.post("/api/plants", response_model=PlantRead, status_code=status.HTTP_201_CREATED)
def create_plant(
    payload: PlantCreate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlantRead:
    # 1. 종(plant_species) 결정
    #    speciesId 가 오면 마스터 행을 그대로 사용 (GET /api/species 검색 결과)
    #    없으면 학명/국명 get-or-create — PlantNet 이 인식했지만 마스터에 없는 종용 fallback
    species: PlantSpecies | None = None
    if payload.speciesId is not None:
        species = db.get(PlantSpecies, payload.speciesId)
        if species is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="존재하지 않는 speciesId 입니다."
            )
    if species is None and payload.scientificName:
        species = db.scalar(
            select(PlantSpecies).where(PlantSpecies.scientific_name == payload.scientificName)
        )
    if species is None:
        species = db.scalar(
            select(PlantSpecies).where(PlantSpecies.common_name_ko == payload.commonNameKo)
        )
    if species is None:
        species = PlantSpecies(
            common_name_ko=payload.commonNameKo,
            scientific_name=payload.scientificName or None,
            # plant_species에 농사로 cntntsNo 전용 컬럼이 없어 metadata에 보관
            extra_metadata={"cntntsNo": payload.cntntsNo} if payload.cntntsNo else None,
        )
        db.add(species)
        db.flush()

    # 2. 개체(plant) 생성 — user_id는 인증 사용자에서
    plant = Plant(
        user_id=current_user.user_id,
        species_id=species.species_id,
        nickname=payload.nickname,
        location_name=_enum_or_none(payload.location, LOCATION_NAMES),
        light_condition=_enum_or_none(payload.lightLevel, LIGHT_CONDITIONS),
        pot_type=payload.potType or None,
        pot_size=str(payload.potDiameter) if payload.potDiameter else None,
        height=str(payload.plantHeight) if payload.plantHeight else None,
        soil_type=payload.soilNote or None,
    )
    db.add(plant)
    db.flush()

    # 3. 사진(media_asset) — 넘어온 것만 저장
    #    object_key는 클라이언트가 업로드한 실제 S3 URL 경로에서 추출 → 실제 객체와 항상 일치
    #    checksum(내용 해시)은 클라이언트가 계산해 전달하면 컬럼에 저장 (중복 감지/캐시 무효화용)
    if payload.capturedPhotoUri:
        db.add(MediaAsset(
            user_id=current_user.user_id,
            plant_id=plant.plant_id,
            object_key=_object_key_from_url(payload.capturedPhotoUri),
            file_url=payload.capturedPhotoUri,
            bucket_name=bucket_from_url(payload.capturedPhotoUri),
            asset_type="PLANT_PHOTO",
            checksum=payload.photoChecksum or None,
        ))
    if payload.characterImageUrl:
        db.add(MediaAsset(
            user_id=current_user.user_id,
            plant_id=plant.plant_id,
            object_key=_object_key_from_url(payload.characterImageUrl),
            file_url=payload.characterImageUrl,
            bucket_name=bucket_from_url(payload.characterImageUrl),
            asset_type="CHARACTER_IMAGE",
            checksum=payload.characterChecksum or None,
        ))

    # 4. 최초 물주기/분갈이 기록 → care_record (넘어온 날짜만)
    initial_care: list[str] = []
    watered_at = _parse_dt(payload.lastWateredAt)
    if watered_at:
        db.add(CareRecord(plant_id=plant.plant_id, care_type="WATERING", completed_at=watered_at))
        initial_care.append("WATERING")
    repotted_at = _parse_dt(payload.lastRepottedAt)
    if repotted_at:
        db.add(CareRecord(plant_id=plant.plant_id, care_type="REPOTTING", completed_at=repotted_at))
        initial_care.append("REPOTTING")

    # 등록할 때 적은 최초 돌봄도 애정도로 인정 (기록이 곧 상호작용이라 기준을 맞춘다)
    plant.affinity_score = affinity.initial_score(initial_care)

    # 5. 물주기 일정 — 종의 권장 주기를 개체 일정으로 복사.
    #    마지막 물준 날을 알면 그 날 기준, 모르면 등록일 기준으로 다음 예정일을 잡는다.
    _upsert_watering_schedule(plant, db, last_watered=watered_at)

    db.commit()
    db.refresh(plant)

    return PlantRead(
        id=plant.plant_id,
        nickname=plant.nickname,
        common_name_ko=species.common_name_ko,
        created_at=plant.created_at.isoformat(),
    )


@app.get("/api/plants", response_model=list[PlantListItem])
def list_plants(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PlantListItem]:
    rows = db.execute(
        select(Plant, PlantSpecies.common_name_ko)
        .join(PlantSpecies, Plant.species_id == PlantSpecies.species_id, isouter=True)
        .where(Plant.user_id == current_user.user_id)
        .order_by(Plant.created_at.desc())
    ).all()

    # 캐릭터 이미지 URL — 개체별 최신 1건을 한 번의 쿼리로 모아 맵 구성 (N+1 방지)
    plant_ids = [plant.plant_id for plant, _ in rows]
    char_map: dict[int, str] = {}
    if plant_ids:
        char_rows = db.execute(
            select(
                MediaAsset.plant_id,
                MediaAsset.object_key,
                MediaAsset.file_url,
                MediaAsset.bucket_name,
            )
            .where(
                MediaAsset.plant_id.in_(plant_ids),
                MediaAsset.asset_type == "CHARACTER_IMAGE",
            )
            .order_by(MediaAsset.created_at.desc())
        ).all()
        for pid, object_key, file_url, bucket_name in char_rows:
            char_map.setdefault(pid, _asset_url(object_key, file_url, bucket_name))

    # 착용 중인 꾸미기 액세서리 — 개체마다 조회하지 않도록 한 번에 모은다.
    # 이미지가 S3에 없으면 sprite URL 이 None 이고, 앱은 item_key 로 번들 이미지를 쓴다.
    decoration_map: dict[int, tuple[str, str | None]] = {}
    if plant_ids:
        sprite = aliased(MediaAsset)
        for pid, item_key, object_key, file_url, bucket_name in db.execute(
            select(
                PlantDecoration.plant_id,
                Item.item_key,
                sprite.object_key,
                sprite.file_url,
                sprite.bucket_name,
            )
            .join(Item, Item.item_id == PlantDecoration.item_id)
            .join(sprite, sprite.asset_id == Item.sprite_asset_id, isouter=True)
            .where(PlantDecoration.plant_id.in_(plant_ids))
        ).all():
            decoration_map[pid] = (item_key, _asset_url(object_key, file_url, bucket_name))

    # 물주기 일정 — 개체마다 조회하지 않고 두 번의 쿼리로 모은다
    schedule_map: dict[int, CareSchedule] = {}
    last_watered_map: dict[int, datetime] = {}
    if plant_ids:
        for schedule in db.scalars(
            select(CareSchedule).where(
                CareSchedule.plant_id.in_(plant_ids), CareSchedule.care_type == "WATERING"
            )
        ).all():
            schedule_map[schedule.plant_id] = schedule
        for pid, completed_at in db.execute(
            select(CareRecord.plant_id, func.max(CareRecord.completed_at))
            .where(CareRecord.plant_id.in_(plant_ids), CareRecord.care_type == "WATERING")
            .group_by(CareRecord.plant_id)
        ).all():
            last_watered_map[pid] = completed_at

    today = datetime.now(timezone.utc).date()

    def watering_summary(plant: Plant) -> tuple[int | None, date | None]:
        """(주기, 다음 예정일). 일정 행이 없으면 계산만 하고 저장하지 않는다."""
        schedule = schedule_map.get(plant.plant_id)
        if schedule is not None:
            return schedule.interval_days, schedule.next_due_date
        interval, _ = _initial_interval(plant, db)
        base = last_watered_map.get(plant.plant_id) or plant.created_at
        if not interval or base is None:
            return interval, None
        return interval, base.date() + timedelta(days=interval)

    items: list[PlantListItem] = []
    for plant, common_name_ko in rows:
        interval, next_due = watering_summary(plant)
        # 애정도 — 목록의 하트/호감도순 정렬용 (plant 컬럼이라 추가 쿼리가 없다)
        score = plant.affinity_score or 0
        items.append(
            PlantListItem(
                id=plant.plant_id,
                nickname=plant.nickname,
                common_name_ko=common_name_ko,
                location_name=plant.location_name,
                light_condition=plant.light_condition,
                is_favorite=plant.is_favorite,
                status=plant.status,
                character_image_url=char_map.get(plant.plant_id),
                persona=plant.persona,
                created_at=plant.created_at.isoformat(),
                watering_interval_days=interval,
                next_watering_date=next_due.isoformat() if next_due else None,
                days_until_watering=(next_due - today).days if next_due else None,
                affinity_score=score,
                affinity_hearts=affinity.hearts_for_score(score),
                affinity_level=affinity.level_for_score(score),
                decoration_item_key=decoration_map.get(plant.plant_id, (None, None))[0],
                decoration_sprite_url=decoration_map.get(plant.plant_id, (None, None))[1],
            )
        )
    return items


@app.get("/api/plants/{plant_id}", response_model=PlantDetail)
def get_plant(
    plant_id: int,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlantDetail:
    plant = db.get(Plant, plant_id)
    if plant is None or plant.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="식물을 찾을 수 없습니다.")

    return _to_plant_detail(plant, db)


@app.patch("/api/plants/{plant_id}", response_model=PlantDetail)
def update_plant(
    plant_id: int,
    payload: PlantUpdate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlantDetail:
    plant = _owned_plant_or_404(plant_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)

    if "species_id" in data and data["species_id"] is not None:
        new_species = db.get(PlantSpecies, data["species_id"])
        if new_species is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="존재하지 않는 speciesId 입니다."
            )
        plant.species_id = new_species.species_id

        # 물주기 일정: 종이 바뀌면 권장 주기도 바뀐다.
        # 사용자가 직접 설정한 주기(USER)는 덮지 않는다.
        schedule = db.scalar(
            select(CareSchedule).where(
                CareSchedule.plant_id == plant.plant_id, CareSchedule.care_type == "WATERING"
            )
        )
        if schedule is not None and schedule.interval_source != "USER":
            interval, source = _initial_interval(plant, db)
            schedule.interval_days = interval
            schedule.interval_source = source
            last = db.scalar(
                select(CareRecord.completed_at)
                .where(CareRecord.plant_id == plant.plant_id, CareRecord.care_type == "WATERING")
                .order_by(CareRecord.completed_at.desc())
                .limit(1)
            )
            base = (last or datetime.now(timezone.utc)).date()
            schedule.next_due_date = base + timedelta(days=interval)

    if "nickname" in data and data["nickname"] is not None:
        nickname = data["nickname"].strip()
        if not nickname:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이름을 입력해주세요.")
        plant.nickname = nickname
    if "status" in data and data["status"] is not None:
        if data["status"] not in PLANT_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 상태입니다.")
        plant.status = data["status"]
        # 떠나보냄(DEAD) 전환 시 사망 시각 기록, 되살리면 해제
        if data["status"] == "DEAD":
            if plant.dead_at is None:
                plant.dead_at = datetime.now(timezone.utc).replace(tzinfo=None)
        else:
            plant.dead_at = None
    if "location_name" in data:
        plant.location_name = _enum_or_none(data["location_name"], LOCATION_NAMES)
    if "pot_type" in data:
        plant.pot_type = (data["pot_type"] or None)
    if "pot_size" in data:
        plant.pot_size = (data["pot_size"] or None)
    if "height" in data:
        plant.height = (data["height"] or None)
    if "persona" in data and data["persona"] is not None:
        if data["persona"] not in persona_chat.PERSONA_SLUG_TO_FILE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 페르소나입니다.")
        plant.persona = data["persona"]

    db.commit()
    db.refresh(plant)
    return _to_plant_detail(plant, db)


def _to_plant_detail(plant: Plant, db: Session) -> PlantDetail:
    species = db.get(PlantSpecies, plant.species_id) if plant.species_id else None
    return PlantDetail(
        id=plant.plant_id,
        nickname=plant.nickname,
        common_name_ko=species.common_name_ko if species else None,
        scientific_name=species.scientific_name if species else None,
        # 돌보기 정보 화면용 — 종이 없으면 None
        species=_to_species_detail(species, db) if species else None,
        status=plant.status,
        location_name=plant.location_name,
        light_condition=plant.light_condition,
        pot_type=plant.pot_type,
        pot_size=plant.pot_size,
        soil_type=plant.soil_type,
        height=plant.height,
        is_favorite=plant.is_favorite,
        character_image_url=_latest_character_url(plant.plant_id, db),
        persona=plant.persona,
        started_at=plant.started_at.isoformat() if plant.started_at else None,
        created_at=plant.created_at.isoformat(),
        temp_min_c=float(species.temp_min_c) if species and species.temp_min_c is not None else None,
        temp_max_c=float(species.temp_max_c) if species and species.temp_max_c is not None else None,
        humidity_min_pct=float(species.humidity_min_pct) if species and species.humidity_min_pct is not None else None,
        humidity_max_pct=float(species.humidity_max_pct) if species and species.humidity_max_pct is not None else None,
    )


@app.patch("/api/plants/{plant_id}/watering-schedule", response_model=CareSummary)
def update_watering_schedule(
    plant_id: int,
    payload: WateringScheduleUpdate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CareSummary:
    """물주기 주기를 사용자가 조정하거나 권장값으로 되돌린다.

    비료·분갈이는 일정으로 관리하지 않아(경과일수만 표시) 물주기 전용 엔드포인트다.
    다음 예정일은 마지막 물준 기록(없으면 지금) + 새 주기로 다시 계산한다.
    """
    plant = _owned_plant_or_404(plant_id, current_user, db)

    if payload.interval_days is None:
        interval, source = _initial_interval(plant, db)
    else:
        interval, source = payload.interval_days, "USER"

    schedule = db.scalar(
        select(CareSchedule).where(
            CareSchedule.plant_id == plant_id, CareSchedule.care_type == "WATERING"
        )
    )
    last_watered = db.scalar(
        select(CareRecord.completed_at)
        .where(CareRecord.plant_id == plant_id, CareRecord.care_type == "WATERING")
        .order_by(CareRecord.completed_at.desc())
        .limit(1)
    )
    next_due = (last_watered or datetime.now(timezone.utc)).date() + timedelta(days=interval)

    if schedule is None:
        # 일정이 없던 개체(마스터 도입 전 등록분)는 이 시점에 만들어진다
        db.add(
            CareSchedule(
                plant_id=plant_id,
                care_type="WATERING",
                interval_days=interval,
                interval_source=source,
                next_due_date=next_due,
            )
        )
    else:
        schedule.interval_days = interval
        schedule.interval_source = source
        schedule.next_due_date = next_due

    db.commit()
    return plant_care_summary(plant_id, current_user, db)


@app.get("/api/plants/{plant_id}/care", response_model=CareSummary)
def plant_care_summary(
    plant_id: int,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CareSummary:
    plant = db.get(Plant, plant_id)
    if plant is None or plant.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="식물을 찾을 수 없습니다.")

    def latest(care_type: str) -> datetime | None:
        return db.scalar(
            select(CareRecord.completed_at)
            .where(CareRecord.plant_id == plant_id, CareRecord.care_type == care_type)
            .order_by(CareRecord.completed_at.desc())
            .limit(1)
        )

    watered = latest("WATERING")
    fertilized = latest("FERTILIZING")
    repotted = latest("REPOTTING")

    # 물주기 일정 — 저장된 일정이 있으면 그 값, 없으면 종 권장값으로 계산한 예상치.
    # 예상치는 저장하지 않는다 (조회가 사용자 데이터를 만들면 안 된다)
    schedule = db.scalar(
        select(CareSchedule).where(
            CareSchedule.plant_id == plant_id, CareSchedule.care_type == "WATERING"
        )
    )
    if schedule is not None:
        interval = schedule.interval_days
        source = schedule.interval_source
        next_due = schedule.next_due_date
        saved = True
    else:
        # 일정 행이 아직 없는 개체(마스터 도입 전 등록분) — 만들지 않고 계산만 한다
        interval, source = _initial_interval(plant, db)
        base = (watered or plant.created_at).date() if (watered or plant.created_at) else None
        next_due = base + timedelta(days=interval) if (interval and base) else None
        saved = False

    today = datetime.now(timezone.utc).date()
    return CareSummary(
        last_watered_at=watered.isoformat() if watered else None,
        days_since_watering=_days_since(watered),
        last_fertilized_at=fertilized.isoformat() if fertilized else None,
        days_since_fertilizing=_days_since(fertilized),
        last_repotted_at=repotted.isoformat() if repotted else None,
        days_since_repotting=_days_since(repotted),
        watering_interval_days=interval,
        watering_interval_source=source,
        next_watering_date=next_due.isoformat() if next_due else None,
        days_until_watering=(next_due - today).days if next_due else None,
        watering_schedule_saved=saved,
    )


@app.get("/api/plants/{plant_id}/care-records", response_model=list[CareRecordItem])
def list_care_records(
    plant_id: int,
    care_type: str = Query(..., min_length=1),
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CareRecordItem]:
    _owned_plant_or_404(plant_id, current_user, db)
    if care_type not in CARE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 관리 유형입니다.")

    rows = db.scalars(
        select(CareRecord)
        .where(CareRecord.plant_id == plant_id, CareRecord.care_type == care_type)
        .order_by(CareRecord.completed_at.desc())
    ).all()
    return [
        CareRecordItem(
            id=r.care_record_id,
            care_type=r.care_type,
            completed_at=r.completed_at.isoformat(),
            note=r.note,
        )
        for r in rows
    ]


@app.post("/api/plants/{plant_id}/care-records", response_model=CareRecordCreated, status_code=status.HTTP_201_CREATED)
def create_care_record(
    plant_id: int,
    payload: CareRecordCreate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CareRecordCreated:
    plant = _owned_plant_or_404(plant_id, current_user, db)
    if payload.care_type not in CARE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 관리 유형입니다.")

    completed = _parse_dt(payload.completed_at) or datetime.now(timezone.utc).replace(tzinfo=None)

    # 애정도 적립 — 이번 기록을 같은 날 중복 판정에서 제외하려면 db.add 전에 호출해야 한다.
    # 그날 같은 종류를 이미 기록했거나 만점이면 0점.
    awarded = affinity.award_for_care(db, plant, payload.care_type, completed)

    record = CareRecord(
        plant_id=plant_id,
        care_type=payload.care_type,
        note=payload.note or None,
        completed_at=completed,
    )
    db.add(record)

    # 물을 줬으면 다음 예정일을 밀어준다. 일정이 없던 개체(마스터 도입 전 등록분)는
    # 이 시점에 종 권장값으로 만들어진다.
    if payload.care_type == "WATERING":
        _upsert_watering_schedule(plant, db, last_watered=completed)

    db.commit()
    db.refresh(record)

    return CareRecordCreated(
        id=record.care_record_id,
        care_type=record.care_type,
        completed_at=record.completed_at.isoformat(),
        note=record.note,
        affinity_awarded=awarded,
        affinity=affinity.status_for_plant(plant),
    )


@app.get("/api/plants/{plant_id}/affinity", response_model=AffinityStatus)
def get_plant_affinity(
    plant_id: int,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AffinityStatus:
    """개체의 애정도 현황 — plant.affinity_score 를 단계로 환산한다. app/affinity.py 참조."""
    plant = _owned_plant_or_404(plant_id, current_user, db)
    return affinity.status_for_plant(plant)


@app.post("/api/plants/{plant_id}/pet", response_model=AffinityAward)
def pet_plant(
    plant_id: int,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AffinityAward:
    """캐릭터 문지르기 — 하루 한 번 소량의 애정도를 준다.

    돌봄이 아니라 애정 표현이라 care_record 는 남기지 않는다.
    이미 오늘 받았거나 만점이면 affinity_awarded 가 0으로 온다.
    """
    plant = _owned_plant_or_404(plant_id, current_user, db)
    awarded = affinity.award_for_petting(plant)
    if awarded:
        db.commit()
        db.refresh(plant)
    return AffinityAward(
        affinity_awarded=awarded,
        affinity=affinity.status_for_plant(plant),
    )


# ---------------------------------------------------------------------------
# 꾸미기 — 아이템 목록 / 개체 착용 / 홈 배경
#
# 해금 여부는 저장하지 않는다. 아이템의 required_level 과 애정도에서 계산한
# 단계를 비교할 뿐이라, affinity.py 의 기준을 바꾸면 즉시 새 기준이 적용된다.
# ---------------------------------------------------------------------------

# 액세서리 슬롯 — 현재 UI는 하나뿐이라 고정값을 쓴다 (plant_decoration.position_key)
ACCESSORY_POSITION_KEY = "HEAD"

# 배경을 고르기 전의 기본값. item 시드의 item_key 이자 앱 번들 이미지 맵의 키다.
DEFAULT_BACKGROUND_ITEM_KEY = "home-bg"


def _active_item_or_404(item_id: int, item_type: str, db: Session) -> Item:
    item = db.get(Item, item_id)
    if item is None or not item.is_active or item.item_type != item_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="존재하지 않는 아이템입니다."
        )
    return item


def _item_sprite_url(item: Item, db: Session) -> str | None:
    """액세서리를 착용한 캐릭터 이미지 URL. 아직 S3에 올리지 않았으면 None."""
    if item.sprite_asset_id is None:
        return None
    row = db.execute(
        select(MediaAsset.object_key, MediaAsset.file_url, MediaAsset.bucket_name).where(
            MediaAsset.asset_id == item.sprite_asset_id
        )
    ).first()
    return _asset_url(*row) if row else None


@app.get("/api/items", response_model=list[ItemRead])
def list_items(
    item_type: str | None = Query(default=None, description="ACCESSORY | BACKGROUND"),
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ItemRead]:
    """꾸미기 아이템 목록.

    이미지는 S3(media_asset)에 올린 게 있으면 그 URL을, 없으면 null 을 준다 —
    앱은 null 일 때 item_key 로 번들 이미지를 그린다.

    해금 여부는 내려보내지 않는다 — 액세서리는 개체마다, 배경은 유저 전체 기준이라
    조건이 달라서, 앱이 required_level 과 해당 애정도 단계를 비교한다.
    """
    card = aliased(MediaAsset)
    sprite = aliased(MediaAsset)
    query = (
        select(
            Item,
            card.object_key,
            card.file_url,
            card.bucket_name,
            sprite.object_key,
            sprite.file_url,
            sprite.bucket_name,
        )
        .join(card, card.asset_id == Item.asset_id, isouter=True)
        .join(sprite, sprite.asset_id == Item.sprite_asset_id, isouter=True)
        .where(Item.is_active.is_(True))
    )
    if item_type is not None:
        query = query.where(Item.item_type == item_type)
    rows = db.execute(query.order_by(Item.required_level, Item.item_id)).all()
    return [
        ItemRead(
            id=item.item_id,
            item_key=item.item_key,
            item_name=item.item_name,
            item_type=item.item_type,
            required_level=item.required_level,
            image_url=_asset_url(card_key, card_url, card_bucket),
            sprite_url=_asset_url(sprite_key, sprite_url, sprite_bucket),
        )
        for item, card_key, card_url, card_bucket, sprite_key, sprite_url, sprite_bucket in rows
    ]


@app.get("/api/plants/{plant_id}/decoration", response_model=PlantDecorationRead)
def get_plant_decoration(
    plant_id: int,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlantDecorationRead:
    """개체가 착용 중인 액세서리. 없으면 두 필드 모두 null."""
    plant = _owned_plant_or_404(plant_id, current_user, db)
    sprite = aliased(MediaAsset)
    row = db.execute(
        select(
            PlantDecoration.item_id,
            Item.item_key,
            sprite.object_key,
            sprite.file_url,
            sprite.bucket_name,
        )
        .join(Item, Item.item_id == PlantDecoration.item_id)
        .join(sprite, sprite.asset_id == Item.sprite_asset_id, isouter=True)
        .where(
            PlantDecoration.plant_id == plant.plant_id,
            PlantDecoration.position_key == ACCESSORY_POSITION_KEY,
        )
    ).first()
    if row is None:
        return PlantDecorationRead()
    item_id, item_key, object_key, file_url, bucket_name = row
    return PlantDecorationRead(
        item_id=item_id,
        item_key=item_key,
        sprite_url=_asset_url(object_key, file_url, bucket_name),
    )


@app.put("/api/plants/{plant_id}/decoration", response_model=PlantDecorationRead)
def set_plant_decoration(
    plant_id: int,
    payload: PlantDecorationUpdate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlantDecorationRead:
    """액세서리를 착용하거나(item_id) 벗는다(null).

    그 개체의 애정도 단계가 아이템의 required_level 에 못 미치면 거절한다 —
    앱에서도 잠긴 카드를 못 누르게 막지만, 해금 판정의 최종 책임은 서버에 둔다.
    """
    plant = _owned_plant_or_404(plant_id, current_user, db)
    current = db.scalar(
        select(PlantDecoration).where(
            PlantDecoration.plant_id == plant.plant_id,
            PlantDecoration.position_key == ACCESSORY_POSITION_KEY,
        )
    )

    if payload.item_id is None:
        if current is not None:
            db.delete(current)
            db.commit()
        return PlantDecorationRead()

    item = _active_item_or_404(payload.item_id, "ACCESSORY", db)
    if affinity.level_for_score(plant.affinity_score or 0) < item.required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"하트 {item.required_level}개부터 사용할 수 있어요.",
        )

    if current is None:
        db.add(
            PlantDecoration(
                plant_id=plant.plant_id,
                item_id=item.item_id,
                position_key=ACCESSORY_POSITION_KEY,
            )
        )
    else:
        current.item_id = item.item_id
        current.applied_at = datetime.now(timezone.utc)
    db.commit()
    return PlantDecorationRead(
        item_id=item.item_id,
        item_key=item.item_key,
        sprite_url=_item_sprite_url(item, db),
    )


@app.delete("/api/plants/{plant_id}/care-records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_care_record(
    plant_id: int,
    record_id: int,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _owned_plant_or_404(plant_id, current_user, db)
    record = db.get(CareRecord, record_id)
    if record is None or record.plant_id != plant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="기록을 찾을 수 없습니다.")
    db.delete(record)
    db.commit()


@app.get("/api/personas", response_model=list[PersonaOption])
def list_personas() -> list[PersonaOption]:
    return [PersonaOption(**option) for option in persona_chat.list_persona_options()]


@app.post("/api/plants/{plant_id}/persona-chat", response_model=PersonaChatResponse)
def persona_chat_reply(
    plant_id: int,
    payload: PersonaChatRequest,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PersonaChatResponse:
    plant = _owned_plant_or_404(plant_id, current_user, db)

    # persona는 클라이언트가 아니라 plant.persona(DB)에서 가져온다 — 캐릭터별로 한 번 정해지는 값이라
    # 매 요청마다 클라이언트가 보낼 필요가 없고, 임의의 페르소나로 스푸핑되는 것도 막을 수 있다.
    if plant.persona is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="아직 페르소나가 설정되지 않았어요.")

    persona_file_name = persona_chat.PERSONA_SLUG_TO_FILE[plant.persona]

    plant_context = _persona_plant_context(plant, current_user, db)
    watering_schedule = _persona_watering_schedule(plant_id, db)
    weather_air_quality = _persona_weather_air_quality(current_user, db)

    try:
        reply = persona_chat.chat_with_ollama(
            persona_file_name=persona_file_name,
            watering_schedule=watering_schedule,
            weather_air_quality=weather_air_quality,
            conversation_history=[
                {"role": message.role, "content": message.content} for message in payload.history
            ],
            user_message=payload.message,
            reference_date=persona_chat.today_in_korea(),
            plant_context=plant_context,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return PersonaChatResponse(reply=reply, persona=plant.persona)


@app.get("/auth/me", response_model=UserRead)
def me(current_user: AppUser = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@app.patch("/auth/me", response_model=UserRead)
def update_me(
    payload: UserUpdate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserRead:
    """내 프로필 수정 — 설정 화면의 이름 변경. 닉네임 규칙은 회원가입과 동일."""
    current_user.nickname = payload.nickname
    db.commit()
    db.refresh(current_user)
    return UserRead.model_validate(current_user)


def _settings_read(setting: UserSetting | None, db: Session) -> UserSettingRead:
    """설정 응답. 홈 배경은 이미지 URL 과, 그게 없을 때 쓸 item_key 를 함께 준다."""
    item_id = setting.home_background_item_id if setting else None
    row = (
        db.execute(
            select(
                Item.item_key,
                MediaAsset.object_key,
                MediaAsset.file_url,
                MediaAsset.bucket_name,
            )
            .join(MediaAsset, MediaAsset.asset_id == Item.asset_id, isouter=True)
            .where(Item.item_id == item_id)
        ).first()
        if item_id
        else None
    )
    item_key, object_key, file_url, bucket_name = row if row else (None, None, None, None)
    return UserSettingRead(
        default_location=setting.default_location if setting else None,
        home_background_item_id=item_id,
        # 고르지 않았거나 아이템이 사라졌으면 기본 배경으로 그린다
        home_background_item_key=item_key or DEFAULT_BACKGROUND_ITEM_KEY,
        home_background_image_url=_asset_url(object_key, file_url, bucket_name),
    )


@app.get("/api/settings", response_model=UserSettingRead)
def get_settings(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSettingRead:
    setting = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.user_id))
    return _settings_read(setting, db)


@app.patch("/api/settings", response_model=UserSettingRead)
def update_settings(
    payload: UserSettingUpdate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSettingRead:
    # 위치는 GPS 좌표로만 받는다 — region_data에서 가장 가까운 지역을 찾아 저장한다.
    region = region_data.nearest_region(payload.lat, payload.lng)

    setting = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.user_id))
    if setting is None:
        setting = UserSetting(user_id=current_user.user_id, default_location=region.name)
        db.add(setting)
    else:
        setting.default_location = region.name
    db.commit()

    return _settings_read(setting, db)


@app.patch("/api/settings/home-background", response_model=UserSettingRead)
def update_home_background(
    payload: HomeBackgroundUpdate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSettingRead:
    """홈 배경 선택. item_id 가 null 이면 기본 배경으로 되돌린다.

    배경은 홈 전체에 적용되는데 애정도는 개체별이라, 개체 중 가장 높은 단계를
    기준으로 해금을 판정한다 — 한 마리를 잘 키운 보상이 홈에 남고,
    개체를 지웠다고 이미 열린 배경이 다시 잠기지도 않게.
    (위치 설정과 payload 가 달라 PATCH /api/settings 와 엔드포인트를 나눴다.)
    """
    setting = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.user_id))
    if setting is None:
        setting = UserSetting(user_id=current_user.user_id)
        db.add(setting)

    if payload.item_id is None:
        setting.home_background_item_id = None
        db.commit()
        return _settings_read(setting, db)

    item = _active_item_or_404(payload.item_id, "BACKGROUND", db)
    best_score = db.scalar(
        select(func.max(Plant.affinity_score)).where(Plant.user_id == current_user.user_id)
    )
    if affinity.level_for_score(best_score or 0) < item.required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"하트 {item.required_level}개부터 사용할 수 있어요.",
        )

    setting.home_background_item_id = item.item_id
    db.commit()
    return _settings_read(setting, db)


@app.get("/api/environment/current", response_model=CurrentEnvironmentResponse)
def get_current_environment_route(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentEnvironmentResponse:
    # 모바일은 위치 미설정(400)을 보고 위치 설정 화면으로 유도한다.
    region = _region_for_current_user(current_user, db)

    # record_snapshot이 첫 row를 넣기 전에 먼저 확인해야 "첫 조회"를 정확히 판단할 수 있다.
    is_first_visit = not environment.has_any_snapshot(db, current_user.user_id)

    try:
        current = environment.get_current_environment(region)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    environment.record_snapshot(db, current_user.user_id, region.name, current)

    if is_first_visit:
        try:
            station_name = air_quality.nearest_station(region.lat, region.lng)
            environment.backfill_air_quality_history(db, current_user.user_id, region.name, station_name)
        except RuntimeError:
            pass  # 최초 백필 실패는 이번 응답을 막을 이유가 아니다

    return CurrentEnvironmentResponse(
        location_name=region.name,
        weather_status=current.weather_status,
        air_quality_status=current.air_quality_status,
        temperature_c=current.temperature_c,
        humidity_pct=current.humidity_pct,
        pm10_value=current.pm10_value,
        pm25_value=current.pm25_value,
        khai_value=current.khai_value,
        observed_at=current.observed_at.isoformat(),
    )


def _region_for_current_user(current_user: AppUser, db: Session) -> region_data.Region:
    setting = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.user_id))
    if setting is None or setting.default_location is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="위치가 설정되지 않았어요.")
    region = region_data.find_region(setting.default_location)
    if region is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="저장된 위치를 찾을 수 없어요.")
    return region


@app.get("/api/environment/history", response_model=EnvironmentHistoryResponse)
def get_environment_history(
    period: str = Query(default="day", pattern="^(day|week|month)$"),
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EnvironmentHistoryResponse:
    if period == "day":
        # "오늘"은 우리 DB에 쌓아둔 값이 아니라, 그때그때 기상청 초단기실황을 정시마다
        # 조회해서 즉석에서 재구성한다 — weather.py의 캐시 덕분에 같은 지역·시간대를
        # 여러 사용자가 봐도 실제 기상청 호출은 한 번만 일어난다.
        region = _region_for_current_user(current_user, db)
        try:
            observations = weather.fetch_today_hourly_series(region.kma_nx, region.kma_ny)
        except RuntimeError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

        weather_points = [
            WeatherHistoryPoint(
                observed_at=observation.observed_at.isoformat(),
                temperature_c=observation.temperature_c,
                humidity_pct=observation.humidity_pct,
                weather_status=None,
            )
            for observation in observations
        ]

        # 대기질은 실패해도 기온/습도 그래프까지 막으면 안 된다 — 조용히 빈 목록으로.
        air_quality_points: list[AirQualityHistoryPoint] = []
        try:
            station_name = air_quality.nearest_station(region.lat, region.lng)
            for record in air_quality.fetch_realtime_measurements(station_name):
                air_quality_points.append(
                    AirQualityHistoryPoint(
                        observed_at=record.measured_at,
                        pm10=record.pm10_value,
                        pm25=record.pm25_value,
                        air_quality_status=air_quality.classify_air_quality(record.khai_grade),
                    )
                )
        except RuntimeError:
            pass

        return EnvironmentHistoryResponse(weather_points=weather_points, air_quality_points=air_quality_points)

    # 주/월도 우리 DB 누적치가 아니라, ASOS 일자료(하루 평균)를 그 자리에서 라이브
    # 조회한다 — 사용자가 그동안 앱을 몇 번 열었는지와 무관하게 항상 완전한 그래프.
    # ASOS는 전일(D-1)까지만 제공하므로 endDt는 어제로 고정한다.
    region = _region_for_current_user(current_user, db)
    stn_id = asos.nearest_station_id(region.lat, region.lng)
    days = 7 if period == "week" else 30
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=days - 1)

    try:
        observations = asos.fetch_daily_series(stn_id, start, end)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    weather_points = [
        WeatherHistoryPoint(
            observed_at=observation.date.isoformat(),
            temperature_c=observation.avg_temperature_c,
            humidity_pct=observation.avg_humidity_pct,
            weather_status=None,
        )
        for observation in observations
        if observation.avg_temperature_c is not None
    ]
    # 대기질도 DB 누적이 아니라 에어코리아를 라이브로 조회한다 — 날씨(ASOS)와 같은 이유.
    # 날씨 그래프까지 막지 않도록 실패 시 조용히 빈 목록으로 낮춘다.
    air_quality_points: list[AirQualityHistoryPoint] = []
    try:
        station_name = air_quality.nearest_station(region.lat, region.lng)
        for observation in air_quality.fetch_daily_series(station_name, start, end):
            air_quality_points.append(
                AirQualityHistoryPoint(
                    observed_at=observation.date.isoformat(),
                    pm10=observation.avg_pm10,
                    pm25=observation.avg_pm25,
                    air_quality_status=None,
                )
            )
    except RuntimeError:
        pass

    return EnvironmentHistoryResponse(weather_points=weather_points, air_quality_points=air_quality_points)
