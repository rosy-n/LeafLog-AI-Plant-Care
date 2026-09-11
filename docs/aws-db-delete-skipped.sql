-- 6절 plan 에서 skipped 로 빠지는 media_asset 행을 삭제한다.
--
-- asset_id 를 고정하지 않고 **형태로** 고른다. 개체 등록이 계속 늘어 대상 목록이 매번
-- 달라지기 때문이다(9/07 13건 → 9/11 16건). 고정 목록을 쓰면 13-2 에서 반드시 어긋난다.
--
--   (1) PLANT_PHOTO 중 file_url 이 file:///var/mobile/...
--       iOS 앱 캐시 경로가 그대로 저장된 행. 서버에 업로드된 적이 없어 복구 불가이고
--       앱에서도 표시되지 않는다. `generation` 없는 등록 경로에 서버 가드가 없어 계속 쌓인다.
--   (2) DIAGNOSIS_PHOTO 중 bucket_name 이 없고 /static/uploads/diagnosis/ 경로
--       개발 PC 로컬에 저장됐던 행. 파일이 소실됐다.
--
-- 이미 S3 로 이전된 행(bucket_name 이 있고 object_key 가 leaflog/migrated/…)은 고르지 않는다.
-- chat_message.asset_id 는 nullable + ON DELETE SET NULL 이라 상담 대화 내용은 보존된다.
--
-- 실행 위치의 디렉터리에 deleted-media-assets.csv 백업이 생성된다.
\encoding UTF8
\set ON_ERROR_STOP on
\pset pager off

\echo '=== 1. 삭제 대상 ==='
SELECT asset_id, asset_type, user_id, plant_id,
       left(regexp_replace(split_part(file_url, '?', 1), '^[a-z]+://[^/]*', ''), 55) AS url_head
FROM media_asset
WHERE (asset_type = 'PLANT_PHOTO' AND file_url LIKE 'file:///var/mobile/%')
   OR (asset_type = 'DIAGNOSIS_PHOTO' AND bucket_name IS NULL
       AND split_part(file_url, '?', 1) LIKE '%/static/uploads/diagnosis/%')
ORDER BY asset_id;

\echo ''
\echo '=== 2. 영향받는 참조 (asset_id 가 NULL 로 바뀔 행) ==='
WITH t AS (
  SELECT asset_id FROM media_asset
  WHERE (asset_type = 'PLANT_PHOTO' AND file_url LIKE 'file:///var/mobile/%')
     OR (asset_type = 'DIAGNOSIS_PHOTO' AND bucket_name IS NULL
         AND split_part(file_url, '?', 1) LIKE '%/static/uploads/diagnosis/%')
)
SELECT 'chat_message' AS tbl, count(*) AS rows FROM chat_message WHERE asset_id IN (SELECT asset_id FROM t)
UNION ALL SELECT 'care_record', count(*) FROM care_record WHERE asset_id IN (SELECT asset_id FROM t)
UNION ALL SELECT 'item',        count(*) FROM item        WHERE asset_id IN (SELECT asset_id FROM t);

\echo ''
\echo '=== 3. 백업 (실행 디렉터리에 CSV 생성) ==='
\copy (SELECT * FROM media_asset WHERE (asset_type='PLANT_PHOTO' AND file_url LIKE 'file:///var/mobile/%') OR (asset_type='DIAGNOSIS_PHOTO' AND bucket_name IS NULL AND split_part(file_url,'?',1) LIKE '%/static/uploads/diagnosis/%') ORDER BY asset_id) TO 'deleted-media-assets.csv' WITH (FORMAT csv, HEADER true)

\echo ''
\echo '=== 4. 삭제 ==='
DO $$
DECLARE
    doomed int;
    deleted int;
BEGIN
    SELECT count(*) INTO doomed FROM media_asset
    WHERE (asset_type = 'PLANT_PHOTO' AND file_url LIKE 'file:///var/mobile/%')
       OR (asset_type = 'DIAGNOSIS_PHOTO' AND bucket_name IS NULL
           AND split_part(file_url, '?', 1) LIKE '%/static/uploads/diagnosis/%');

    IF doomed = 0 THEN
        RAISE NOTICE '대상 없음 — 지울 것이 없습니다';
        RETURN;
    END IF;
    -- 안전장치: 예상 범위를 크게 벗어나면 멈춘다(형태 조건이 잘못됐을 가능성)
    IF doomed > 100 THEN
        RAISE EXCEPTION '대상이 %건입니다 — 너무 많아 중단. 1번 섹션 출력을 먼저 확인하세요', doomed;
    END IF;

    DELETE FROM media_asset
    WHERE (asset_type = 'PLANT_PHOTO' AND file_url LIKE 'file:///var/mobile/%')
       OR (asset_type = 'DIAGNOSIS_PHOTO' AND bucket_name IS NULL
           AND split_part(file_url, '?', 1) LIKE '%/static/uploads/diagnosis/%');
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RAISE NOTICE '삭제 완료: %건', deleted;
END $$;

\echo ''
\echo '=== 5. 확인 ==='
SELECT asset_type, count(*) AS rows FROM media_asset GROUP BY asset_type ORDER BY asset_type;
