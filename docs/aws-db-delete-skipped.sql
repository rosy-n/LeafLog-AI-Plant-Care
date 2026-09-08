-- 6절 plan 에서 skipped 로 빠지는 media_asset 13건 삭제.
--   PLANT_PHOTO     6건 (4,5,8,30,34,36)   file:///var/mobile/... iOS 캐시 경로, 복구 불가
--   DIAGNOSIS_PHOTO 7건 (22~26,32,33)      개발 PC 로컬 uploads 경로, 파일 소실
--
-- 실행 전에 대상 행을 CSV 로 백업한다(아래 \copy). leaflog.dump 에도 원본이 남아 있다.
-- chat_message.asset_id 는 nullable + ON DELETE SET NULL 이라 상담 대화 내용은 보존된다.
\encoding UTF8
\set ON_ERROR_STOP on
\pset pager off

\echo '=== 1. 삭제 대상 ==='
SELECT asset_id, asset_type, user_id, plant_id,
       left(regexp_replace(split_part(file_url,'?',1), '^[a-z]+://[^/]*', ''), 55) AS url_head
FROM media_asset
WHERE asset_id IN (4,5,8,30,34,36,22,23,24,25,26,32,33)
ORDER BY asset_id;

\echo ''
\echo '=== 2. 영향받는 참조 (asset_id 가 NULL 로 바뀔 행) ==='
SELECT 'chat_message' AS tbl, count(*) AS rows
FROM chat_message WHERE asset_id IN (4,5,8,30,34,36,22,23,24,25,26,32,33)
UNION ALL
SELECT 'care_record', count(*)
FROM care_record  WHERE asset_id IN (4,5,8,30,34,36,22,23,24,25,26,32,33)
UNION ALL
SELECT 'item', count(*)
FROM item         WHERE asset_id IN (4,5,8,30,34,36,22,23,24,25,26,32,33);

\echo ''
\echo '=== 3. 백업 (실행 디렉터리에 CSV 생성) ==='
\copy (SELECT * FROM media_asset WHERE asset_id IN (4,5,8,30,34,36,22,23,24,25,26,32,33) ORDER BY asset_id) TO 'deleted-media-assets.csv' WITH (FORMAT csv, HEADER true)

\echo ''
\echo '=== 4. 삭제 (형태 검증 후) ==='
DO $$
DECLARE
    target int[] := ARRAY[4,5,8,30,34,36,22,23,24,25,26,32,33];
    found int;
    bad int;
    deleted int;
BEGIN
    SELECT count(*) INTO found FROM media_asset WHERE asset_id = ANY(target);
    IF found <> 13 THEN
        RAISE EXCEPTION '대상 13건 중 %건만 존재합니다 — 중단 (DB 가 예상과 다름)', found;
    END IF;

    -- 예상한 형태가 아닌 행이 섞여 있으면 지우지 않는다
    SELECT count(*) INTO bad FROM media_asset
    WHERE asset_id = ANY(target)
      AND NOT (
            (asset_type = 'PLANT_PHOTO'     AND file_url LIKE 'file:///var/mobile/%')
         OR (asset_type = 'DIAGNOSIS_PHOTO' AND bucket_name IS NULL
             AND split_part(file_url,'?',1) LIKE '%/static/uploads/diagnosis/%')
      );
    IF bad > 0 THEN
        RAISE EXCEPTION '예상과 다른 행 %건이 섞여 있습니다 — 중단', bad;
    END IF;

    DELETE FROM media_asset WHERE asset_id = ANY(target);
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RAISE NOTICE '삭제 완료: %건', deleted;
END $$;

\echo ''
\echo '=== 5. 확인 ==='
SELECT count(*) AS remaining_target
FROM media_asset WHERE asset_id IN (4,5,8,30,34,36,22,23,24,25,26,32,33);

SELECT asset_type, count(*) AS rows
FROM media_asset GROUP BY asset_type ORDER BY asset_type;
