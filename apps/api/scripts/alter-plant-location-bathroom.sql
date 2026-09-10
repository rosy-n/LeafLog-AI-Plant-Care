-- plant.location_name 에 '화장실'(BATHROOM)을 추가한다.
-- models.py / docs/database-schema.sql "2." plant 테이블 정의와 같은 값으로 맞춘다.
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/alter-plant-location-bathroom.sql
-- 원격 DB(.env 의 DATABASE_URL 이 localhost 가 아닐 때)는 -h <호스트> 를 함께 준다.
-- 재실행 안전.
\connect leaflog

ALTER TABLE plant DROP CONSTRAINT IF EXISTS ck_plant_location_name;
ALTER TABLE plant ADD CONSTRAINT ck_plant_location_name
    CHECK (location_name IN ('LIVING_ROOM', 'BEDROOM', 'BALCONY', 'KITCHEN', 'OFFICE', 'BATHROOM'));
