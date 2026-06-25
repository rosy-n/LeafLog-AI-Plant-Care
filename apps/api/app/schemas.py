import re

from pydantic import BaseModel, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
NICKNAME_PATTERN = re.compile(r"^[가-힣A-Za-z0-9]{2,10}$")


class UserRead(BaseModel):
    id: int
    email: str
    nickname: str
    marketing_opt_in: bool

    model_config = {"from_attributes": True}


class SignupRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    nickname: str = Field(min_length=2, max_length=10)
    marketing_opt_in: bool = False

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


class PlantCreate(BaseModel):
    cntntsNo: str | None = None
    scientificName: str | None = None
    commonNameKo: str
    nickname: str
    characterImageUrl: str = ''
    capturedPhotoUri: str = ''
    location: str
    lightLevel: str
    plantHeight: int = 0
    potDiameter: int = 0
    soilNote: str = ''
    lastWateredAt: str
    lastRepottedAt: str | None = None


class PlantRead(BaseModel):
    id: int
    nickname: str
    common_name_ko: str
    created_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_plant(cls, plant: object) -> "PlantRead":
        return cls(
            id=plant.id,  # type: ignore[attr-defined]
            nickname=plant.nickname,  # type: ignore[attr-defined]
            common_name_ko=plant.common_name_ko,  # type: ignore[attr-defined]
            created_at=plant.created_at.isoformat(),  # type: ignore[attr-defined]
        )
