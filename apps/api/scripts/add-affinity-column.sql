-- 애정도(호감도) 점수를 plant 테이블에 저장.
-- docs/database-schema.sql 은 plant_character.affinity_score 로 설계돼 있으나
-- 그 테이블은 아직 만들지 않았고(character_image_asset_id 가 NOT NULL) persona 와
-- 마찬가지로 plant 에 둔다. 하트/단계 환산은 저장하지 않고 app/affinity.py 가 계산한다.
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-affinity-column.sql
-- 원격 DB(.env 의 DATABASE_URL 이 localhost 가 아닐 때)는 -h <호스트> 를 함께 준다.
-- 재실행 안전.
\connect leaflog

ALTER TABLE plant
    ADD COLUMN IF NOT EXISTS affinity_score INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_plant_affinity_score'
    ) THEN
        ALTER TABLE plant
            ADD CONSTRAINT ck_plant_affinity_score CHECK (affinity_score >= 0);
    END IF;
END
$$;

-- 이 컬럼 도입 전에 쌓인 care_record 로 초기 점수를 채우려면 이어서 실행:
--   cd apps/api && ./.venv/Scripts/python.exe scripts/backfill-affinity.py
-- (점수표를 SQL에 다시 적지 않기 위해 app/affinity.py 를 그대로 쓰는 스크립트로 분리했다)