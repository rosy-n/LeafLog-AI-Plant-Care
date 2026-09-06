-- 꾸미기 배경 목록에서 들판·여름날·봄날을 내린다.
--
-- 남는 배경은 기본값인 풀밭(detail-bg)과 애정도로 해금되는 affinity_bg1~5 다.
--
-- 행을 지우지 않고 is_active 만 내리는 이유:
--   - item_id 는 plant_decoration 이 참조한다. 지우면 ON DELETE CASCADE 로
--     그 배경을 쓰던 개체의 꾸미기 행까지 함께 사라진다.
--   - 되돌릴 때 is_active 만 올리면 된다. 지운 행은 item_id 가 바뀌어 돌아온다.
-- GET /api/items 는 is_active 인 것만 내려주므로 앱 목록에서는 사라진다.
--
-- home-bg 는 홈 화면 배경으로도 쓰이지만(apps/mobile 의 HOME_BACKGROUND_KEY),
-- 그쪽은 item 테이블을 거치지 않고 번들 이미지를 직접 쓰므로 영향이 없다.
UPDATE item
   SET is_active = false,
       updated_at = now()
 WHERE item_key IN ('home-bg', 'store_bg1', 'store_bg2');
