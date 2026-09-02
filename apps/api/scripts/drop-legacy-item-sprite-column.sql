-- 예전 통짜 캐릭터 이미지 연결 컬럼을 제거한다.
-- 현재 앱은 item.asset_id의 화분 없는 투명 효과 이미지만 카드와 캐릭터 레이어에 쓴다.
-- S3에 남은 통짜 이미지 객체는 이 마이그레이션과 별도로 삭제한다.
\connect leaflog

ALTER TABLE item
    DROP COLUMN IF EXISTS sprite_asset_id;
