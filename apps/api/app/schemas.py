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


class SpeciesListItem(BaseModel):
    # 종 검색 결과 — 등록 1단계 목록에 필요한 최소 필드
    species_id: int
    common_name_ko: str
    common_name_en: str | None = None
    scientific_name: str | None = None
    family_name: str | None = None
    image_url: str | None = None
    difficulty: str = "UNKNOWN"

    model_config = {"from_attributes": True}


class SpeciesDetail(BaseModel):
    # 종 상세 — 4개 소스를 병합한 돌봄 정보. 값이 없으면 None(=자료 없음)
    species_id: int
    common_name_ko: str
    common_name_en: str | None = None
    scientific_name: str | None = None
    family_name: str | None = None
    genus_name: str | None = None
    category: str | None = None
    description: str | None = None

    # 자생지 / 원산지 / 분포 (NATURE_KNA)
    origin: str | None = None
    origin_country: str | None = None
    distribution: str | None = None

    # 돌봄 조건 (RDA_INDOOR)
    difficulty: str = "UNKNOWN"
    light_level: str = "UNKNOWN"
    light_min_lux: int | None = None
    light_max_lux: int | None = None
    temp_min_c: float | None = None
    temp_max_c: float | None = None
    temp_min_winter_c: float | None = None
    humidity_min_pct: float | None = None
    humidity_max_pct: float | None = None
    watering_interval_days: int | None = None

    # 크기 / 개화기 / 결실기 (KFS_STD)
    size_raw: str | None = None
    height_min_cm: int | None = None
    height_max_cm: int | None = None
    flowering_period: str | None = None
    fruiting_period: str | None = None

    # 반려동물 안전 여부 (ASPCA). None = 자료 없음
    is_toxic: bool = False
    toxic_to_dogs: bool | None = None
    toxic_to_cats: bool | None = None
    toxic_to_horses: bool | None = None
    toxicity_info: str | None = None

    bug_info: str | None = None
    care_tips: str | None = None
    image_url: str | None = None

    # 돌보기 정보 화면이 카드별로 나눠 쓰는 원문 (plant_species.metadata 에서 꺼낸 값)
    water_cycle_label: str | None = None
    light_label: str | None = None
    fertilizer_info: str | None = None
    soil_info: str | None = None
    special_manage_info: str | None = None
    placement: str | None = None
    propagation: str | None = None
    growth_rate: str | None = None
    flower_color_names: str | None = None

    # 이 종의 값이 어느 소스에서 왔는지 — 화면 출처 표기용
    sources: list[str] = []

    model_config = {"from_attributes": True}


class PlantCreate(BaseModel):
    # 종 정보 (plant_species로 매핑)
    # speciesId 가 오면 그 종을 그대로 사용, 없으면 학명/국명으로 get-or-create (마스터 미수록 종)
    speciesId: int | None = None
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
    # 종 마스터의 돌봄 정보 — 돌보기 정보 화면이 이걸 읽는다.
    # 종이 연결되지 않은 개체이거나 마스터에 값이 없으면 None
    species: SpeciesDetail | None = None
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


class AffinityStatus(BaseModel):
    """애정도 현황 — 점수 규칙은 app/affinity.py 가 단일 출처다.

    앱이 점수표를 다시 정의하지 않도록 화면에 필요한 값(하트 수, 해금 단계,
    다음 단계까지의 기준)을 모두 담아 내려준다.
    """

    # 돌봄 상호작용으로 쌓인 점수 (max_score 에서 멈춘다)
    score: int
    # 0~5, 0.5 단위 — 하트 아이콘(빈/반/가득)으로 그릴 값
    hearts: float
    # 꽉 찬 하트 수 = 해금된 꾸미기 아이템 단계 (0~5)
    level: int
    max_score: int
    max_hearts: int
    points_per_heart: int
    # 다음 단계에 필요한 총점. 만점이면 null
    next_level_score: int | None = None
    # 현재 단계 → 다음 단계 진행률 (0~100). 만점이면 100
    level_progress_pct: int


class CareRecordCreated(CareRecordItem):
    """기록 저장 응답 — 이 기록으로 얻은 애정도를 함께 알려준다.

    affinity_awarded 가 0이면 이미 그날 같은 종류를 기록했거나 만점이라
    점수가 오르지 않았다는 뜻이다.
    """

    affinity_awarded: int
    affinity: AffinityStatus


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
    # 정원 목록에 필요한 최소 필드 — 미구현(캐릭터 이미지)은 앱에서 placeholder 처리
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

    # 애정도 — 정원 목록의 하트/호감도순 정렬용 (개체마다 조회하지 않도록 함께 싣는다).
    # 계산 규칙은 app/affinity.py 참조.
    affinity_score: int = 0
    affinity_hearts: float = 0
    affinity_level: int = 0

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
