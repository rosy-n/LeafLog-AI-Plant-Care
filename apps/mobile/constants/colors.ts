// LeafLog 색상 토큰
// ─────────────────────────────────────────────────────────────
// 앵커 4색은 지정값. 메인↔배경 사이의 "중간 녹색"이 필요하면
// 새 hex를 만들지 말고 GreenTint(= primary 를 배경 위에 투명도로)를 사용한다.

export const Colors = {
  // ── 브랜드 (지정) ────────────────────────────
  primary: '#1F5D01',        // 메인 · 진한 녹색
  background: '#FAFFF0',     // 배경 · 연한 녹색

  // ── 케어 마커 (지정) ─────────────────────────
  fertilizer: '#FFEDA3',     // 영양제 준 날 (배경)
  fertilizerIcon: '#9A7A10', // 영양제 아이콘 (✚)
  water: '#E0EDFF',          // 물 준 날 (배경)
  waterIcon: '#3A7ED5',      // 물주기 아이콘

  // ── 중성 ────────────────────────────────────
  textBlack: '#171717',      // 기본 텍스트
  textGray: '#727272',       // 보조 텍스트
  textFaint: '#A7A7A7',      // 비활성 · 플레이스홀더
  white: '#FFFFFF',
  border: '#D0D0D0',         // 보더 · 구분선
  disabled: '#D8D8D8',       // 비활성 배경

  // ── 시맨틱 ──────────────────────────────────
  danger: '#D83226',         // 하트 · 삭제 · 경고
  nutrient: '#2FA352',       // 영양제(✚) 아이콘 등 솔리드 녹색 강조
  coin: '#F4B63F',           // 코인 · 재화 (골드)
  remove: '#D4887A',         // 삭제 · 제거 액션 (코랄)
  weekendSun: '#D46060',     // 캘린더 일요일
  weekendSat: '#5A7AD4',     // 캘린더 토요일

  // ── 오버레이 ────────────────────────────────
  overlay: 'rgba(250, 255, 240, 0.88)',  // 배경색 딤 오버레이
  scrim: 'rgba(0, 0, 0, 0.35)',          // 모달 딤 배경

  // ── 보조 (기존 add-plant 플로우 호환) ─────────
  primaryLight: '#E8F5E9',   // 연녹 면 배경
  separator: '#F0F0F0',
  surfaceGray: '#E8E8E8',
} as const;

// 메인↔배경 사이의 녹색: primary(#1F5D01)를 배경 위에 투명도로 표현한다.
// 필요한 단계만 골라 쓰고, 없으면 rgba(31, 93, 1, α) 형태로 확장한다.
export const GreenTint = {
  wash:   'rgba(31, 93, 1, 0.10)',  // 초박 틴트
  soft:   'rgba(31, 93, 1, 0.12)',  // 칩 · 필 배경
  mist:   'rgba(31, 93, 1, 0.15)',
  veil:   'rgba(31, 93, 1, 0.18)',
  haze:   'rgba(31, 93, 1, 0.20)',
  line:   'rgba(31, 93, 1, 0.22)',  // 녹색 보더 · 구분선
  medium: 'rgba(31, 93, 1, 0.40)',  // 중간 녹색
  half:   'rgba(31, 93, 1, 0.50)',
  strong: 'rgba(31, 93, 1, 0.65)',  // 보조 텍스트 · 아이콘
  deep:   'rgba(31, 93, 1, 0.82)',  // 강조 녹색 텍스트
  faint:  'rgba(31, 93, 1, 0.06)',  // 아주 옅은 면 틴트
} as const;

// ── 확장 팔레트 (화면별 브랜드 · 일러스트 색) ─────────
// 인라인 hex 정리로 승격된 토큰. 반투명 "리퀴드 글래스" 효과색(흰/연녹/회색
// 계열)은 아직 인라인으로 남아 있으며 별도 통합(consolidation) 패스 대상이다.

// 센서 게이지 · 상태 (SensorDataScreen)
export const Gauge = {
  cool:     '#5BBFDE',  coolDeep: '#3A82B8',  coolText: '#3A8DC4',
  warm:     '#E87B4B',  warmDeep: '#C05A3A',  hot:      '#D94B3A',
  gold:     '#C49A20',
} as const;

// 게이지 틴트 (아이콘색을 낮은 투명도로)
export const GaugeTint = {
  hotFaint:  'rgba(217,75,58,0.12)',   hotSoft:  'rgba(217,75,58,0.28)',
  coolFaint: 'rgba(58,141,196,0.12)',  coolSoft: 'rgba(58,141,196,0.28)',
  goldFaint: 'rgba(196,154,32,0.12)',  goldSoft: 'rgba(196,154,32,0.28)',
} as const;

// 흙 팔레트 (RepottingScreen)
export const Soil = {
  sand: '#F5C87A',  clay: '#F5A07A',  peat: '#B8A5D4',  water: '#7AC5F5',
  bg:   '#EEE8D8',  sandAlpha: '#F5C87A44',
} as const;

// 종이 · 크림 카드 (Store · Calendar 메모 · Profile · Garden · Memorial)
export const Paper = {
  cream:      '#FFFBE8',  creamGold: '#F4D98A',  gold: '#C8870A',
  noteBg:     '#FEFBDF',  noteBorder: '#E8E0B8', noteAccent: '#C8B800', noteText: '#333322',
  cardBg:     '#FBE9C2',  cardBorder: '#4B2D18',
  tan:        '#EEEAD8',  taupe: '#D8CCAA',  taupeBorder: '#C9B890',
  taupeBg:    '#EDE5CC',  taupeText: '#7A6E54',
} as const;

// 분홍 계열 (Memorial · CareInfo)
export const Pink = {
  rose: '#FF6B8A',  light: '#FFAAC2',  bg: '#FFE5F5',  soft: '#F29AA2',
} as const;

// 따뜻한 살구 배경 (CareInfo 원형)
export const Warm = {
  peach: '#FFEBD9',  peach2: '#FFE7D2',
} as const;

// 물 · 하늘 (HomeScreen)
export const Aqua = {
  bright: '#0FAEE5',  mid: '#23A7D3',  muted: '#85A5B1',
} as const;

// 잎 · 자연 녹색 강조 (PlantDecorate · PlantDetail · LiquidGlass · Garden)
export const Leaf = {
  bright: '#72C959',  deep: '#3E8C2D',  olive: '#5C6131',  forest: '#385236',  gold: '#E2C23A',
} as const;

// 일러스트 · 기타 단색
export const Accent = {
  airBlue:   '#9EBEF1',  // CareInfo
  cream:     '#FFF1BE',  // CareInfo
  brown:     '#8B6B5E',  // Garden
  brownDeep: '#8A4E24',  // PlantDetail
  rust:      '#A03020',  // PlantDecorate
  mauve:     '#7B6A8A',  // Memorial
  alert:     '#FF3939',  // Home
} as const;

// 그림자 (shadowColor)
export const Shadow = {
  color:  '#000000',
  soft:   'rgba(0,0,0,0.42)',  medium: 'rgba(0,0,0,0.45)',  strong: 'rgba(0,0,0,0.48)',
} as const;