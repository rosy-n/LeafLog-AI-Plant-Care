-- 꾸미기 아이템 이미지를 S3(media_asset)로 옮기기 위한 컬럼.
--
-- item_key(앱 번들 이미지 키)는 그대로 둔다 — S3 URL 이 없거나 만료됐을 때
-- 앱이 번들 이미지로 fallback 하고, 시드/스크립트가 아이템을 지목하는 키이기도 하다.
--
-- 현재 앱은 아이템 하나에 이미지 하나만 사용한다:
--   asset_id 목록 카드에 보이는 이미지 (액세서리 아이콘 / 배경 미리보기)
--            액세서리는 이 투명 효과 이미지를 캐릭터 위에도 그대로 겹친다.
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h <호스트> -U postgres -f apps/api/scripts/add-item-asset-columns.sql
-- 재실행 안전.
\connect leaflog

ALTER TABLE item
    ADD COLUMN IF NOT EXISTS asset_id BIGINT
        REFERENCES media_asset(asset_id) ON DELETE SET NULL;

-- 업로드한 S3 객체를 아이템에 연결하는 방법:
--   cd apps/api
--   ./.venv/Scripts/python.exe scripts/set-item-image.py <item_key> "<s3_url>"
