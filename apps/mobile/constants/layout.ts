// LeafLog 레이아웃 토큰
// ─────────────────────────────────────────────────────────────
// 여러 화면이 공유하는 구조 값. 화면마다 복붙하다 값이 어긋나는 것을
// 막기 위해 한 곳에서 정의한다.

import { Gutter, Spacing } from "./spacing";

// 공용 화면 헤더 높이 (ScreenHeader). 헤더만큼 띄워야 하는 곳이 생기면
// 60을 다시 박지 말고 이 상수를 참조한다.
export const HEADER_HEIGHT = 60;

// 스크롤/리스트 본문의 공용 여백 — 좌우 gutter와 하단 리듬을 화면마다
// 복붙하지 않도록 기준을 잡는다. gap·상단 여백처럼 화면별로 다른 값은
// 이 객체를 스프레드한 뒤 개별 지정한다:  { ...screenContent, gap: Spacing.md }
export const screenContent = {
  paddingHorizontal: Gutter,
  paddingTop: Spacing.xs,
  paddingBottom: Spacing.huge,
  gap: Spacing.lg,
} as const;