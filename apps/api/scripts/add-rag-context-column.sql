-- 진단 상담 ASSISTANT 메시지가 참고한 RAG 유사 사례 스냅샷을 저장 — 그동안 응답에만 실려
-- 나가고 DB엔 저장되지 않아서, 과거 상담을 다시 열면 "RAG 검색 결과" 토글을 보여줄 수 없었다.
\connect leaflog

ALTER TABLE chat_message
    ADD COLUMN rag_context JSON;
