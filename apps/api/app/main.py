from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db
from .models import AppUser, MediaAsset, Plant, PlantSpecies
from .schemas import AvailabilityResponse, AuthResponse, LoginRequest, PlantCreate, PlantRead, SignupRequest, UserRead
from .security import create_access_token, decode_access_token, hash_password, verify_password

app = FastAPI(title="LeafLog API", version="0.1.0")

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


def _enum_or_none(value: str | None, allowed: set[str]) -> str | None:
    return value if value in allowed else None


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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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


@app.post("/api/plants", response_model=PlantRead, status_code=status.HTTP_201_CREATED)
def create_plant(
    payload: PlantCreate,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlantRead:
    # 1. 종(plant_species) get-or-create — 학명 우선, 없으면 국명으로 매칭
    species: PlantSpecies | None = None
    if payload.scientificName:
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
        pot_size=str(payload.potDiameter) if payload.potDiameter else None,
        height=str(payload.plantHeight) if payload.plantHeight else None,
        soil_type=payload.soilNote or None,
    )
    db.add(plant)
    db.flush()

    # 3. 사진(media_asset) — 넘어온 것만 저장
    if payload.capturedPhotoUri:
        db.add(MediaAsset(
            user_id=current_user.user_id,
            plant_id=plant.plant_id,
            object_key=f"plant/{plant.plant_id}/photo",
            file_url=payload.capturedPhotoUri,
            asset_type="PLANT_PHOTO",
        ))
    if payload.characterImageUrl:
        db.add(MediaAsset(
            user_id=current_user.user_id,
            plant_id=plant.plant_id,
            object_key=f"plant/{plant.plant_id}/character",
            file_url=payload.characterImageUrl,
            asset_type="CHARACTER_IMAGE",
        ))

    db.commit()
    db.refresh(plant)

    return PlantRead(
        id=plant.plant_id,
        nickname=plant.nickname,
        common_name_ko=species.common_name_ko,
        created_at=plant.created_at.isoformat(),
    )


@app.get("/auth/me", response_model=UserRead)
def me(current_user: AppUser = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)