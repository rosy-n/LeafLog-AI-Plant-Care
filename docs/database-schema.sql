-- =========================================================
-- 1. 사용자 / 설정
-- =========================================================

CREATE TABLE app_user (
    user_id             BIGSERIAL PRIMARY KEY,
    email               VARCHAR(255) UNIQUE NOT NULL,
    nickname            VARCHAR(100) NOT NULL,
    password_hash       TEXT,
    profile_image_url   TEXT,
    coin_balance       INTEGER NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
    role                VARCHAR(30) DEFAULT 'USER'
                        CHECK (role IN ('USER', 'ADMIN')),
    -- 계정 상태
    -- ACTIVE    : 정상
    -- INACTIVE  : 휴면 (장기 미접속)
    -- DELETED   : 탈퇴 (소프트 삭제, 실제 데이터는 보존)
    status              VARCHAR(30) DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE', 'DELETED')),
    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now()
);

-- 생성 시 item 테이블 이후에 생성해야 함
CREATE TABLE user_setting (
    -- 설정 고유 식별자, 자동 증가
    setting_id            BIGSERIAL    PRIMARY KEY,

    -- 사용자 1명당 설정 1개 보장 (UNIQUE)
    -- 사용자 탈퇴 시 설정도 함께 삭제 (ON DELETE CASCADE)
    user_id               BIGINT       UNIQUE NOT NULL
                          REFERENCES app_user(user_id) ON DELETE CASCADE,

    -- 전체 푸시 알림 on/off 마스터 스위치
    -- false이면 아래 개별 알림 설정과 무관하게 알림 전체 차단
    push_enabled          BOOLEAN      DEFAULT true,

    -- 물주기 · 분갈이 · 비료 등 관리 일정 알림 on/off
    care_alert_enabled    BOOLEAN      DEFAULT true,

    -- 기온 · 습도 등 날씨 기반 식물 관리 알림 on/off
    -- ex. "오늘 건조하니 물을 더 주세요"
    weather_alert_enabled BOOLEAN      DEFAULT true,

    -- 날씨 알림 기준 위치 (시/구 단위 텍스트)
    -- ex. "서울 마포구"
    -- null이면 날씨 알림 비활성
    default_location      VARCHAR(255),

    -- 현재 홈 화면에 적용 중인 배경 아이템
        home_background_item_id BIGINT
            REFERENCES item(item_id) ON DELETE SET NULL,

    created_at            TIMESTAMP    DEFAULT now(),
    updated_at            TIMESTAMP    DEFAULT now()
);

-- =========================================================
-- 2-2. 식물 기본 정보
-- =========================================================

CREATE TABLE plant_species (
    species_id              BIGSERIAL PRIMARY KEY,
    common_name_ko          VARCHAR(100) NOT NULL,
    common_name_en          VARCHAR(100),
    -- 학명
    scientific_name         VARCHAR(150),
    -- 과 familyKorNm
    family_name             VARCHAR(150),
    -- 속 genusKorNm
    genus_name              VARCHAR(100),
    category                VARCHAR(100),
    -- 자생지
    origin                 VARCHAR(255),
    -- 특징
    description             TEXT,

    difficulty              VARCHAR(30) DEFAULT 'UNKNOWN'
                            CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD', 'UNKNOWN')),

        -- 요구 광량
        -- HIGH: 양지, MEDIUM: 반양지/반음지, LOW: 음지
    light_level             VARCHAR(30) DEFAULT 'UNKNOWN'
                            CHECK (light_level IN ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN')),
    light_min_lux           INTEGER,
    light_max_lux           INTEGER,

        -- 온도
    temp_min_c              NUMERIC(5,2),
    temp_max_c              NUMERIC(5,2),
    -- 습도
    humidity_min_pct        NUMERIC(5,2),
    humidity_max_pct        NUMERIC(5,2),

    -- 물주는 주기
    watering_interval_days  INTEGER,

    -- 꽃 피는 시기
        flowering_period VARCHAR(100),
        -- 꽃 색상
        flower_color_codes      TEXT[],

        -- 독성 여부
    is_toxic                BOOLEAN DEFAULT false,
    toxicity_info           TEXT,
    -- 병충해 정보
    bugInfo               TEXT,
    -- 보호/관리 설명
    care_tips            TEXT,
    -- 대표이미지 제공 API 찾아보기
    image_url               TEXT,
    source_url              TEXT,
    -- useMthdDesc
    metadata                JSONB,

    created_at              TIMESTAMP DEFAULT now(),
    updated_at              TIMESTAMP DEFAULT now()
);

--=======================
--2-1. 반려식물 프로필
--=======================

CREATE TABLE plant (
    plant_id            BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    species_id          BIGINT REFERENCES plant_species(species_id) ON DELETE SET NULL,

    nickname            VARCHAR(100) NOT NULL,
      location_name     VARCHAR(100)
                      CHECK (location_name IN (
                          'LIVING_ROOM', 'BEDROOM', 'BALCONY', 'KITCHEN', 'OFFICE'
                      )),

    light_condition   VARCHAR(30)
                      CHECK (light_condition IN (
                          'DIRECT', 'BRIGHT', 'INDIRECT', 'LOW'
                      )),

    pot_type            VARCHAR(100),
    pot_size            VARCHAR(100),
    soil_type           TEXT,
    height              VARCHAR(100),

    status              VARCHAR(30) DEFAULT 'ALIVE'
                        CHECK (status IN ('ALIVE', 'SICK', 'DEAD')),
    is_favorite      BOOLEAN DEFAULT false,
    started_at          DATE,
    dead_at             TIMESTAMP,

    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE media_asset (
    asset_id        BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
    plant_id        BIGINT REFERENCES plant(plant_id) ON DELETE SET NULL,

        -- 최상위 저장 공간 이름
    bucket_name     VARCHAR(255),
    -- 저장소 안의 파일 위치
    object_key      TEXT NOT NULL,
    file_url        TEXT NOT NULL,
    asset_type      VARCHAR(50) NOT NULL
                                    CHECK (asset_type IN (
                            'PLANT_PHOTO',
                            'GROWTH_DIARY_PHOTO',
                            'CHARACTER_IMAGE',
                            'DIAGNOSIS_PHOTO',
                            'DIAGNOSIS_MASKED',
                            'ITEM_IMAGE',
                            'RAG_REFERENCE_IMAGE',
                            'PROFILE_IMAGE',
                            'OTHER'
                        )),
    -- 프로그램이 자동으로 읽어서 채우는 값
    -- 파일 형식 및 사이즈
    mime_type       VARCHAR(100),
    file_size       BIGINT,
    width           INTEGER,
    height          INTEGER,

    -- 파일 무결성 검증용 해시값 (SHA-256 등)
    -- 동일 파일 중복 업로드 감지에 활용
    checksum        VARCHAR(128),

    created_at      TIMESTAMP DEFAULT now(),

    UNIQUE (object_key)
);


-- =========================================================
-- 3. 돌봄 일정 / 돌봄 기록 / 성장일지
-- =========================================================

-- 앞으로 언제 관리해야 하는지에 대한 테이블
CREATE TABLE care_schedule (
    schedule_id     BIGSERIAL PRIMARY KEY,
    plant_id        BIGINT NOT NULL REFERENCES plant(plant_id) ON DELETE CASCADE,

    care_type       VARCHAR(30) NOT NULL
                    CHECK (care_type IN ('WATERING', 'FERTILIZING', 'REPOTTING')),

    interval_days   INTEGER NOT NULL CHECK (interval_days > 0),
    next_due_date   DATE NOT NULL,

    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now(),

    UNIQUE (plant_id, care_type),
    UNIQUE (schedule_id, plant_id, care_type)
);

CREATE TABLE care_record (
    care_record_id  BIGSERIAL PRIMARY KEY,
    plant_id        BIGINT NOT NULL REFERENCES plant(plant_id) ON DELETE CASCADE,
    schedule_id     BIGINT,

    care_type       VARCHAR(30) NOT NULL
                    CHECK (care_type IN ('WATERING', 'FERTILIZING', 'REPOTTING')),

    scheduled_at    TIMESTAMP,
    completed_at    TIMESTAMP DEFAULT now(),
    note            TEXT,
    asset_id        BIGINT REFERENCES media_asset(asset_id) ON DELETE SET NULL,

    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now(),

    FOREIGN KEY (schedule_id, plant_id, care_type)
        REFERENCES care_schedule(schedule_id, plant_id, care_type)
        ON DELETE SET NULL (schedule_id)
);

CREATE TABLE growth_diary (
    diary_id            BIGSERIAL PRIMARY KEY,

    -- 현재 모든 사용자의 반려 식물들이 같은 id 체계를 사용
    user_id              BIGINT NOT NULL
                         REFERENCES app_user(user_id)
                         ON DELETE CASCADE,

    -- 일지 작성 기준 날짜
    -- 하루 1회 제한을 위해 별도 DATE 컬럼 사용
    diary_date          DATE NOT NULL,

    -- 정해진 형식에 따라 작성된 텍스트 한 뭉치
    content             TEXT NOT NULL,

    -- 일지 양식 버전
    -- 나중에 질문/항목 구성이 바뀔 수 있으므로 유지
    diary_format_version VARCHAR(20) DEFAULT 'v1',

    metadata            JSONB,

    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now(),

    -- 사용자는 하루에 일지 1개만 작성 가능
    UNIQUE (user_id, diary_date)
);

-- 일지별로 최대 3장의 사진 첨부
CREATE TABLE growth_diary_photo (
    diary_photo_id      BIGSERIAL PRIMARY KEY,

    diary_id            BIGINT NOT NULL
                        REFERENCES growth_diary(diary_id)
                        ON DELETE CASCADE,

    asset_id            BIGINT NOT NULL
                        REFERENCES media_asset(asset_id)
                        ON DELETE CASCADE,
    tagged_plant_id     BIGINT REFERENCES plant(plant_id) ON DELETE SET NULL,

    -- 1, 2, 3번 슬롯만 허용
    photo_order         INTEGER NOT NULL
                        CHECK (photo_order BETWEEN 1 AND 3),

    created_at          TIMESTAMP DEFAULT now(),

    -- 같은 일지에서 같은 순서의 사진은 1개만 가능
    UNIQUE (diary_id, photo_order),

    -- 같은 일지에 같은 사진 중복 첨부 방지
    UNIQUE (diary_id, asset_id)
);

-- =========================================================
-- 4. AI 대화
-- =========================================================


CREATE TABLE chat_session (
    session_id     BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    plant_id       BIGINT REFERENCES plant(plant_id) ON DELETE SET NULL,

    session_type   VARCHAR(30) DEFAULT 'PERSONA'
                   CHECK (session_type IN ('PERSONA', 'CONSULTATION', 'DIAGNOSIS')),
    title          VARCHAR(200),
    summary        TEXT,
    started_at     TIMESTAMP DEFAULT now(),
    ended_at       TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT now()
);

CREATE TABLE chat_message (
    message_id    BIGSERIAL PRIMARY KEY,
    session_id    BIGINT NOT NULL REFERENCES chat_session(session_id) ON DELETE CASCADE,

        -- USER: 앱 사용자가 보낸 메시지, ASSISTANT: AI가 답변한 메시지
    role          VARCHAR(20) NOT NULL
                  CHECK (role IN ('USER', 'ASSISTANT')),
    content       TEXT NOT NULL,
    token_count   INTEGER,

    created_at    TIMESTAMP DEFAULT now()
);

-- =========================================================
-- AI 식물 캐릭터
-- =========================================================
CREATE TABLE plant_character (
    character_id              BIGSERIAL PRIMARY KEY,
    plant_id                  BIGINT UNIQUE NOT NULL REFERENCES plant(plant_id) ON DELETE CASCADE,
    character_image_asset_id  BIGINT NOT NULL
                              REFERENCES media_asset(asset_id) ON DELETE RESTRICT,

    character_name            VARCHAR(100) NOT NULL,

    -- 세 컬럼의 조합에 따라 성격 부여
    -- 귀여움, 차분함, 활발함 등 제시되는 선택지
    persona_type VARCHAR(50) CHECK (persona_type IN (
                                'SUNNY',       -- 햇살형
                            'PRIM',        -- 새침형
                            'EASYGOING',   -- 느긋형
                            'SHY',         -- 소심형
                            'WISE',        -- 현자형
                            'PLAYFUL',     -- 장난꾸러기형
                            'DILIGENT',    -- 성실형
                            'DREAMY'       -- 몽상가형
                        )),
    -- 페르소나 타입에 대한 자세한 설명
    speaking_style            TEXT,

    -- '낯을 조금 가리지만, 친해지면 애교가 많고 사용자를 잘 따른다' 등
    -- 사용자가 입력하는 세부 성격
    personality               TEXT,

        -- neutral / happy / sad / thirsty / sick 등
    emotion_state             VARCHAR(50) DEFAULT 'NEUTRAL',
    -- 호감도 점수
    affinity_score            INTEGER DEFAULT 0,

    created_at                TIMESTAMP DEFAULT now(),
    updated_at                TIMESTAMP DEFAULT now()
);


-- =========================================================
-- 6. 아이템 / 인벤토리 / 간단 보상
-- =========================================================

CREATE TABLE item (
    item_id          BIGSERIAL PRIMARY KEY,
    item_name        VARCHAR(100) NOT NULL,

    item_type        VARCHAR(30) NOT NULL
                     CHECK (item_type IN ('BACKGROUND', 'ACCESSORY')),

    description      TEXT,

    -- PURCHASE: 코인으로 구매
    -- AFFINITY: 호감도 조건으로 해금
    -- DEFAULT: 기본 제공
    unlock_type      VARCHAR(30) NOT NULL DEFAULT 'PURCHASE'
                     CHECK (unlock_type IN ('PURCHASE', 'AFFINITY', 'DEFAULT')),

        -- 필요한 호감도 점수
    required_affinity_score INTEGER,

    price_coin       INTEGER DEFAULT 0 CHECK (price_coin >= 0),

    asset_id         BIGINT REFERENCES media_asset(asset_id) ON DELETE SET NULL,

    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMP DEFAULT now(),
    updated_at       TIMESTAMP DEFAULT now(),

    CHECK (
        (
            item_type = 'BACKGROUND'
            AND unlock_type = 'DEFAULT'
            AND required_affinity_score IS NULL
            AND price_coin = 0
        )
        OR
        (
            item_type = 'BACKGROUND'
            AND unlock_type = 'PURCHASE'
            AND required_affinity_score IS NULL
            AND price_coin > 0
        )
        OR
        (
            item_type = 'ACCESSORY'
            AND unlock_type = 'AFFINITY'
            AND required_affinity_score IS NOT NULL
            AND required_affinity_score >= 0
            AND price_coin = 0
        )
    )
);

-- 배경 아이템 보유용
-- 액세서리가 들어가지 않도록 앱 코드에서 막아야 함
CREATE TABLE user_background (
    inventory_id    BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    item_id         BIGINT NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,

    acquired_at      TIMESTAMP DEFAULT now(),

    UNIQUE (user_id, item_id)
);

-- 식물별 액세서리 해금 상태를 저장
CREATE TABLE plant_accessory_unlock (
    unlock_id       BIGSERIAL PRIMARY KEY,

    plant_id        BIGINT NOT NULL
                    REFERENCES plant(plant_id) ON DELETE CASCADE,

    item_id         BIGINT NOT NULL
                    REFERENCES item(item_id) ON DELETE CASCADE,

    unlocked_at     TIMESTAMP DEFAULT now(),

    UNIQUE (plant_id, item_id)
);

-- 해금되지 않은 액세서리도 착용 가능 -> 코드로 제한해야 함
CREATE TABLE plant_decoration (
    decoration_id    BIGSERIAL PRIMARY KEY,
    plant_id         BIGINT NOT NULL REFERENCES plant(plant_id) ON DELETE CASCADE,
    item_id          BIGINT NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,
    -- 이 식물의 HEAD 위치에는 리본을 장착
    position_key     VARCHAR(50) NOT NULL,
    applied_at       TIMESTAMP DEFAULT now(),

    UNIQUE (plant_id, position_key)
);


-- 3시간에 한 번씩 저장
-- 공공데이터포털 기상청 단기예보 API(기온,습도,강수량,하늘상태,풍속)
-- 에어코리아 대기오염정보 API(미세먼지)
-- Open-Meteo (회원가입 없이 빠른 테스트 가능, 온습도 및 미세먼지)
CREATE TABLE weather_log (
    weather_log_id BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    plant_id       BIGINT REFERENCES plant(plant_id) ON DELETE SET NULL,

    location_name  VARCHAR(255),
    observed_at    TIMESTAMP DEFAULT now(),

    temperature_c  NUMERIC(5,2),
    humidity_pct   NUMERIC(5,2),
    pm10           NUMERIC(6,2),
    pm25           NUMERIC(6,2),

    weather_status VARCHAR(50),
    air_quality_status VARCHAR(50),

    source_api     VARCHAR(50),
    raw_data       JSONB,

    created_at     TIMESTAMP DEFAULT now()
);

-- =========================================================
-- 7. 알림
-- =========================================================
-- 사용자 스마트폰에 푸시 알림을 보내기 위해 필요한 기기 토큰을 저장하는 테이블
CREATE TABLE push_token (
    push_token_id   BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    platform        VARCHAR(30),
    token           TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now(),

    UNIQUE (token)
);

-- 알림 내용과 발송 상태를 저장하는 테이블
CREATE TABLE notification (
    notification_id     BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    -- 날씨 알림 등에는 null 로 두면 됨
    plant_id            BIGINT REFERENCES plant(plant_id) ON DELETE SET NULL,

    notification_type   VARCHAR(50),
    title               VARCHAR(255) NOT NULL,
    body                TEXT,
    scheduled_at        TIMESTAMP,
    sent_at             TIMESTAMP,
    read_at             TIMESTAMP,
    status              VARCHAR(30) DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    -- 알림을 눌렀을 때 이동할 화면 저장
    metadata            JSONB,

    created_at          TIMESTAMP DEFAULT now()
);