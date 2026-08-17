-- 배경을 유저(홈 화면) 단위에서 개체(개체탭) 단위로 되돌린다.
--
-- 처음엔 배경이 홈 화면 전체에 적용되는 줄 알고 user_setting.home_background_item_id 로
-- 넣었는데, 실제로는 액세서리와 똑같이 **개체마다** 적용되고 그 개체의 애정도로 해금된다.
-- 홈 배경은 고정이다.
--
-- 개체별 배경은 plant_decoration 에 position_key='BACKGROUND' 로 저장한다 —
-- UNIQUE (plant_id, position_key) 가 "개체당 배경 하나"를 그대로 보장해서
-- 새 테이블이나 컬럼이 필요 없다 (액세서리는 position_key='HEAD').
--
-- 슈퍼유저(postgres)로 실행:
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h <호스트> -U postgres -f apps/api/scripts/drop-user-setting-home-background.sql
-- 재실행 안전.
\connect leaflog

ALTER TABLE user_setting
    DROP COLUMN IF EXISTS home_background_item_id;