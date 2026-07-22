// LeafLog 간격·반경 토큰
// ─────────────────────────────────────────────────────────────
// 4px 그리드 기반. 인라인 숫자(padding/margin/gap/borderRadius) 대신
// 반드시 이 토큰만 사용한다. 그리드에 없는 값이 필요하면 새 숫자를
// 넣지 말고 가장 가까운 단계를 쓰거나 여기 스케일을 확장한다.

export const Spacing = {
  none: 0,
  xxs: 2,     // 헤어라인 갭 (아이콘↔서브텍스트 등)
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,     // 화면 좌우 기본 여백(gutter)
  xxl: 24,
  section: 28, // 섹션 간 리듬
  xxxl: 32,
  huge: 40,
  huge2: 48,
} as const;

// 화면 좌우 기본 여백 — 헤더와 본문이 같은 기준선을 쓰도록 별칭 제공
export const Gutter = Spacing.xl;

export const Radius = {
  xs: 4,      // 프로그레스 바 · 작은 태그
  sm: 8,      // 인풋 · 작은 썸네일
  md: 12,     // 버튼 · 칩 · 스테퍼
  lg: 16,     // 카드 · 큰 이미지
  xl: 20,     // 캐릭터 대형 이미지
  pill: 999,  // 완전 라운드 (원형 버튼 · 필 칩)
} as const;
