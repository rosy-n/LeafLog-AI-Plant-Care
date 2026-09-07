-- LeafLog PostgreSQL 이전 — 검증 기준선 조사
--
-- 원본(학교) DB와 복원한 DB에 같은 방식으로 실행해 출력을 그대로 비교한다.
-- 테이블 목록을 파일에 적지 않고 information_schema 에서 읽으므로
-- docs/database-schema.sql 이 바뀌어도 이 스크립트는 손댈 필요가 없다.
--
--   psql -h <host> -U <user> -d <db> -f ops/aws-migration/01-survey.sql -o survey-source.txt
--
-- 두 출력의 차이가 곧 이전 누락이다:
--   diff survey-source.txt survey-restored.txt

-- Windows psql 은 client_encoding 이 cp949 일 수 있어 한글 출력이 깨진다
\encoding UTF8

\pset pager off
\pset footer off
\timing off

\echo '=== 1. 서버 / DB ==='
SELECT current_database() AS database,
       current_user       AS connected_as,
       version()          AS server_version;

\echo ''
\echo '=== 2. 확장 (RDS 지원 여부를 반드시 대조할 항목) ==='
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

\echo ''
\echo '=== 3. 테이블별 정확한 건수 ==='
-- pg_stat_user_tables.n_live_tup 은 추정치라 이전 검증에 쓸 수 없다.
-- query_to_xml 로 테이블마다 실제 count(*) 를 실행한다.
SELECT t.table_name,
       (xpath(
           '/row/c/text()',
           query_to_xml(
               format('SELECT count(*) AS c FROM %I.%I', t.table_schema, t.table_name),
               false, true, ''
           )
       ))[1]::text::bigint AS exact_rows
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

\echo ''
\echo '=== 4. 시퀀스 상태 (복원 후 새 등록이 되는지의 근거) ==='
-- BIGSERIAL 기반이라 시퀀스가 안 따라오면 첫 INSERT 부터 PK 충돌이 난다.
SELECT sequencename, last_value
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

\echo ''
\echo '=== 5. 컬럼 인벤토리 (스키마 드리프트 확인) ==='
SELECT table_name, ordinal_position, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

\echo ''
\echo '=== 6. media_asset 유형별 분포 (S3 이전 담당자와 대조) ==='
SELECT asset_type, count(*) AS rows
FROM media_asset
GROUP BY asset_type
ORDER BY asset_type;

\echo ''
\echo '=== 7. checksum 형식 분포 — face-v1: 은 얼굴 좌표이지 파일 해시가 아니다 ==='
-- 가이드 7-2 경고 지점. S3 이전 때 일반 파일 해시로 덮어쓰면 캐릭터 표정이 깨진다.
SELECT CASE
           WHEN checksum IS NULL          THEN '(null)'
           WHEN checksum LIKE 'face-v1:%' THEN 'face-v1: (얼굴 좌표)'
           ELSE '기타'
       END AS checksum_kind,
       count(*) AS rows
FROM media_asset
GROUP BY 1
ORDER BY 1;
