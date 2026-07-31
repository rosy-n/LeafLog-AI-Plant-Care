-- persona-chat에서 사용할 캐릭터 성격을 plant 테이블에 저장 (기존에는 어디에도 저장되지 않았음)
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
\connect leaflog

ALTER TABLE plant
    ADD COLUMN persona VARCHAR(30)
    CHECK (persona IN (
        'SUNSHINE', 'CHIC', 'RELAXED', 'TIMID',
        'SAGE', 'PLAYFUL', 'DILIGENT', 'DREAMER'
    ));
