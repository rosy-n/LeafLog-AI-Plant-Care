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
    persona: str | None = None
    started_at: str | None = None
    created_at: str
    # 종별 적정 범위 (plant_species, 농사로 코드 매핑) — 센서데이터탭 총평 판정에 사용
    temp_min_c: float | None = None
    temp_max_c: float | None = None
    humidity_min_pct: float | None = None
    humidity_max_pct: float | None = None


class PlantUpdate(BaseModel):
    # 프로필 편집 — 넘어온 필드만 부분 수정
    # 종을 다시 고르는 경우 (인식이 어긋났거나 마스터 도입 전에 등록한 개체)
    species_id: int | None = None
    nickname: str | None = None
    status: str | None = None
    location_name: str | None = None
    pot_type: str | None = None
    pot_size: str | None = None
    height: str | None = None
    persona: str | None = None


class CareSummary(BaseModel):
    # 최근 물주기/영양제/분갈이 기록 (care_record 기반) + 경과 일수
    last_watered_at: str | None = None
    days_since_watering: int | None = None
    last_fertilized_at: str | None = None
    days_since_fertilizing: int | None = None
    last_repotted_at: str | None = None
    days_since_repotting: int | None = None

    # 물주기 일정 (care_schedule).
    # watering_schedule_saved=false 면 저장된 일정이 아직 없어 계산만 한 예상치라는 뜻.
    # watering_interval_source 는 그 주기의 근거 —
    #   SPECIES: 종 마스터 권장값 / DEFAULT: 자료가 없어 앱 기본값 / USER: 사용자 설정
    # 화면에서 "자료 기반"과 "기본값"을 구분해 보여주기 위한 값이다.
    watering_interval_days: int | None = None
    watering_interval_source: str | None = None
    next_watering_date: str | None = None
    days_until_watering: int | None = None
    watering_schedule_saved: bool = False


class CareRecordItem(BaseModel):
    id: int
    care_type: str
    completed_at: str
    note: str | None = None


class WateringScheduleUpdate(BaseModel):
    """물주기 주기 변경.

    interval_days 를 주면 사용자 설정(USER)으로 기록한다.
    null 이면 권장값(종 마스터 값, 없으면 앱 기본값)으로 되돌린다.
    비료·분갈이는 일정으로 관리하지 않으므로 이 엔드포인트는 물주기 전용이다.
    """

    interval_days: int | None = Field(default=None, ge=1, le=365)


class CareRecordCreate(BaseModel):
    care_type: str
    note: str | None = None
    completed_at: str | None = None


class PersonaChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=500)


class PersonaChatRequest(BaseModel):
    # persona는 더 이상 클라이언트가 보내지 않는다 — plant.persona(DB)에 저장된 값을 서버가 조회해서 쓴다.
    message: str = Field(min_length=1, max_length=500)
    # 서버는 대화 기록을 저장하지 않는다 — 클라이언트가 최근 턴만 매번 실어 보낸다.
    history: list[PersonaChatMessage] = Field(default_factory=list, max_length=10)


class PersonaChatResponse(BaseModel):
    reply: str
    persona: str


class PersonaOption(BaseModel):
    # 모바일 페르소나 선택 UI용 — slug는 plant.persona/PersonaChatResponse.persona와 동일한 값
    slug: str
    label: str


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

    # 물주기 일정 요약 — 알림 목록·배지·기기 알림 재예약이 개체마다 상세를 조회하지 않도록
    # 목록에 함께 싣는다 (N+1 방지). 일정 행이 없으면 계산값이 들어간다.
    watering_interval_days: int | None = None
    next_watering_date: str | None = None
    days_until_watering: int | None = None
    persona: str | None = None
    created_at: str


class UserSettingRead(BaseModel):
    # default_location은 region_data.Region.name과 정확히 일치("서울특별시 마포구" 형태)
    default_location: str | None = None


class UserSettingUpdate(BaseModel):
    # 위치는 GPS 좌표로만 받는다 — 서버가 region_data에서 가장 가까운 지역을
    # 찾아 default_location에 저장한다(직접 지역명을 받는 수동 검색 UI는 없음).
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class CurrentEnvironmentResponse(BaseModel):
    location_name: str
    weather_status: str
    air_quality_status: str
    temperature_c: float
    humidity_pct: float
    pm10_value: float | None = None
    pm25_value: float | None = None
    khai_value: float | None = None
    observed_at: str


class WeatherHistoryPoint(BaseModel):
    observed_at: str
    temperature_c: float | None = None
    humidity_pct: float | None = None
    weather_status: str | None = None


class AirQualityHistoryPoint(BaseModel):
    observed_at: str
    pm10: float | None = None
    pm25: float | None = None
    air_quality_status: str | None = None


class EnvironmentHistoryResponse(BaseModel):
    weather_points: list[WeatherHistoryPoint]
    air_quality_points: list[AirQualityHistoryPoint]
