from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
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
from .models import Plant, User
from .schemas import (
    AvailabilityResponse,
    AuthResponse,
    BackgroundRemovalResponse,
    LoginRequest,
    PlantCreate,
    PlantImagePreprocessResponse,
    PlantRead,
    SignupRequest,
    UserRead,
)
from .security import create_access_token, decode_access_token, hash_password, verify_password

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


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


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
    exists = db.scalar(select(User.id).where(User.email == normalized_email))
    return AvailabilityResponse(available=exists is None)


@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    exists = db.scalar(select(User).where(User.email == payload.email))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다.")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        nickname=payload.nickname,
        marketing_opt_in=payload.marketing_opt_in,
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다.") from None

    db.refresh(user)
    return AuthResponse(access_token=create_access_token(str(user.id)), user=UserRead.model_validate(user))


@app.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
        )

    return AuthResponse(access_token=create_access_token(str(user.id)), user=UserRead.model_validate(user))


@app.post("/api/plants", response_model=PlantRead, status_code=status.HTTP_201_CREATED)
def create_plant(payload: PlantCreate, db: Session = Depends(get_db)) -> PlantRead:
    def parse_iso(s: str | None) -> datetime | None:
        if not s:
            return None
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None

    plant = Plant(
        cntnts_no=payload.cntntsNo or None,
        scientific_name=payload.scientificName or None,
        common_name_ko=payload.commonNameKo,
        nickname=payload.nickname,
        character_image_url=payload.characterImageUrl or None,
        captured_photo_uri=payload.capturedPhotoUri or None,
        location=payload.location,
        light_level=payload.lightLevel,
        plant_height=payload.plantHeight,
        pot_diameter=payload.potDiameter,
        soil_note=payload.soilNote or None,
        last_watered_at=parse_iso(payload.lastWateredAt),
        last_repotted_at=parse_iso(payload.lastRepottedAt),
    )
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return PlantRead.from_plant(plant)


@app.get("/auth/me", response_model=UserRead)
def me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserRead:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 토큰이 필요합니다.")

    subject = decode_access_token(authorization.split(" ", 1)[1])
    if subject is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.")

    user = db.get(User, int(subject))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다.")

    return UserRead.model_validate(user)
