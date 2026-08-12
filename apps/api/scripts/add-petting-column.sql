-- 캐릭터 문지르기로 애정도를 받은 마지막 날짜(한국 기준) — 하루 1회 제한 판정용.
-- 문지르기는 돌봄이 아니라 애정 표현이라 care_record 를 남기지 않고 이 컬럼만 본다.
-- 점수 규칙(app/affinity.py PETTING_POINTS)은 코드가 단일 출처.
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-petting-column.sql
-- .env 의 DATABASE_URL 이 localhost 가 아니면 -h <호스트> 를 함께 준다.
-- 재실행 안전.
\connect leaflog

ALTER TABLE plant
    ADD COLUMN IF NOT EXISTS last_petted_on DATE;