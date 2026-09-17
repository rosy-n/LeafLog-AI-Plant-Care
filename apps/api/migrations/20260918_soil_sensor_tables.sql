-- Production RDS (leaflog) only. Review and back up before running as the schema owner.
-- Adds the soil moisture sensor tables; creates nothing else and removes nothing.
-- No reconnect, no legacy data cleanup, no DDL rights granted to the app account.
--
-- Same definition as docs/database-schema.sql "9. 토양 수분 센서".
-- The local counterpart is apps/api/scripts/add-soil-sensor-tables.sql, which targets
-- the standalone dev database and its leaflog_user role - do not run that file here.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
    IF current_database() <> 'leaflog' THEN
        RAISE EXCEPTION 'This migration requires leaflog';
    END IF;
END;
$$;

-- One registered device. plant_id is where it is plugged in right now; past readings
-- keep their own plant_id so moving the sensor does not rewrite history.
CREATE TABLE IF NOT EXISTS public.soil_sensor (
    sensor_id           BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES public.app_user(user_id) ON DELETE CASCADE,
    plant_id            BIGINT REFERENCES public.plant(plant_id) ON DELETE SET NULL,

    -- ESP32 eFuse MAC address; survives reflashing, so the device never re-registers.
    device_key          VARCHAR(64) NOT NULL,
    device_label        VARCHAR(100),
    model               VARCHAR(50) NOT NULL DEFAULT 'SEN0308',

    -- bcrypt hash of the device token (app/security.py). The plaintext is returned once.
    token_hash          VARCHAR(128) NOT NULL,

    -- Two-point calibration: dry_mv is 0%, wet_mv is 100%.
    -- Order is not enforced - some sensors read higher when wet. Only equality is blocked,
    -- because that would divide by zero in app/soil.py.
    dry_mv              INTEGER,
    wet_mv              INTEGER,
    calibrated_at       TIMESTAMP,

    report_interval_sec INTEGER NOT NULL DEFAULT 600,
    last_seen_at        TIMESTAMP,

    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now(),

    CONSTRAINT uq_soil_sensor_device_key UNIQUE (device_key),
    CONSTRAINT ck_soil_sensor_dry_mv CHECK (dry_mv BETWEEN 0 AND 3300),
    CONSTRAINT ck_soil_sensor_wet_mv CHECK (wet_mv BETWEEN 0 AND 3300),
    CONSTRAINT ck_soil_sensor_report_interval_sec CHECK (report_interval_sec >= 60),
    CONSTRAINT ck_soil_sensor_calibration_span
        CHECK (dry_mv IS NULL OR wet_mv IS NULL OR dry_mv <> wet_mv)
);

-- One measurement. Only raw_mv is source data; the percentage is derived in app/soil.py.
CREATE TABLE IF NOT EXISTS public.soil_reading (
    reading_id      BIGSERIAL PRIMARY KEY,
    sensor_id       BIGINT NOT NULL REFERENCES public.soil_sensor(sensor_id) ON DELETE CASCADE,
    plant_id        BIGINT REFERENCES public.plant(plant_id) ON DELETE SET NULL,

    -- Device clock (NTP). Kept separate from created_at because a device that lost WiFi
    -- uploads a backlog later.
    measured_at     TIMESTAMP NOT NULL,
    raw_mv          INTEGER NOT NULL,

    -- Snapshot of the calibration in effect at measurement time, copied per row so that
    -- recalibrating never changes the percentage of an existing reading.
    dry_mv          INTEGER,
    wet_mv          INTEGER,

    created_at      TIMESTAMP DEFAULT now(),

    CONSTRAINT ck_soil_reading_raw_mv CHECK (raw_mv BETWEEN 0 AND 3300),
    -- Blocks a device that retried an upload from storing the same measurement twice.
    CONSTRAINT uq_soil_reading_sensor_measured UNIQUE (sensor_id, measured_at)
);

-- The app's main query is "recent moisture for this plant".
CREATE INDEX IF NOT EXISTS ix_soil_reading_plant_measured
    ON public.soil_reading (plant_id, measured_at);
CREATE INDEX IF NOT EXISTS ix_soil_sensor_plant_id ON public.soil_sensor (plant_id);
CREATE INDEX IF NOT EXISTS ix_soil_sensor_user_id ON public.soil_sensor (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.soil_sensor TO leaflog_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soil_reading TO leaflog_app;

DO $$
DECLARE
    sequence_name TEXT;
    target RECORD;
BEGIN
    FOR target IN
        SELECT * FROM (VALUES
            ('public.soil_sensor', 'sensor_id'),
            ('public.soil_reading', 'reading_id')
        ) AS t(table_name, column_name)
    LOOP
        sequence_name := pg_get_serial_sequence(target.table_name, target.column_name);
        IF sequence_name IS NULL THEN
            RAISE EXCEPTION '% .% has no sequence', target.table_name, target.column_name;
        END IF;
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO leaflog_app', sequence_name::regclass);
    END LOOP;
END;
$$;
COMMIT;
