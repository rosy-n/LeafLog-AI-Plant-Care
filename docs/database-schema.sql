-- =========================================================
-- 1. 사용자 / 설정
-- =========================================================

CREATE TABLE app_user (
    user_id             BIGSERIAL PRIMARY KEY,
    email               VARCHAR(255) UNIQUE NOT NULL,
    nickname            VARCHAR(100) NOT NULL,
    password_hash       TEXT,
    profile_image_url   TEXT,
    -- 미사용 — 코인/스토어를 없애고 아이템·배경을 애정도 해금으로 바꿨다(6번 섹션).
    -- 이미 만들어진 컬럼이라 남겨두지만 읽거나 쓰는 코드는 없다.
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

    -- 현재 홈 화면에 적용 중인 배경 아이템 (item_type = 'BACKGROUND').
    -- 배경은 홈 전체에 적용되는데 애정도는 개체별이라, 해금 판정은
    -- "유저의 개체 중 하나라도 item.required_level 이상"으로 본다.
    -- NULL 이면 기본 배경('home-bg')
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
    -- 학명 정규화 결과 — 저자명/변종표기 제거 + 소문자 (예: 'monstera deliciosa')
    -- 외부 4개 소스를 같은 종으로 묶는 매칭 키
    scientific_name_norm    VARCHAR(150),
    -- 과 familyKorNm
    family_name             VARCHAR(150),
    -- 속 genusKorNm
    genus_name              VARCHAR(100),
    category                VARCHAR(100),
    -- 자생지
    origin                 VARCHAR(255),
    -- 원산지 (nature.go.kr)
    origin_country          VARCHAR(255),
    -- 분포 (nature.go.kr)
    distribution            TEXT,
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

        -- 생육 적정 온도
    temp_min_c              NUMERIC(5,2),
    temp_max_c              NUMERIC(5,2),
    -- 겨울 최저온도 — 생육 적정 하한과 다른 값 (농진청 실내정원용 식물)
    temp_min_winter_c       NUMERIC(5,2),
    -- 습도
    humidity_min_pct        NUMERIC(5,2),
    humidity_max_pct        NUMERIC(5,2),

    -- 물주는 주기
    watering_interval_days  INTEGER,

    -- 꽃 피는 시기
        flowering_period VARCHAR(100),
        -- 결실기 (산림청 표준식물종정보)
        fruiting_period  VARCHAR(100),
        -- 꽃 색상
        flower_color_codes      TEXT[],

        -- 크기 — 원문 문자열("높이 2~3m") 보존 + 파싱값 병행
        size_raw                VARCHAR(200),
        height_min_cm           INTEGER,
        height_max_cm           INTEGER,

        -- 독성 여부 — 동물별 (ASPCA). NULL = 자료 없음, is_toxic 은 셋 중 하나라도 true 면 true
    is_toxic                BOOLEAN DEFAULT false,
    toxic_to_dogs           BOOLEAN,
    toxic_to_cats           BOOLEAN,
    toxic_to_horses         BOOLEAN,
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

-- 소스 매칭 키 — 정규화 학명은 종당 하나여야 함 (NULL 은 사용자 등록 유래 행이라 중복 허용)
CREATE UNIQUE INDEX uq_plant_species_sci_norm
    ON plant_species (scientific_name_norm)
    WHERE scientific_name_norm IS NOT NULL;

-- 식물 등록 시 종 이름 부분검색용
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_plant_species_name_ko_trgm
    ON plant_species USING gin (common_name_ko gin_trgm_ops);
CREATE INDEX idx_plant_species_name_en_trgm
    ON plant_species USING gin (common_name_en gin_trgm_ops);
CREATE INDEX idx_plant_species_sci_name_trgm
    ON plant_species USING gin (scientific_name gin_trgm_ops);

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

    -- 캐릭터 성격 — plant_character 를 만들지 않아 개체에 직접 둔다.
    -- 값은 app/persona_chat.py 의 페르소나 프롬프트 파일 키와 일치해야 한다
    -- (아래 plant_character.persona_type 의 이름과는 다름: DREAMY→DREAMER 등).
    -- DDL: apps/api/scripts/add-persona-column.sql
    persona             VARCHAR(30)
                        CHECK (persona IN (
                            'SUNSHINE', 'CHIC', 'RELAXED', 'TIMID',
                            'SAGE', 'PLAYFUL', 'DILIGENT', 'DREAMER'
                        )),

    -- 애정도(호감도) 점수 — 돌봄 상호작용(물주기/영양제/분갈이)마다 누적.
    -- 하트 수·꾸미기 아이템 해금 단계는 저장하지 않고 이 숫자에서 계산한다
    -- (점수표와 환산 규칙은 apps/api/app/affinity.py 가 단일 출처).
    -- plant_character.affinity_score 대신 여기에 둔다.
    -- DDL: apps/api/scripts/add-affinity-column.sql
    affinity_score      INTEGER NOT NULL DEFAULT 0 CHECK (affinity_score >= 0),

    -- 캐릭터를 문질러 애정도를 받은 마지막 날짜(한국 기준). 하루 1회 제한 판정용으로,
    -- 문지르기는 돌봄이 아니라서 care_record 를 남기지 않는다.
    -- DDL: apps/api/scripts/add-petting-column.sql
    last_petted_on      DATE,

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
-- 2-3. 종 정보 외부 데이터 소스
-- =========================================================
-- 4개 소스를 적재 시점(배치)에 plant_species 한 행으로 병합한다.
-- 앱/API 런타임은 plant_species 만 조회하고 아래 src_* 테이블은 읽지 않는다.
--   KFS_STD     산림청 표준식물종정보 (파일데이터 CSV)     → 크기, 개화기, 결실기, 과국명
--   RDA_INDOOR  농촌진흥청 실내정원용 식물 (OpenAPI)       → 광원, 물주기, 겨울최저온도, 습도, 난이도, 원산지
--   ASPCA       ASPCA Toxic and Non-Toxic Plants (HTML)   → 개/고양이/말 독성
--   NATURE_KNA  국가생물종지식정보시스템 (다운로드 파일 3종) → 국명/영문명/학명, 과
--
-- 필드 충돌 시 우선순위:
--   분류·이름                    → NATURE_KNA > KFS_STD > RDA_INDOOR
--   크기·개화기·결실기           → KFS_STD > RDA_INDOOR
--   광원·물주기·온습도·난이도    → RDA_INDOOR
--   원산지(origin_country)       → RDA_INDOOR (다른 소스에 없음)
--   독성                         → ASPCA > RDA_INDOOR
--
-- 현재 소스 없음: origin(자생지), distribution(분포), genus_name(속)
--   → 국립수목원 오픈API 키 발급 시 보강 대상

CREATE TABLE data_source (
    source_code   VARCHAR(30) PRIMARY KEY
                  CHECK (source_code IN ('KFS_STD', 'RDA_INDOOR', 'ASPCA', 'NATURE_KNA')),
    source_name   VARCHAR(200) NOT NULL,
    source_url    TEXT,
    license_note  TEXT,
    -- 낮을수록 우선 (분류 정보 병합 시 tie-break)
    priority      INTEGER NOT NULL DEFAULT 100,
    created_at    TIMESTAMP DEFAULT now()
);

-- 적재 실행 이력
CREATE TABLE ingest_run (
    run_id        BIGSERIAL PRIMARY KEY,
    source_code   VARCHAR(30) NOT NULL REFERENCES data_source(source_code),
    started_at    TIMESTAMP DEFAULT now(),
    finished_at   TIMESTAMP,
    status        VARCHAR(20) DEFAULT 'RUNNING'
                  CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    row_count     INTEGER,
    error_note    TEXT
);

-- 정본(plant_species) ↔ 소스 레코드 연결. 재적재 시 UPSERT 기준이 된다.
-- 연결이 하나도 없는 plant_species 행 = 사용자 등록 유래(마스터 미수록) 종
CREATE TABLE species_source_link (
    link_id       BIGSERIAL PRIMARY KEY,
    species_id    BIGINT NOT NULL REFERENCES plant_species(species_id) ON DELETE CASCADE,
    source_code   VARCHAR(30) NOT NULL REFERENCES data_source(source_code),
    -- 소스 고유 키: KFS_STD=국가표준식물목록 ID, RDA_INDOOR=cntntsNo, ASPCA=학명, NATURE_KNA=국명+학명
    source_key    VARCHAR(200) NOT NULL,
    match_method  VARCHAR(30) NOT NULL
                  CHECK (match_method IN ('SCI_NAME', 'KO_NAME', 'MANUAL')),
    confidence    NUMERIC(3,2),
    linked_at     TIMESTAMP DEFAULT now(),

    -- 소스 1건이 여러 종에 걸릴 수 있다. 예: ASPCA 는 종 단위 독성만 제공하므로
    -- Dracaena sanderiana 1건이 개운죽·금천죽·세레스 드라세나 세 품종에 모두 적용된다.
    UNIQUE (source_code, source_key, species_id)
);

-- 산림청 표준식물종정보 — 크기, 개화기, 결실기 (+ 과국명)
CREATE TABLE src_kfs_species (
    source_key      VARCHAR(200) PRIMARY KEY,
    ko_name         VARCHAR(200),
    sci_name        VARCHAR(300),
    sci_name_norm   VARCHAR(150),
    -- 과국명 — NATURE_KNA 미연동 상태에서 과 정보의 유일한 소스
    family_name     VARCHAR(150),
    size_raw        VARCHAR(200),
    flowering_period VARCHAR(100),
    fruiting_period VARCHAR(100),
    -- 원본 행 전체 보존 — 매핑 누락분을 재적재 없이 복구하기 위함
    payload         JSONB NOT NULL,
    ingest_run_id   BIGINT REFERENCES ingest_run(run_id) ON DELETE SET NULL,
    fetched_at      TIMESTAMP DEFAULT now()
);

-- 농촌진흥청 실내정원용 식물 — 코드값 원본 그대로 저장, 코드→값 변환은 병합 단계에서
CREATE TABLE src_rda_indoor (
    source_key      VARCHAR(200) PRIMARY KEY,   -- cntntsNo
    ko_name         VARCHAR(200),
    sci_name        VARCHAR(300),
    sci_name_norm   VARCHAR(150),
    light_code      VARCHAR(30),
    water_cycle_code VARCHAR(30),
    winter_temp_code VARCHAR(30),
    growth_temp_code VARCHAR(30),
    humidity_code   VARCHAR(30),
    manage_level_code VARCHAR(30),
    toxic_desc      TEXT,
    payload         JSONB NOT NULL,
    ingest_run_id   BIGINT REFERENCES ingest_run(run_id) ON DELETE SET NULL,
    fetched_at      TIMESTAMP DEFAULT now()
);

-- ASPCA 독성 목록 — 동물별 독성 여부
CREATE TABLE src_aspca_toxicity (
    source_key      VARCHAR(200) PRIMARY KEY,   -- 학명 원문
    common_name_en  VARCHAR(300),
    sci_name        VARCHAR(300),
    sci_name_norm   VARCHAR(150),
    toxic_to_dogs   BOOLEAN,
    toxic_to_cats   BOOLEAN,
    toxic_to_horses BOOLEAN,
    clinical_signs  TEXT,
    payload         JSONB NOT NULL,
    ingest_run_id   BIGINT REFERENCES ingest_run(run_id) ON DELETE SET NULL,
    fetched_at      TIMESTAMP DEFAULT now()
);

-- 국가생물종지식정보시스템 — 분류/이름의 정본 소스
-- 다운로드 파일 3종(자생/외래/재배)을 한 테이블에 모은다.
-- ID 컬럼이 없어 source_key 는 '<그룹>:<학명>|<국명>' 복합키를 쓴다.
-- 이 파일들에는 자생지/원산지/분포 컬럼이 없어 아래 3개는 비어 있다 (API 연동 시 보강).
CREATE TABLE src_nature_taxon (
    source_key      VARCHAR(200) PRIMARY KEY,
    ko_name         VARCHAR(200),
    en_name         VARCHAR(200),
    sci_name        VARCHAR(300),
    sci_name_norm   VARCHAR(150),
    family_name     VARCHAR(150),
    genus_name      VARCHAR(100),
    -- 자생 / 외래 / 재배 — 재배식물이 실내 관엽식물 커버리지의 핵심
    plant_group     VARCHAR(20)
                    CHECK (plant_group IN ('NATIVE', 'ALIEN', 'CULTIVATED')),
    native_habitat  VARCHAR(255),
    origin_country  VARCHAR(255),
    distribution    TEXT,
    payload         JSONB NOT NULL,
    ingest_run_id   BIGINT REFERENCES ingest_run(run_id) ON DELETE SET NULL,
    fetched_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_src_kfs_sci_norm     ON src_kfs_species (sci_name_norm);
CREATE INDEX idx_src_rda_sci_norm     ON src_rda_indoor (sci_name_norm);
CREATE INDEX idx_src_aspca_sci_norm   ON src_aspca_toxicity (sci_name_norm);
CREATE INDEX idx_src_nature_sci_norm  ON src_nature_taxon (sci_name_norm);

-- 학명 매칭 실패 → 사람이 확인할 큐
CREATE TABLE species_match_review (
    review_id     BIGSERIAL PRIMARY KEY,
    source_code   VARCHAR(30) NOT NULL REFERENCES data_source(source_code),
    source_key    VARCHAR(200) NOT NULL,
    raw_name      VARCHAR(300),
    -- 후보 목록 [{species_id, name, score}, ...]
    candidates    JSONB,
    resolved_species_id BIGINT REFERENCES plant_species(species_id) ON DELETE SET NULL,
    resolved_at   TIMESTAMP,
    created_at    TIMESTAMP DEFAULT now(),

    UNIQUE (source_code, source_key)
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
    -- 이 주기가 어디서 왔는지
    --   SPECIES: 종 마스터의 권장 주기를 복사
    --   DEFAULT: 종에 권장 주기 자료가 없어 앱 기본값(7일)을 넣음
    --   USER:    사용자가 직접 설정 — 다른 값으로 덮지 않는다
    -- 종 권장값이 있는 종은 전체의 1.1%(203/17,665)뿐이라 대부분 DEFAULT 로 시작한다.
    -- 화면에서 "자료 기반"과 "기본값"을 구분해 보여주기 위해 출처를 남긴다.
    interval_source VARCHAR(20) NOT NULL DEFAULT 'DEFAULT'
                    CHECK (interval_source IN ('SPECIES', 'DEFAULT', 'USER')),
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
--
-- 미구현 — 이 테이블은 아직 만들지 않았다.
-- persona_type → plant.persona, affinity_score → plant.affinity_score 로 옮겨
-- 개체 테이블에서 쓰고 있고, character_image_asset_id 는 media_asset
-- (asset_type='CHARACTER_IMAGE')이, speaking_style 은 app/persona_chat.py 의
-- 페르소나 프롬프트 파일이 대신한다. personality / emotion_state 는 아직 미사용.
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
-- 6. 아이템 / 꾸미기
-- =========================================================
-- 코인/스토어를 없애고 애정도 해금으로 바꾸면서 설계를 줄였다. 원래 있던
-- user_background(배경 보유)와 plant_accessory_unlock(개체별 해금 상태)은 만들지 않는다:
--   - "보유"는 코인 구매와 함께 사라졌다. 배경은 유저당 하나 고르는 것뿐이라
--     user_setting.home_background_item_id 컬럼으로 충분하다.
--   - 해금은 저장하지 않고 계산한다 — app/affinity.py 의
--     level_for_score(plant.affinity_score) >= item.required_level.
--     해금을 행으로 스냅샷하면 LEVEL_THRESHOLDS 를 조정했을 때 옛 해금 행이 남아
--     두 출처가 갈라진다(애정도 점수만 저장하는 원칙과 같은 이유).
-- DDL: apps/api/scripts/add-item-tables.sql

CREATE TABLE item (
    item_id          BIGSERIAL PRIMARY KEY,

    -- 앱 번들 이미지 맵(apps/mobile/src/data/decor.js)의 키.
    -- 이름/이미지가 바뀌어도 이 키는 고정이다.
    -- 아이템 이미지가 아직 번들이라 asset_id(media_asset) 대신 쓴다 —
    -- S3로 옮기면 asset_id 를 추가한다.
    item_key         VARCHAR(50) UNIQUE NOT NULL,

    item_name        VARCHAR(100) NOT NULL,

    item_type        VARCHAR(30) NOT NULL
                     CHECK (item_type IN ('BACKGROUND', 'ACCESSORY')),

    -- 해금에 필요한 꽉 찬 하트 수. 0이면 기본 제공.
    -- 점수(required_affinity_score)가 아니라 단계로 두는 이유:
    -- 점수를 넣으면 affinity.py 의 LEVEL_THRESHOLDS 표가 DB에도 복제된다.
    -- 상한 5는 affinity.MAX_HEARTS 와 같아야 한다.
    required_level   SMALLINT NOT NULL DEFAULT 0
                     CHECK (required_level BETWEEN 0 AND 5),

    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMP DEFAULT now(),
    updated_at       TIMESTAMP DEFAULT now()
);

-- 개체가 지금 착용 중인 액세서리 (해금 검증은 서버 코드가 한다)
-- 현재 UI는 슬롯이 하나뿐이라 position_key 는 'HEAD' 만 쓰지만,
-- 슬롯이 늘어도 스키마는 그대로 쓸 수 있다.
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