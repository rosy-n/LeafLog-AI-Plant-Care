-- LeafLog DB 앱 전용 role 셋업
-- 원격 DB에 슈퍼유저(postgres)로 접속해 실행.
-- role 비밀번호는 파일에 두지 않고 -v app_pw=... 로 주입한다:
--   $env:PGPASSWORD='<postgres 비밀번호>'
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h <database-host> -U postgres -d postgres `
--       -v app_pw='<leaflog_user 비밀번호>' -f apps/api/scripts/db-setup.sql
--
-- 자동화 환경에서는 -v "app_pw=..." 로 비밀번호를 전달한다.
-- 전제: 대상 데이터베이스와 앱 테이블은 이미 생성됨.
--
-- 대상 DB 는 -v dbname=... 로 바꿀 수 있다. 생략하면 leaflog.
-- AWS 이전 리허설처럼 다른 DB 에 같은 권한을 걸 때 사용한다:
--   psql ... -v app_pw='<비밀번호>' -v dbname='leaflog_rehearsal' -f apps/api/scripts/db-setup.sql
-- 권한은 DB 단위라 DB 를 새로 만들면 이 스크립트를 다시 실행해야 한다.

\if :{?app_pw}
\else
\echo 'ERROR: app_pw 가 없습니다. psql -v app_pw=<비밀번호> 로 실행하세요.'
\quit 1
\endif

-- 대상 DB 기본값
\if :{?dbname}
\else
\set dbname leaflog
\endif

-- 1) 앱 role 생성 (없을 때만) — .env 의 DATABASE_URL 과 동일한 계정/비밀번호
-- psql 은 dollar-quoted 블록($$...$$) 안에서는 변수를 치환하지 않으므로 DO 대신 \gexec 사용
SELECT format('CREATE ROLE leaflog_user LOGIN PASSWORD %L', :'app_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leaflog_user')
\gexec

-- 이미 있던 role 이어도 비밀번호를 주입값으로 맞춘다
SELECT format('ALTER ROLE leaflog_user LOGIN PASSWORD %L', :'app_pw')
\gexec

-- 2) 대상 DB 안에서 권한 부여 (\connect 로 대상 DB 전환 — 같은 호스트 유지)
\connect :"dbname"

GRANT CONNECT ON DATABASE :"dbname" TO leaflog_user;
GRANT USAGE ON SCHEMA public TO leaflog_user;

-- 기존 테이블/시퀀스 권한
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leaflog_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO leaflog_user;

-- 앞으로 만들어질 테이블/시퀀스에도 자동 적용
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO leaflog_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO leaflog_user;
