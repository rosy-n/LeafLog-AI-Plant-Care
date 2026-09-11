-- 섹션 4-1 검증 기준선. 원본(학교) DB 에서 실행하고 출력을 보관한다.
--   psql -h <원본 DB 호스트> -U <계정> -d leaflog -W -f survey-4-1.sql -o survey-source.txt
\encoding UTF8
\pset pager off

\echo '=== 1. 서버 / DB ==='
SELECT current_database(), current_user, version();

\echo ''
\echo '=== 2. 확장 (RDS 지원 여부 대조용) ==='
SELECT extname, extversion FROM pg_extension ORDER BY extname;

\echo ''
\echo '=== 3. 전체 테이블 건수 (핸드오프 문서 4-1 의 \gexec 판) ==='
SELECT format('SELECT %L AS table_name, count(*) AS rows FROM %I.%I;',
              tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec

\echo ''
\echo '=== 4. 시퀀스 상태 (복원 후 새 등록 가능 여부의 근거) ==='
SELECT sequencename, last_value FROM pg_sequences
WHERE schemaname = 'public' ORDER BY sequencename;

\echo ''
\echo '=== 5. media_asset 유형별 분포 (섹션 6 대조용) ==='
SELECT asset_type, count(*) FROM media_asset GROUP BY asset_type ORDER BY asset_type;

\echo ''
\echo '=== 6. checksum 분포 — face-v1: 은 얼굴 좌표이지 파일 해시가 아니다 ==='
SELECT CASE WHEN checksum IS NULL THEN '(null)'
            WHEN checksum LIKE 'face-v1:%' THEN 'face-v1'
            ELSE '기타' END AS kind, count(*)
FROM media_asset GROUP BY 1 ORDER BY 1;
