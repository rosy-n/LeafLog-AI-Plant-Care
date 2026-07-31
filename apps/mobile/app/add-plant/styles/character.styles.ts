import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

const { width, height: screenHeight } = Dimensions.get('window');
// 3:4 portrait 이미지 — iPhone SE(667pt)까지 화면 넘침 없도록 140pt 상한 적용
const CHAR_SIZE = Math.min((width - 64) / 2, 140);
const CHAR_HEIGHT = Math.round(CHAR_SIZE * (4 / 3));

// result 화면의 캐릭터 이미지: 화면 높이의 40%를 상한으로 명시적 픽셀 계산
const CHAR_IMG_W = Math.round(width * 0.55);
const CHAR_IMG_H = Math.min(Math.round(CHAR_IMG_W * (4 / 3)), Math.round(screenHeight * 0.4));

export const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.huge,
  },

  spacer: { flex: 1 },

  // ── Intro ──────────────────────────────────────────────────────────────────

  introSubtitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },

  charSampleWrap: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  charTopRow: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  // 원본이 3:4 portrait(1792×2388, 768×1024)이므로 높이를 4/3 비율로 설정
  charSampleImg: {
    width: CHAR_SIZE,
    height: CHAR_HEIGHT,
  },
  charSampleCenter: {
    alignSelf: 'center',
  },

  // ── Button helpers ─────────────────────────────────────────────────────────

  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  // ── Guide ──────────────────────────────────────────────────────────────────

  guideScreen: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },

  guideFooter: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.huge,
    paddingTop: Spacing.md,
  },

  guideCategory: {
    marginBottom: Spacing.xxl,
  },

  guideCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  guideCategoryLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },

  guideCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  guideCardGood: {
    borderLeftColor: Colors.primary,
  },
  // 원본 140×162 → 비율 보존하여 화분 잘림 방지 (110 × 162/140 ≈ 128)
  guideCardImage: {
    width: 110,
    height: 128,
  },
  guideCardTextWrap: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  guidePoint: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textBlack,
    lineHeight: 20,
  },

  badExampleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  badExampleItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badExampleImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  badExampleLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.textGray,
    textAlign: 'center',
  },

  // ── Preview ────────────────────────────────────────────────────────────────

  previewImage: {
    flex: 1,
    borderRadius: Radius.lg,
    marginBottom: Spacing.xxl,
    backgroundColor: Colors.primaryLight,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  btn: { flex: 1 },

  // ── Buttons ────────────────────────────────────────────────────────────────

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },
  outlineBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  outlineBtnText: {
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },

  // ── Generating ─────────────────────────────────────────────────────────────

  generatingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.huge,
  },
  generatingTitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.title,
    color: Colors.textBlack,
    lineHeight: 32,
    marginBottom: Spacing.xxxl,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.disabled,
    borderRadius: Radius.xs,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.xs,
  },
  progressLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
  },

  // ── Result ─────────────────────────────────────────────────────────────────

  // placeholder 원본 1792×2388 = 3:4 portrait
  // 퍼센트 width는 flex 컨테이너에서 해석이 불안정 → Dimensions 기반 명시적 픽셀로 고정
  characterImage: {
    width: CHAR_IMG_W,
    height: CHAR_IMG_H,
    alignSelf: 'center',
    marginBottom: Spacing.xxxl,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
  },
});