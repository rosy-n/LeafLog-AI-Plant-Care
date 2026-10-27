-- 문의 답변을 앱에서 확인할 수 있게 한다.
--
-- add-inquiry-table.sql 로 만든 inquiry 에 answer / answered_at 을 붙이고,
-- status 에 'ANSWERED' 를 허용한다. docs/database-schema.sql "8. 고객 문의" 와 같은 정의다.
--
-- 답변은 role='ADMIN' 인 계정이 PATCH /api/admin/inquiries/{id} 로 넣는다.
-- 별도 관리자 화면 없이 FastAPI 의 /docs (Swagger UI) 를 그대로 쓴다.
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-inquiry-answer.sql
-- 원격 DB(.env 의 DATABASE_URL 이 localhost 가 아닐 때)는 -h <호스트> 를 함께 준다.
-- 재실행 안전.
\connect leaflog

ALTER TABLE inquiry ADD COLUMN IF NOT EXISTS answer      TEXT;
ALTER TABLE inquiry ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP;

-- status 에 'ANSWERED' 를 허용하도록 CHECK 를 교체한다
ALTER TABLE inquiry DROP CONSTRAINT IF EXISTS ck_inquiry_status;
ALTER TABLE inquiry DROP CONSTRAINT IF EXISTS inquiry_status_check;
ALTER TABLE inquiry ADD CONSTRAINT ck_inquiry_status
    CHECK (status IN ('OPEN', 'ANSWERED', 'CLOSED'));

-- 관리자 계정 지정 예시 — 실제 관리자 이메일을 확인한 후 아래 UPDATE 주석을 해제한다.
-- 제출본에는 기본 관리자 계정을 지정하지 않는다. admin@example.com을 실제 계정으로 바꾼다.
-- (기존 관리자를 먼저 내려서 관리자가 항상 한 명만 남게 한다)
-- UPDATE app_user SET role = 'USER'  WHERE role = 'ADMIN' AND email <> 'admin@example.com';
-- UPDATE app_user SET role = 'ADMIN' WHERE email = 'admin@example.com';

-- 결과 확인
SELECT user_id, email, nickname, role FROM app_user WHERE role = 'ADMIN';
