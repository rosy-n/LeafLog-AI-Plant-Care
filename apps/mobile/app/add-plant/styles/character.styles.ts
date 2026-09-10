import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

const { width, height: screenHeight } = Dimensions.get('window');
// 3:4 portrait 이미지 — iPhone SE(667pt)까지 화면 넘침 없도록 140pt 상한 적용
const CHAR_SIZE = Math.min((width - 64) / 2, 140);
const CHAR_HEIGHT = Math.round(CHAR_SIZE * (4 / 3));

// result 화면의 선택된 후보 미리보기: 후보 카드 3장이 같이 들어가므로
// 기존 40% 대신 화면 높이의 30%를 상한으로 잡는다.
const CHAR_IMG_W = Math.round(width * 0.45);
const CHAR_IMG_H = Math.min(Math.round(CHAR_IMG_W * (4 / 3)), Math.round(screenHeight * 0.3));

// 나쁜 예 3장 한 줄: guideScreen 좌우 패딩 + 카드 사이 gap 2칸을 뺀 나머지를 3등분.
// width:'100%' + aspectRatio만 쓰면 큰 원본 이미지가 들어왔을 때 Yoga가 이미지의
// 실제 픽셀 크기로 폭을 잘못 계산해 레이아웃이 깨지는 경우가 있어 숫자로 고정한다.
// 원본이 3x4 증명사진 비율(가로:세로 = 3:4)이라 정사각형이 아니라 그 비율대로 세로로 길게 잡는다.
const BAD_EXAMPLE_W = Math.floor((width - Spacing.xl * 2 - Spacing.md * 2) / 3);
const BAD_EXAMPLE_H = Math.round(BAD_EXAMPLE_W * (4 / 3));

// 후보 카드 3장 한 줄: 좌우 gutter + 카드 사이 gap 을 뺀 나머지를 3등분
const CARD_PADDING = Spacing.sm;
const CARD_W = Math.floor((width - Spacing.xl * 2 - Spacing.md * 2) / 3);
// 3:4 portrait 원본 비율 유지 (카드 내부 패딩 제외한 폭 기준)
const CARD_IMG_H = Math.round((CARD_W - CARD_PADDING * 2) * (4 / 3));

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
    flexDirection: 'row',
  },
  // 원본 140×162 → 비율 보존하여 화분 잘림 방지 (110 × 162/140 ≈ 128)
  // 액자처럼 보이도록 이미지 자체에 초록 테두리를 두른다 (카드 배경은 흰색이 아니라
  // 화면 배경(Colors.background)을 그대로 노출)
  guideCardImage: {
    width: 110,
    height: 128,
    borderRadius: Radius.lg,
    borderWidth: 3,
    borderColor: Colors.primary,
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
    width: BAD_EXAMPLE_W,
    height: BAD_EXAMPLE_H,
    borderRadius: Radius.md,
    borderWidth: 3,
    borderColor: Colors.primary,
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
  progressStatus: {
    alignItems: 'center',
  },
  progressLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
    textAlign: 'center',
  },
  waitHint: {
    marginTop: Spacing.xl,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    lineHeight: 18,
    color: Colors.textFaint,
    textAlign: 'center',
  },
  backgroundBtn: {
    marginTop: Spacing.lg,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backgroundBtnText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },

  // ── Result (후보 3종 선택) ──────────────────────────────────────────────────

  resultSubtitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  // 선택된 후보 미리보기 자리 — 선택 전/후 높이가 같아야 레이아웃이 튀지 않는다
  selectedPreview: {
    width: CHAR_IMG_W,
    height: CHAR_IMG_H,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // 원본 1792×2388 = 3:4 portrait
  selectedPreviewImage: {
    width: '100%',
    height: '100%',
  },
  selectedPreviewHint: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 18,
  },

  candidateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  candidateCard: {
    width: CARD_W,
    padding: CARD_PADDING,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  candidateCardSelected: {
    borderWidth: 2.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  candidateImage: {
    width: '100%',
    height: CARD_IMG_H,
  },
  candidateCheck: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Disabled ───────────────────────────────────────────────────────────────

  disabledBtn: { backgroundColor: Colors.disabled },
  disabledBtnText: { color: Colors.textGray },

  // ── 튜토리얼 인트로 카드 (생성 로딩 화면 위에 뜨는 오버레이) ─────────────────

  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  tutorialSkipBtn: {
    position: 'absolute',
    top: Spacing.xxl,
    right: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tutorialSkipText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: 'rgba(255,255,255,0.7)',
  },
  tutorialCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xl,
  },
  tutorialCardText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textBlack,
    textAlign: 'center',
    lineHeight: 24,
  },
  tutorialStartBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  tutorialStartBtnText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.white,
  },
});
