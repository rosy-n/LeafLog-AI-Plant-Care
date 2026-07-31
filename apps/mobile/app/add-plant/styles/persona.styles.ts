import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CHAR_IMG_W = Math.round(screenWidth * 0.5);
const CHAR_IMG_H = Math.min(Math.round(CHAR_IMG_W * (4 / 3)), Math.round(screenHeight * 0.3));

// 말풍선 — 컨테이너 gutter(Spacing.xl) 안쪽에서 가로 중앙 정렬
// PixelSpeechBubble의 tailOffset(꼬리 중심 x, 본체 왼쪽 기준)을 이 폭의 절반으로 넘겨야
// 꼬리가 말풍선 정중앙에 온다 — 기본값(60)은 폭 전체를 쓰는 이 화면엔 왼쪽으로 치우침
export const BUBBLE_WIDTH = screenWidth - Spacing.xl * 2;

// 4열 그리드 — 퍼센트 flexBasis는 RN에서 gap을 빼고 계산하지 않아 줄바꿈이
// 어긋나므로, 컨테이너 폭 기준 픽셀 폭을 직접 계산한다 (character.styles.ts와 동일 패턴)
const GRID_COLUMNS = 4;
const GRID_CONTAINER_WIDTH = screenWidth - Spacing.xl * 2;
const GRID_OPTION_WIDTH = Math.floor(
  (GRID_CONTAINER_WIDTH - Spacing.sm * (GRID_COLUMNS - 1)) / GRID_COLUMNS,
);

export const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  scrollContent: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 헤더(타이틀) 아래 설명 문구 — character.styles.ts의 introSubtitle과 동일한
  // 폰트·색 토큰(작은 회색 텍스트)을 그대로 사용
  subtitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },

  // 말풍선 — 캐릭터 위, 가로 중앙
  speechBubble: {
    alignSelf: 'center',
    width: BUBBLE_WIDTH,
    height: 92,
    marginBottom: Spacing.section,
  },
  speechText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textBlack,
    textAlign: 'center',
    lineHeight: 22,
  },

  characterImage: {
    width: CHAR_IMG_W,
    height: CHAR_IMG_H,
    alignSelf: 'center',
    marginBottom: Spacing.section,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
  },

  // 페르소나 4열 그리드 — common.chip/chipActive 색상·보더를 그대로 쓰고
  // 그리드 전용 크기(라운드·폭)만 덧씌운다
  personaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  personaOption: {
    width: GRID_OPTION_WIDTH,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xs,
  },
  personaOptionLabel: {
    textAlign: 'center',
  },

  // 버튼: root View의 자식 → 키보드·스크롤 어떤 상태에도 하단 고정
  buttonContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.huge,
  },
});
