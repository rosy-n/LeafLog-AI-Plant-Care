-- 애정도 단계로 해금되는 개체탭 배경 5종.
--
-- item_key 뒤의 숫자가 곧 required_level 이다 — 앱 번들 이미지 키
-- (apps/mobile/src/data/decor.js 의 BACKGROUND_IMAGES)와 정확히 같아야 한다.
-- 이미지는 앱 번들에만 있고 asset_id 는 비워 둔다 (S3에 올리면 그때 연결).
--
-- 해금 여부는 저장하지 않는다 — 앱이 required_level 과 그 개체의 애정도 단계를
-- 비교한다(PlantDecorateScreen). 단계 계산은 app/affinity.py 가 단일 출처.
--
-- 이미 있는 아이템은 건드리지 않는다(DO NOTHING) — 운영 DB에서 이름이나
-- 해금 단계를 손으로 조정한 행을 이 스크립트가 되돌리면 안 된다.
INSERT INTO item (item_key, item_name, item_type, required_level) VALUES
    ('affinity_bg1', '연못가',     'BACKGROUND', 1),
    ('affinity_bg2', '벚나무 아래', 'BACKGROUND', 2),
    ('affinity_bg3', '꽃 아치 정원', 'BACKGROUND', 3),
    ('affinity_bg4', '반딧불 밤',   'BACKGROUND', 4),
    ('affinity_bg5', '유리 온실',   'BACKGROUND', 5)
ON CONFLICT (item_key) DO NOTHING;
