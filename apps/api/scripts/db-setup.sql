-- LeafLog DB 앱 전용 role 셋업
-- 슈퍼유저(postgres)로 실행:
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/db-setup.sql
--
-- 전제: 데이터베이스 leaflog 와 4개 테이블(app_user, media_asset, plant, plant_species)은 이미 생성됨.

-- 1) 앱 role 생성 (없을 때만) — .env 의 DATABASE_URL 과 동일한 계정/비밀번호
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leaflog_user') THEN
        CREATE ROLE leaflog_user LOGIN PASSWORD 'Leaflog1234!';
    ELSE
        ALTER ROLE leaflog_user LOGIN PASSWORD 'Leaflog1234!';
    END IF;
END
$$;

-- 2) leaflog DB 안에서 권한 부여 (\connect 로 대상 DB 전환)
\connect leaflog

GRANT CONNECT ON DATABASE leaflog TO leaflog_user;
GRANT USAGE ON SCHEMA public TO leaflog_user;

-- 기존 테이블/시퀀스 권한
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leaflog_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO leaflog_user;

-- 앞으로 만들어질 테이블/시퀀스에도 자동 적용
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO leaflog_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO leaflog_user;