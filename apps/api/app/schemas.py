import re
from typing import Literal

from pydantic import AliasChoices, BaseModel, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
NICKNAME_PATTERN = re.compile(r"^[가-힣A-Za-z0-9]{2,10}$")


class UserRead(BaseModel):
    # app_user.user_id → 응답 키는 프론트 호환 위해 id 유지
    id: int = Field(validation_alias=AliasChoices("user_id", "id"))
    email: str
    nickname: str

    model_config = {"from_attributes": True, "populate_by_name": True}


class SignupRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    nickname: str = Field(min_length=2, max_length=10)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
      email = value.strip().lower()
      if not EMAIL_PATTERN.match(email):
          raise ValueError("올바른 이메일을 입력해주세요.")
      return email

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        has_letter = bool(re.search(r"[A-Za-z]", value))
        has_digit = bool(re.search(r"\d", value))
        if not (has_letter and has_digit):
            raise ValueError("비밀번호는 영문과 숫자를 모두 포함해야 합니다.")
        return value

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, value: str) -> str:
        nickname = value.strip()
        if not NICKNAME_PATTERN.match(nickname):
            raise ValueError("닉네임은 2~10자, 한글/영문/숫자만 사용할 수 있습니다.")
        return nickname


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class AvailabilityResponse(BaseModel):
    available: bool


class PlantImagePreprocessResponse(BaseModel):
    canvas_size: int
    sdxl_input_png_base64: str
    transparent_png_base64: str


class BackgroundRemovalResponse(BaseModel):
    canvas_size: int
    transparent_png_base64: str


class PlantCreate(BaseModel):
    # 종 정보 (plant_species로 매핑)
    cntntsNo: str | None = None
    scientificName: str | None = None
    commonNameKo: str
    # 개체 정보 (plant으로 매핑)
    nickname: str
    location: str = ''
    lightLevel: str = ''
    plantHeight: int = 0
    potDiameter: int = 0
    potType: str = ''
    soilNote: str = ''
    # 사진 (media_asset으로 매핑)
    characterImageUrl: str = ''
    capturedPhotoUri: str = ''
    # S3 object_key/무결성용 체크섬(SHA-256 등) — 클라이언트가 업로드 시 계산해 전달. 없으면 서버가 임의 토큰 사용
    characterChecksum: str = ''
    photoChecksum: str = ''
    # care_record 소관이라 현재 4개 테이블에는 저장하지 않음 (수신만 허용)
    lastWateredAt: str | None = None
    lastRepottedAt: str | None = None


class PlantRead(BaseModel):
    id: int
    nickname: str
    common_name_ko: str
    created_at: str

    model_config = {"from_attributes": True}


class PlantDetail(BaseModel):
    # 프로필/상세 화면용 전체 필드
    id: int
    nickname: str
    common_name_ko: str | None = None
    scientific_name: str | None = None
    status: str = "ALIVE"
    location_name: str | None = None
    light_condition: str | None = None
    pot_type: str | None = None
    pot_size: str | None = None
    soil_type: str | None = None
    height: str | None = None
    is_favorite: bool = False
    character_image_url: str | None = None
    started_at: str | None = None
    created_at: str


class PlantUpdate(BaseModel):
    # 프로필 편집 — 넘어온 필드만 부분 수정
    nickname: str | None = None
    status: str | None = None
    location_name: str | None = None
    pot_type: str | None = None
    pot_size: str | None = None
    height: str | None = None


class CareSummary(BaseModel):
    # 최근 물주기/영양제/분갈이 기록 (care_record 기반) + 경과 일수
    last_watered_at: str | None = None
    days_since_watering: int | None = None
    last_fertilized_at: str | None = None
    days_since_fertilizing: int | None = None
    last_repotted_at: str | None = None
    days_since_repotting: int | None = None


class CareRecordItem(BaseModel):
    id: int
    care_type: str
    completed_at: str
    note: str | None = None


class CareRecordCreate(BaseModel):
    care_type: str
    note: str | None = None
    completed_at: str | None = None


class PersonaChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=500)


class PersonaChatRequest(BaseModel):
    persona: str
    message: str = Field(min_length=1, max_length=500)
    # 서버는 대화 기록을 저장하지 않는다 — 클라이언트가 최근 턴만 매번 실어 보낸다.
    history: list[PersonaChatMessage] = Field(default_factory=list, max_length=10)


class PersonaChatResponse(BaseModel):
    reply: str
    persona: str


class PlantListItem(BaseModel):
    # 정원 목록에 필요한 최소 필드 — 미구현(캐릭터 이미지/호감도)은 앱에서 placeholder 처리
    id: int
    nickname: str
    common_name_ko: str | None = None
    location_name: str | None = None
    light_condition: str | None = None
    is_favorite: bool = False
    status: str = "ALIVE"
    character_image_url: str | None = None
    created_at: str
