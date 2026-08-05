from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db
from .image_preprocessing import (
    ImagePreprocessingError,
    ImagePreprocessingUnavailable,
    QualityMode,
    preprocess_plant_photo,
    remove_background_for_sprite,
)
from .models import AppUser, CareRecord, MediaAsset, Plant, PlantSpecies, SpeciesSourceLink
from .schemas import (
    AvailabilityResponse,
    AuthResponse,
    BackgroundRemovalResponse,
    CareRecordCreate,
    CareRecordItem,
    CareSummary,
    LoginRequest,
    PlantCreate,
    PlantDetail,
    PlantImagePreprocessResponse,
    PlantListItem,
    PlantUpdate,
    PlantRead,
    SignupRequest,
    SpeciesDetail,
    SpeciesListItem,
    UserRead,
)
from .security import create_access_token, decode_access_token, hash_password, verify_password
from .storage import presigned_get_url

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
        select(MediaAsset.object_key, MediaAsset.file_url)
        .where(MediaAsset.plant_id == plant_id, MediaAsset.asset_type == "CHARACTER_IMAGE")
        .order_by(MediaAsset.created_at.desc())
        .limit(1)
    ).first()
    if row is None:
        return None
    object_key, file_url = row
    return presigned_get_url(object_key) or file_url


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


def _owned_plant_or_404(plant_id: int, current_user: "AppUser", db: Session) -> Plant:
    plant = db.get(Plant, plant_id)
    if plant is None or plant.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="식물을 찾을 수 없습니다.")
    return plant


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

    detail = SpeciesDetail.model_validate(species)
    # 출처 표기용 — 연결이 없으면 사용자 등록 유래 종이라 빈 목록
    detail.sources = list(
        db.scalars(
            select(SpeciesSourceLink.source_code)
            .where(SpeciesSourceLink.species_id == species_id)
            .order_by(SpeciesSourceLink.source_code)
        ).all()
    )
    return detail


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
            asset_type="PLANT_PHOTO",
            checksum=payload.photoChecksum or None,
        ))
    if payload.characterImageUrl:
        db.add(MediaAsset(
            user_id=current_user.user_id,
            plant_id=plant.plant_id,
            object_key=_object_key_from_url(payload.characterImageUrl),
            file_url=payload.characterImageUrl,
            asset_type="CHARACTER_IMAGE",
            checksum=payload.characterChecksum or None,
        ))

    # 4. 최초 물주기/분갈이 기록 → care_record (넘어온 날짜만)
    watered_at = _parse_dt(payload.lastWateredAt)
    if watered_at:
        db.add(CareRecord(plant_id=plant.plant_id, care_type="WATERING", completed_at=watered_at))
    repotted_at = _parse_dt(payload.lastRepottedAt)
    if repotted_at:
        db.add(CareRecord(plant_id=plant.plant_id, care_type="REPOTTING", completed_at=repotted_at))

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
            select(MediaAsset.plant_id, MediaAsset.object_key, MediaAsset.file_url)
            .where(
                MediaAsset.plant_id.in_(plant_ids),
                MediaAsset.asset_type == "CHARACTER_IMAGE",
            )
            .order_by(MediaAsset.created_at.desc())
        ).all()
        for pid, object_key, file_url in char_rows:
            char_map.setdefault(pid, presigned_get_url(object_key) or file_url)

    return [
        PlantListItem(
            id=plant.plant_id,
            nickname=plant.nickname,
            common_name_ko=common_name_ko,
            location_name=plant.location_name,
            light_condition=plant.light_condition,
            is_favorite=plant.is_favorite,
            status=plant.status,
            character_image_url=char_map.get(plant.plant_id),
            created_at=plant.created_at.isoformat(),
        )
        for plant, common_name_ko in rows
    ]


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
        status=plant.status,
        location_name=plant.location_name,
        light_condition=plant.light_condition,
        pot_type=plant.pot_type,
        pot_size=plant.pot_size,
        soil_type=plant.soil_type,
        height=plant.height,
        is_favorite=plant.is_favorite,
        character_image_url=_latest_character_url(plant.plant_id, db),
        started_at=plant.started_at.isoformat() if plant.started_at else None,
        created_at=plant.created_at.isoformat(),
    )


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
    return CareSummary(
        last_watered_at=watered.isoformat() if watered else None,
        days_since_watering=_days_since(watered),
        last_fertilized_at=fertilized.isoformat() if fertilized else None,
        days_since_fertilizing=_days_since(fertilized),
        last_repotted_at=repotted.isoformat() if repotted else None,
        days_since_repotting=_days_since(repotted),
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


@app.post("/api/plants/{plant_id}/care-records", response_model=CareRecordItem, status_code=status.HTTP_201_CREATED)
def create_care_record(
    plant_id: int,
    payload: CareRecordCreate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CareRecordItem:
    _owned_plant_or_404(plant_id, current_user, db)
    if payload.care_type not in CARE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 관리 유형입니다.")

    completed = _parse_dt(payload.completed_at) or datetime.now(timezone.utc).replace(tzinfo=None)
    record = CareRecord(
        plant_id=plant_id,
        care_type=payload.care_type,
        note=payload.note or None,
        completed_at=completed,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return CareRecordItem(
        id=record.care_record_id,
        care_type=record.care_type,
        completed_at=record.completed_at.isoformat(),
        note=record.note,
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


@app.get("/auth/me", response_model=UserRead)
def me(current_user: AppUser = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
