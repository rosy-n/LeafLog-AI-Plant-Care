-- 토양 수분 센서(soil_sensor) / 측정값(soil_reading) 테이블.
--
-- ESP32-S3 + DFRobot SEN0308 을 화분에 꽂아두고 주기적으로 올리는 값을 담는다.
-- docs/database-schema.sql "9. 토양 수분 센서" 와 같은 정의다.
--
-- 수분 %는 저장하지 않는다 — raw 전압(mV)과 그때의 보정값만 남기고 환산은
-- app/soil.py 가 한다. 보정값은 흙 종류와 꽂은 깊이에 따라 다시 잡게 되는데,
-- %를 저장해두면 보정을 고치는 순간 과거 데이터를 되살릴 수 없다.
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-soil-sensor-tables.sql
-- 원격 DB(.env 의 DATABASE_URL 이 localhost 가 아닐 때)는 -h <호스트> 를 함께 준다.
-- 재실행 안전.
\connect leaflog

CREATE TABLE IF NOT EXISTS soil_sensor (
    sensor_id           BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,

    -- 지금 이 센서가 꽂혀 있는 화분. 화분을 지워도 기기는 남기고 재배정한다.
    plant_id            BIGINT REFERENCES plant(plant_id) ON DELETE SET NULL,

    -- ESP32 의 eFuse MAC 주소. 펌웨어를 다시 구워도 바뀌지 않는다.
    device_key          VARCHAR(64) NOT NULL,
    device_label        VARCHAR(100),
    model               VARCHAR(50) NOT NULL DEFAULT 'SEN0308',

    -- 기기 인증 토큰의 bcrypt 해시 (app/security.py 의 hash_password 사용).
    -- 평문은 등록 응답에서 한 번만 돌려준다.
    token_hash          VARCHAR(128) NOT NULL,

    -- 2점 보정. dry_mv 가 0%, wet_mv 가 100%.
    -- 대소 관계는 강제하지 않는다 (센서에 따라 젖을 때 전압이 오르기도 한다).
    dry_mv              INTEGER CHECK (dry_mv BETWEEN 0 AND 3300),
    wet_mv              INTEGER CHECK (wet_mv BETWEEN 0 AND 3300),
    calibrated_at       TIMESTAMP,

    -- 서버가 기기에 지시하는 전송 주기 (기본 10분).
    report_interval_sec INTEGER NOT NULL DEFAULT 600 CHECK (report_interval_sec >= 60),

    last_seen_at        TIMESTAMP,

    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now(),

    UNIQUE (device_key),
    CHECK (dry_mv IS NULL OR wet_mv IS NULL OR dry_mv <> wet_mv)
);

CREATE TABLE IF NOT EXISTS soil_reading (
    reading_id      BIGSERIAL PRIMARY KEY,
    sensor_id       BIGINT NOT NULL REFERENCES soil_sensor(sensor_id) ON DELETE CASCADE,

    -- 측정 당시의 화분. 센서를 옮겨도 과거 기록은 원래 화분에 남아야 해서 박아둔다.
    plant_id        BIGINT REFERENCES plant(plant_id) ON DELETE SET NULL,

    -- 기기가 잰 시각. WiFi 끊겨 몰아 보내는 경우가 있어 수신 시각(created_at)과 구분한다.
    measured_at     TIMESTAMP NOT NULL,

    -- ADC 실측 전압. 이 테이블의 유일한 원본 데이터.
    raw_mv          INTEGER NOT NULL CHECK (raw_mv BETWEEN 0 AND 3300),

    -- 측정 시점 보정값 스냅샷 — 보정을 다시 잡아도 과거 행의 %가 흔들리지 않게.
    dry_mv          INTEGER,
    wet_mv          INTEGER,

    created_at      TIMESTAMP DEFAULT now(),

    -- 기기 재전송으로 같은 측정이 두 번 쌓이는 것을 막는다.
    UNIQUE (sensor_id, measured_at)
);

-- 앱의 기본 조회는 "이 화분의 최근 수분 추이"다.
-- 이름은 SQLAlchemy 가 models.py 의 index=True 로 만드는 것과 맞춘다
-- (create_all 이 먼저 돈 환경과 인덱스가 중복되지 않게).
CREATE INDEX IF NOT EXISTS ix_soil_reading_plant_measured ON soil_reading (plant_id, measured_at);
CREATE INDEX IF NOT EXISTS ix_soil_sensor_plant_id        ON soil_sensor (plant_id);

-- db-setup.sql 의 ALTER DEFAULT PRIVILEGES 가 적용되지 않은 환경을 위한 보험.
-- 이미 권한이 있으면 아무 일도 일어나지 않는다.
GRANT SELECT, INSERT, UPDATE, DELETE ON soil_sensor  TO leaflog_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON soil_reading TO leaflog_user;
GRANT USAGE, SELECT ON SEQUENCE soil_sensor_sensor_id_seq  TO leaflog_user;
GRANT USAGE, SELECT ON SEQUENCE soil_reading_reading_id_seq TO leaflog_user;
