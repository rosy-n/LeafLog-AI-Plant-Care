-- 꾸미기 아이템 마스터(item) + 개체별 적용 상태(plant_decoration).
--
-- docs/database-schema.sql "6. 아이템 / 인벤토리" 를 코인/스토어 삭제 이후 설계에 맞춰
-- 줄인 형태다(그쪽 주석에도 같은 내용을 반영해 뒀다). 원래 정의와 달라진 점:
--   - unlock_type / price_coin 제거 — 코인 구매가 없어져 해금 조건은 애정도 하나뿐이다.
--   - required_affinity_score(점수) → required_level(단계 0~5) — 점수를 넣으면
--     app/affinity.py 의 LEVEL_THRESHOLDS 표가 DB에도 복제돼 기준을 바꿀 때 어긋난다.
--   - user_background / plant_accessory_unlock 은 만들지 않는다 — "보유"는 코인과 함께
--     사라졌고, 해금은 affinity.level_for_score(plant.affinity_score) 로 계산한다
--     (해금을 행으로 저장하면 기준을 바꿔도 옛 해금이 남아 두 출처가 갈라진다).
--     배경도 액세서리와 똑같이 개체별로 적용·해금되므로 plant_decoration 에 함께 넣는다.
--   - item_key 추가 — 앱 번들 이미지 맵(src/data/decor.js)의 키.
--     S3 이미지가 없거나 URL 발급이 안 될 때 앱이 이 키로 fallback 한다.
--     (S3 연결용 asset_id/sprite_asset_id 는 add-item-asset-columns.sql 에서 붙인다)
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-item-tables.sql
-- 원격 DB(.env 의 DATABASE_URL 이 localhost 가 아닐 때)는 -h <호스트> 를 함께 준다.
-- 재실행 안전.
\connect leaflog

-- 꾸미기 아이템 마스터. 액세서리는 개체에, 배경은 홈 화면에 적용된다.
CREATE TABLE IF NOT EXISTS item (
    item_id        BIGSERIAL PRIMARY KEY,

    -- 앱 번들 이미지 맵(src/data/decor.js)의 키. 이름/이미지가 바뀌어도 이 키는 고정.
    item_key       VARCHAR(50) UNIQUE NOT NULL,

    item_name      VARCHAR(100) NOT NULL,

    item_type      VARCHAR(30) NOT NULL
                   CHECK (item_type IN ('BACKGROUND', 'ACCESSORY')),

    -- 해금에 필요한 꽉 찬 하트 수. 0이면 기본 제공.
    -- 상한 5는 app/affinity.py 의 MAX_HEARTS 와 같아야 한다.
    required_level SMALLINT NOT NULL DEFAULT 0
                   CHECK (required_level BETWEEN 0 AND 5),

    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMP DEFAULT now(),
    updated_at     TIMESTAMP DEFAULT now()
);

-- 개체에 지금 적용된 꾸미기. position_key 당 하나씩 —
--   'HEAD'        착용 중인 액세서리
--   'BACKGROUND'  개체탭 배경 (홈 배경은 고정이라 여기 들어가지 않는다)
-- 슬롯이 늘어도 스키마는 그대로 쓸 수 있다.
CREATE TABLE IF NOT EXISTS plant_decoration (
    decoration_id  BIGSERIAL PRIMARY KEY,
    plant_id       BIGINT NOT NULL REFERENCES plant(plant_id) ON DELETE CASCADE,
    item_id        BIGINT NOT NULL REFERENCES item(item_id) ON DELETE CASCADE,
    position_key   VARCHAR(50) NOT NULL,
    applied_at     TIMESTAMP DEFAULT now(),

    UNIQUE (plant_id, position_key)
);

-- 아이템 시드 — 이름/해금 단계는 서버가, 이미지는 앱 번들이 들고 있다.
-- item_key 는 src/data/decor.js 의 키와 정확히 같아야 한다.
-- detail-bg 는 개체가 배경을 고르지 않았을 때의 기본값이다
-- (main.py 의 DEFAULT_BACKGROUND_ITEM_KEY). 다른 배경을 골랐다가 되돌릴 수 있도록
-- 목록에도 한 칸으로 들어간다.
--
-- store_bg1~5 는 같은 방을 계절·시간대만 바꿔 그린 한 세트고(봄/여름/가을/밤/비),
-- store_bg6~7 은 화분으로 채운 밝은 방 한 세트다(선반/서랍장).
--
-- ※ 배경 required_level 은 지금 전부 0(=애정도와 무관하게 사용 가능)이다 —
--   그림을 개체탭에서 바꿔가며 확인하는 동안 해금이 막지 않게 하기 위한 임시 값.
--   해금 단계를 정하면 이 표의 숫자만 고쳐 이 파일을 다시 실행하면 된다
--   (앱은 required_level 을 그대로 읽어 잠긴 카드를 흐리게 그리고, 서버도 같은 값으로
--    막으므로 되돌릴 곳은 이 표 하나다).
--   하트는 최대 5단계(app/affinity.py 의 MAX_HEARTS)인데 store_bg 는 7종이라
--   단계가 겹칠 수밖에 없다 — 배분은 아직 정하지 않았다.
--   0 으로 내리기 전 값: store_bg1=2, store_bg2=4 (store_bg3~7 은 신규).
INSERT INTO item (item_key, item_name, item_type, required_level) VALUES
    ('level1',     '잎사귀',    'ACCESSORY',  1),
    ('level2',     '반짝이',    'ACCESSORY',  2),
    ('level3',     '하트',      'ACCESSORY',  3),
    ('level4',     '알록달록',  'ACCESSORY',  4),
    ('level5',     '나비',      'ACCESSORY',  5),
    ('detail-bg',  '풀밭',      'BACKGROUND', 0),
    ('home-bg',    '들판',      'BACKGROUND', 0),
    ('store_bg1',  '여름날',    'BACKGROUND', 0),
    ('store_bg2',  '봄날',      'BACKGROUND', 0),
    ('store_bg3',  '달밤',      'BACKGROUND', 0),
    ('store_bg4',  '비 오는 날', 'BACKGROUND', 0),
    ('store_bg5',  '가을날',    'BACKGROUND', 0),
    ('store_bg6',  '선반방',    'BACKGROUND', 0),
    ('store_bg7',  '서랍방',    'BACKGROUND', 0)
ON CONFLICT (item_key) DO UPDATE SET
    item_name      = EXCLUDED.item_name,
    item_type      = EXCLUDED.item_type,
    required_level = EXCLUDED.required_level,
    updated_at     = now();