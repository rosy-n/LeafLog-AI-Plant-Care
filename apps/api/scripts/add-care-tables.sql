-- docs/database-schema.sql 의 정의를 그대로 옮긴 것 (care_schedule, care_record)
-- 슈퍼유저(postgres)로 실행 — ALTER DEFAULT PRIVILEGES 설정에 따라 leaflog_user 권한 자동 부여
\connect leaflog

-- 앞으로 언제 관리해야 하는지에 대한 테이블
CREATE TABLE care_schedule (
    schedule_id     BIGSERIAL PRIMARY KEY,
    plant_id        BIGINT NOT NULL REFERENCES plant(plant_id) ON DELETE CASCADE,

    care_type       VARCHAR(30) NOT NULL
                    CHECK (care_type IN ('WATERING', 'FERTILIZING', 'REPOTTING')),

    interval_days   INTEGER NOT NULL CHECK (interval_days > 0),
    next_due_date   DATE NOT NULL,

    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now(),

    UNIQUE (plant_id, care_type),
    UNIQUE (schedule_id, plant_id, care_type)
);

CREATE TABLE care_record (
    care_record_id  BIGSERIAL PRIMARY KEY,
    plant_id        BIGINT NOT NULL REFERENCES plant(plant_id) ON DELETE CASCADE,
    schedule_id     BIGINT,

    care_type       VARCHAR(30) NOT NULL
                    CHECK (care_type IN ('WATERING', 'FERTILIZING', 'REPOTTING')),

    scheduled_at    TIMESTAMP,
    completed_at    TIMESTAMP DEFAULT now(),
    note            TEXT,
    asset_id        BIGINT REFERENCES media_asset(asset_id) ON DELETE SET NULL,

    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now(),

    FOREIGN KEY (schedule_id, plant_id, care_type)
        REFERENCES care_schedule(schedule_id, plant_id, care_type)
        ON DELETE SET NULL (schedule_id)
);