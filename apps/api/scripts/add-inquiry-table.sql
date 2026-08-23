-- 고객 문의(inquiry) 테이블.
--
-- 설정 화면 → 도움말 → 문의하기로 들어온 내용을 쌓아둔다.
-- docs/database-schema.sql "8. 고객 문의" 와 같은 정의다.
--
-- answer 칼럼은 두지 않는다 — 앱에 답변을 보여주는 화면도, 운영자가 값을 넣을
-- 창구도 아직 없다. 운영자는 이 표에서 user_id 로 사용자 이메일을 찾아 메일로
-- 회신하고 status 를 'CLOSED' 로 바꾼다. 앱에서 답변까지 보여주기로 하면
-- 그때 answer / answered_at 을 추가하면 된다.
--
-- 슈퍼유저(postgres)로 실행 — leaflog_user는 db-setup.sql의 ALTER DEFAULT PRIVILEGES로 이미 권한 보유
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f apps/api/scripts/add-inquiry-table.sql
-- 원격 DB(.env 의 DATABASE_URL 이 localhost 가 아닐 때)는 -h <호스트> 를 함께 준다.
-- 재실행 안전.
\connect leaflog

CREATE TABLE IF NOT EXISTS inquiry (
    inquiry_id   BIGSERIAL PRIMARY KEY,

    -- 탈퇴하면 문의도 함께 지운다
    user_id      BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,

    -- 문의 본문. 앱에서 5~2000자로 제한한다
    content      TEXT NOT NULL,

    -- 운영자가 처리 여부를 표시하는 용도 (지금은 DB에서 직접 바꾼다)
    status       VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                 CHECK (status IN ('OPEN', 'CLOSED')),

    created_at   TIMESTAMP DEFAULT now(),
    updated_at   TIMESTAMP DEFAULT now()
);

-- 최근 문의부터 훑는 것이 기본 조회다.
-- 이름은 SQLAlchemy 가 models.py 의 index=True 로 만드는 것과 맞춘다
-- (create_all 이 먼저 돈 환경과 인덱스가 중복되지 않게).
CREATE INDEX IF NOT EXISTS ix_inquiry_created_at ON inquiry (created_at);
CREATE INDEX IF NOT EXISTS ix_inquiry_user_id    ON inquiry (user_id);

-- db-setup.sql 의 ALTER DEFAULT PRIVILEGES 가 적용되지 않은 환경을 위한 보험.
-- 이미 권한이 있으면 아무 일도 일어나지 않는다.
GRANT SELECT, INSERT, UPDATE, DELETE ON inquiry TO leaflog_user;
GRANT USAGE, SELECT ON SEQUENCE inquiry_inquiry_id_seq TO leaflog_user;
