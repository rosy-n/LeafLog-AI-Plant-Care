-- store_bg* 배경의 S3 카드 이미지 연결을 끊어 앱 번들 이미지를 쓰게 한다.
--
-- 왜 필요한가: GET /api/items 는 asset_id 가 걸려 있으면 그 S3 URL 을 주고,
-- 앱은 URL 이 있으면 번들 이미지 대신 그걸 그린다(src/data/decor.js 의 backgroundSource).
-- store_bg1/store_bg2 는 예전 그림이 S3 에 올라간 상태로 연결돼 있어서,
-- assets/images/store_bg*.png 를 새 그림으로 갈아도 앱에는 예전 그림이 계속 보인다.
-- 연결을 끊으면 5장 모두 번들 이미지로 그려져 새 그림을 바로 확인할 수 있다.
--
-- media_asset 행은 지우지 않는다 — FK 만 비우므로 언제든 다시 연결할 수 있다.
-- 새 그림을 S3 에 올린 뒤 되돌리려면(콘솔에서 같은 object_key 로 덮어쓰고):
--   cd apps/api
--   ./.venv/Scripts/python.exe scripts/set-item-image.py store_bg1 card "https://<버킷>.s3.<리전>.amazonaws.com/leaflog/item-images/store_bg1.png"
--   ... store_bg2 ~ store_bg5 까지 같은 방식으로
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h <호스트> -U postgres -f apps/api/scripts/unlink-store-background-images.sql
-- 재실행 안전.
\connect leaflog

UPDATE item
   SET asset_id = NULL,
       updated_at = now()
 WHERE item_type = 'BACKGROUND'
   AND item_key LIKE 'store\_bg%'
   AND asset_id IS NOT NULL;

-- 확인 — image_url 자리가 비어 있으면 앱이 번들 이미지를 쓴다
SELECT i.item_key, i.item_name, i.required_level, m.file_url
  FROM item i
  LEFT JOIN media_asset m ON m.asset_id = i.asset_id
 WHERE i.item_type = 'BACKGROUND'
 ORDER BY i.item_id;
