-- docs/database-schema.sql 의 정의를 그대로 옮긴 것 (growth_diary, growth_diary_photo)
-- 슈퍼유저(postgres)로 실행 — ALTER DEFAULT PRIVILEGES 설정에 따라 leaflog_user 권한 자동 부여
\connect leaflog

CREATE TABLE IF NOT EXISTS growth_diary (
    diary_id            BIGSERIAL PRIMARY KEY,

    -- 현재 모든 사용자의 반려 식물들이 같은 id 체계를 사용
    user_id              BIGINT NOT NULL
                         REFERENCES app_user(user_id)
                         ON DELETE CASCADE,

    -- 일지 작성 기준 날짜
    -- 하루 1회 제한을 위해 별도 DATE 컬럼 사용
    diary_date          DATE NOT NULL,

    -- 정해진 형식에 따라 작성된 텍스트 한 뭉치
    content             TEXT NOT NULL,

    -- 일지 양식 버전
    -- 나중에 질문/항목 구성이 바뀔 수 있으므로 유지
    diary_format_version VARCHAR(20) DEFAULT 'v1',

    metadata            JSONB,

    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now(),

    -- 사용자는 하루에 일지 1개만 작성 가능
    UNIQUE (user_id, diary_date)
);

-- 일지별로 최대 3장의 사진 첨부
CREATE TABLE IF NOT EXISTS growth_diary_photo (
    diary_photo_id      BIGSERIAL PRIMARY KEY,

    diary_id            BIGINT NOT NULL
                        REFERENCES growth_diary(diary_id)
                        ON DELETE CASCADE,

    asset_id            BIGINT NOT NULL
                        REFERENCES media_asset(asset_id)
                        ON DELETE CASCADE,
    tagged_plant_id     BIGINT REFERENCES plant(plant_id) ON DELETE SET NULL,

    -- 1, 2, 3번 슬롯만 허용
    photo_order         INTEGER NOT NULL
                        CHECK (photo_order BETWEEN 1 AND 3),

    created_at          TIMESTAMP DEFAULT now(),

    -- 같은 일지에서 같은 순서의 사진은 1개만 가능
    UNIQUE (diary_id, photo_order),

    -- 같은 일지에 같은 사진 중복 첨부 방지
    UNIQUE (diary_id, asset_id)
);
