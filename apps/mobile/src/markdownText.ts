// 모델이 ==하이라이트== 대신 ===하이라이트===처럼 '='를 3개 이상 쓴 답변은 markdown-it-mark가
// 홀수 길이의 '=' 연속을 표식으로 다 쓰지 못하고 남는 '=' 하나를 글자로 내보낸다.
// 서버가 새 답변은 정리하지만, 이미 저장된 과거 상담 기록도 같은 화면에서 보이므로 렌더 직전에 한 번 더 맞춘다.
export function normalizeHighlightMarks(text: string): string {
    return text.replace(/={3,}/g, "==");
}
