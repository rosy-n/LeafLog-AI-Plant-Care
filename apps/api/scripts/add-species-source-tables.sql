-- docs/database-schema.sql 의 "2-3. 종 정보 외부 데이터 소스" 정의를 그대로 옮긴 것
-- + 기존 plant_species 에 추가된 컬럼 반영
-- 슈퍼유저(postgres)로 실행:
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-species-source-tables.sql
\connect leaflog

-- ---------------------------------------------------------
-- 1) plant_species 컬럼 추가
-- ---------------------------------------------------------
ALTER TABLE plant_species
    ADD COLUMN IF NOT EXISTS scientific_name_norm VARCHAR(150),
    ADD COLUMN IF NOT EXISTS origin_country       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS distribution         TEXT,
    ADD COLUMN IF NOT EXISTS temp_min_winter_c    NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS fruiting_period      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS size_raw             VARCHAR(200),
    ADD COLUMN IF NOT EXISTS height_min_cm        INTEGER,
    ADD COLUMN IF NOT EXISTS height_max_cm        INTEGER,
    ADD COLUMN IF NOT EXISTS toxic_to_dogs        BOOLEAN,
    ADD COLUMN IF NOT EXISTS toxic_to_cats        BOOLEAN,
    ADD COLUMN IF NOT EXISTS toxic_to_horses      BOOLEAN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_plant_species_sci_norm
    ON plant_species (scientific_name_norm)
    WHERE scientific_name_norm IS NOT NULL;

-- 종 이름 부분검색 (GET /api/species?q=)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_plant_species_name_ko_trgm
    ON plant_species USING gin (common_name_ko gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_plant_species_name_en_trgm
    ON plant_species USING gin (common_name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_plant_species_sci_name_trgm
    ON plant_species USING gin (scientific_name gin_trgm_ops);

-- ---------------------------------------------------------
-- 2) 소스 카탈로그 / 적재 이력 / 연결
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_source (
    source_code   VARCHAR(30) PRIMARY KEY
                  CHECK (source_code IN ('KFS_STD', 'RDA_INDOOR', 'ASPCA', 'NATURE_KNA')),
    source_name   VARCHAR(200) NOT NULL,
    source_url    TEXT,
    license_note  TEXT,
    priority      INTEGER NOT NULL DEFAULT 100,
    created_at    TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_run (
    run_id        BIGSERIAL PRIMARY KEY,
    source_code   VARCHAR(30) NOT NULL REFERENCES data_source(source_code),
    started_at    TIMESTAMP DEFAULT now(),
    finished_at   TIMESTAMP,
    status        VARCHAR(20) DEFAULT 'RUNNING'
                  CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    row_count     INTEGER,
    error_note    TEXT
);

CREATE TABLE IF NOT EXISTS species_source_link (
    link_id       BIGSERIAL PRIMARY KEY,
    species_id    BIGINT NOT NULL REFERENCES plant_species(species_id) ON DELETE CASCADE,
    source_code   VARCHAR(30) NOT NULL REFERENCES data_source(source_code),
    source_key    VARCHAR(200) NOT NULL,
    match_method  VARCHAR(30) NOT NULL
                  CHECK (match_method IN ('SCI_NAME', 'KO_NAME', 'MANUAL')),
    confidence    NUMERIC(3,2),
    linked_at     TIMESTAMP DEFAULT now(),

    -- 소스 1건이 여러 종에 걸릴 수 있다 (ASPCA 의 종 단위 독성 → 품종별 행)
    UNIQUE (source_code, source_key, species_id)
);

CREATE INDEX IF NOT EXISTS idx_species_source_link_species
    ON species_source_link (species_id);

-- 이 스크립트의 이전 버전은 UNIQUE (source_code, source_key) 였다.
-- 이미 그 버전으로 만들어진 DB 도 여기서 3컬럼 제약으로 교체된다.
ALTER TABLE species_source_link
    DROP CONSTRAINT IF EXISTS species_source_link_source_code_source_key_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'species_source_link_source_code_source_key_species_id_key'
    ) THEN
        ALTER TABLE species_source_link
            ADD CONSTRAINT species_source_link_source_code_source_key_species_id_key
            UNIQUE (source_code, source_key, species_id);
    END IF;
END
$$;

-- ---------------------------------------------------------
-- 3) 소스 원본 테이블
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS src_kfs_species (
    source_key      VARCHAR(200) PRIMARY KEY,
    ko_name         VARCHAR(200),
    sci_name        VARCHAR(300),
    sci_name_norm   VARCHAR(150),
    -- 과국명 — NATURE_KNA 미연동 상태에서 과 정보의 유일한 소스
    family_name     VARCHAR(150),
    size_raw        VARCHAR(200),
    flowering_period VARCHAR(100),
    fruiting_period VARCHAR(100),
    payload         JSONB NOT NULL,
    ingest_run_id   BIGINT REFERENCES ingest_run(run_id) ON DELETE SET NULL,
    fetched_at      TIMESTAMP DEFAULT now()
);

-- 이 스크립트의 이전 버전에는 family_name 이 없었다
ALTER TABLE src_kfs_species ADD COLUMN IF NOT EXISTS family_name VARCHAR(150);

CREATE TABLE IF NOT EXISTS src_rda_indoor (
    source_key      VARCHAR(200) PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS src_aspca_toxicity (
    source_key      VARCHAR(200) PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS src_nature_taxon (
    source_key      VARCHAR(200) PRIMARY KEY,
    ko_name         VARCHAR(200),
    en_name         VARCHAR(200),
    sci_name        VARCHAR(300),
    sci_name_norm   VARCHAR(150),
    family_name     VARCHAR(150),
    genus_name      VARCHAR(100),
    native_habitat  VARCHAR(255),
    origin_country  VARCHAR(255),
    distribution    TEXT,
    payload         JSONB NOT NULL,
    ingest_run_id   BIGINT REFERENCES ingest_run(run_id) ON DELETE SET NULL,
    fetched_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_src_kfs_sci_norm    ON src_kfs_species (sci_name_norm);
CREATE INDEX IF NOT EXISTS idx_src_rda_sci_norm    ON src_rda_indoor (sci_name_norm);
CREATE INDEX IF NOT EXISTS idx_src_aspca_sci_norm  ON src_aspca_toxicity (sci_name_norm);
CREATE INDEX IF NOT EXISTS idx_src_nature_sci_norm ON src_nature_taxon (sci_name_norm);

CREATE TABLE IF NOT EXISTS species_match_review (
    review_id     BIGSERIAL PRIMARY KEY,
    source_code   VARCHAR(30) NOT NULL REFERENCES data_source(source_code),
    source_key    VARCHAR(200) NOT NULL,
    raw_name      VARCHAR(300),
    candidates    JSONB,
    resolved_species_id BIGINT REFERENCES plant_species(species_id) ON DELETE SET NULL,
    resolved_at   TIMESTAMP,
    created_at    TIMESTAMP DEFAULT now(),

    UNIQUE (source_code, source_key)
);

-- ---------------------------------------------------------
-- 4) 소스 카탈로그 시드
-- ---------------------------------------------------------
INSERT INTO data_source (source_code, source_name, source_url, license_note, priority) VALUES
    ('NATURE_KNA', '국가생물종지식정보시스템 (국립수목원)',
     'https://www.nature.go.kr/main/Main.do',
     '공공누리 — 출처 표시 필요', 10),
    ('KFS_STD', '산림청_표준식물종정보',
     'https://www.data.go.kr/data/15092915/fileData.do',
     '공공누리 — 출처 표시 필요', 20),
    ('RDA_INDOOR', '농촌진흥청_실내정원용 식물',
     'https://www.data.go.kr/data/15059042/openapi.do',
     '공공누리 — 인증키 필요', 30),
    ('ASPCA', 'ASPCA Toxic and Non-Toxic Plants',
     'https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants',
     '비영리 단체 웹 자료 — 출처 표시, 재배포 주의', 40)
ON CONFLICT (source_code) DO NOTHING;