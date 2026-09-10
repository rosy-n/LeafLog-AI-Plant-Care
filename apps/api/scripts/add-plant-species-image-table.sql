-- 종 사진(Wikimedia Commons, 최대 4장) 저장용 plant_species_image 테이블을 추가.
-- 배치로 미리 채우지 않는다 — 등록 화면에서 GET /api/species/{id}가 그 종을 처음 조회할
-- 때 app/wikimedia.py가 그 자리에서 채운다 (app/main.py의 _ensure_species_images).
--
-- 이 DB에 먼저 시험 삼아 반영했던 이전 설계(plant_species.image_urls 배열 컬럼 +
-- src_wikimedia_images 배치 스테이징 테이블)를 함께 되돌린다 — 실제로 쓰지 않는 상태였으니
-- 데이터 손실 없음.
--
-- 재실행 안전.
--   PGPASSWORD='...' psql -h <호스트> -U postgres -d leaflog -v ON_ERROR_STOP=1 \
--       -f apps/api/scripts/add-plant-species-image-table.sql
\connect leaflog

-- 되돌리기 — 이전 설계에서 쓰던 것들
DROP TABLE IF EXISTS src_wikimedia_images;
ALTER TABLE plant_species DROP COLUMN IF EXISTS image_urls;

-- 배치 스크립트가 중단되기 전에 남긴 흔적 — ingest_run이 data_source를 참조하므로 먼저 지운다
DELETE FROM ingest_run WHERE source_code = 'WIKIMEDIA';
DELETE FROM data_source WHERE source_code = 'WIKIMEDIA';

ALTER TABLE data_source DROP CONSTRAINT IF EXISTS data_source_source_code_check;
ALTER TABLE data_source
    ADD CONSTRAINT data_source_source_code_check
    CHECK (source_code IN ('KFS_STD', 'RDA_INDOOR', 'ASPCA', 'NATURE_KNA'));

-- 새 설계
CREATE TABLE IF NOT EXISTS plant_species_image (
    image_id      BIGSERIAL PRIMARY KEY,
    species_id    BIGINT NOT NULL REFERENCES plant_species(species_id) ON DELETE CASCADE,
    image_url     TEXT NOT NULL,
    sort_order    SMALLINT NOT NULL DEFAULT 0,
    artist        TEXT,
    license       VARCHAR(100),
    source_page   TEXT,
    fetched_at    TIMESTAMP DEFAULT now(),

    UNIQUE (species_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_plant_species_image_species_id ON plant_species_image (species_id);
