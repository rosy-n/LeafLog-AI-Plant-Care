-- 월 1회 캐릭터·개체정보 갱신을 마친 시각 — 다음 갱신 알림일 계산의 기준점.
-- NULL 이면 아직 한 번도 갱신하지 않은 개체라서 created_at(등록 시각)을 기준으로 삼는다.
-- 다음 갱신일 자체는 저장하지 않는다 (app/main.py _next_refresh_date 가 계산한다).
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-monthly-refresh-column.sql
-- .env 의 DATABASE_URL 이 localhost 가 아니면 -h <호스트> 를 함께 준다.
-- 재실행 안전.
\connect leaflog

ALTER TABLE plant
    ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMP;
