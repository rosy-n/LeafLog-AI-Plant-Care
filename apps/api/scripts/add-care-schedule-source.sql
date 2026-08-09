-- docs/database-schema.sql 의 care_schedule.interval_source 정의를 그대로 옮긴 것
-- 슈퍼유저(postgres)로 실행:
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-care-schedule-source.sql
-- 재실행 안전.
\connect leaflog

-- 물주기 주기의 출처 — SPECIES(종 권장값) / DEFAULT(자료 없어 기본값) / USER(사용자 설정)
ALTER TABLE care_schedule
    ADD COLUMN IF NOT EXISTS interval_source VARCHAR(20) NOT NULL DEFAULT 'DEFAULT';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_care_schedule_interval_source'
    ) THEN
        ALTER TABLE care_schedule
            ADD CONSTRAINT ck_care_schedule_interval_source
            CHECK (interval_source IN ('SPECIES', 'DEFAULT', 'USER'));
    END IF;
END
$$;