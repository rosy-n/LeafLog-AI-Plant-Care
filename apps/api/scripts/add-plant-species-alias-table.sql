-- 이 파일은 UTF-8. Windows psql 은 콘솔 코드페이지(UHC)로 읽어 한글 주석에서 깨지므로
-- 여기서 클라이언트 인코딩을 고정한다 (PGCLIENTENCODING=UTF8 로 넘겨도 된다).
\encoding UTF8

-- 국명 검색 보강용 plant_species_alias 테이블을 추가.
-- 사용자가 입력하는 유통명/원예명(테이블야자·금전수 등)을 종에 연결해 두는 표로,
-- 마스터 국명(common_name_ko)만으로는 안 잡히는 한글 검색어를 받아낸다.
--
-- 값은 위키에서 온다 (ko.wikipedia 표제어·넘겨주기 + Wikidata 한국어 라벨·별칭).
-- plant_species_image 와 같은 결로 배치 병합 대상이 아니다 — data_source 에 넣지 않는다.
--   1) scripts/ingest/wiki_ko_alias.py 로 미리 적재 (돌봄 정보 보유 종 우선)
--   2) 못 맞춘 검색어는 GET /api/species 가 그 자리에서 채운다 (app/wiki_names.py)
--
-- 정의는 docs/database-schema.sql 2-2 절과 같다. 재실행 안전.
--   PGPASSWORD='...' PGCLIENTENCODING=UTF8 psql -h <호스트> -U postgres -d leaflog \
--       -v ON_ERROR_STOP=1 -f apps/api/scripts/add-plant-species-alias-table.sql
\connect leaflog
\encoding UTF8

CREATE TABLE IF NOT EXISTS plant_species_alias (
    alias_id      BIGSERIAL PRIMARY KEY,
    -- NULL = 위키에서도 못 찾은 검색어. 같은 말을 매번 위키에 되묻지 않기 위한 음성 캐시
    species_id    BIGINT REFERENCES plant_species(species_id) ON DELETE CASCADE,
    alias         VARCHAR(150) NOT NULL,
    -- 검색 키 — 소문자 + 공백/가운뎃점 제거
    alias_norm    VARCHAR(150) NOT NULL,
    source        VARCHAR(30) NOT NULL
                  CHECK (source IN ('WIKI_KO_LABEL', 'WIKI_KO_ALIAS', 'WIKI_KO_REDIRECT', 'WIKI_KO_QUERY')),
    fetched_at    TIMESTAMP DEFAULT now(),

    UNIQUE (species_id, alias_norm)
);

-- 음성 캐시(species_id IS NULL)는 검색어당 한 행만
CREATE UNIQUE INDEX IF NOT EXISTS uq_plant_species_alias_miss
    ON plant_species_alias (alias_norm)
    WHERE species_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_plant_species_alias_norm
    ON plant_species_alias (alias_norm);

-- 오타/표기 변형 유사도 검색용 ('떡갈고무나무' → '떡갈잎고무나무').
-- pg_trgm 은 plant_species 이름 인덱스에서 이미 쓰고 있다.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_plant_species_alias_trgm
    ON plant_species_alias USING gin (alias gin_trgm_ops);
