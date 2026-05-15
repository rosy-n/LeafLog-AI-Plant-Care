import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

const { width } = Dimensions.get('window');
// 3:4 portrait 이미지 — iPhone SE(667pt)까지 화면 넘침 없도록 140pt 상한 적용
const CHAR_SIZE = Math.min((width - 64) / 2, 140);
const CHAR_HEIGHT = Math.round(CHAR_SIZE * (4 / 3));

export const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  spacer: { flex: 1 },

  // ── Intro ──────────────────────────────────────────────────────────────────

  introSubtitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },

  charSampleWrap: {
    alignItems: 'center',
    gap: 8,
  },
  charTopRow: {
    flexDirection: 'row',
    gap: 24,
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
    gap: 8,
  },

  // ── Guide ──────────────────────────────────────────────────────────────────

  guideScreen: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },

  guideFooter: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },

  guideCategory: {
    marginBottom: 24,
  },

  guideCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  guideCategoryLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 15,
  },

  guideCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 6,
  },
  guidePoint: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textBlack,
    lineHeight: 20,
  },

  badExampleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  badExampleItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  badExampleImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  badExampleLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 11,
    color: Colors.textGray,
    textAlign: 'center',
  },

  // ── Preview ────────────────────────────────────────────────────────────────

  previewImage: {
    flex: 1,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: Colors.primaryLight,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: { flex: 1 },

  // ── Buttons ────────────────────────────────────────────────────────────────

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },
  outlineBtn: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  outlineBtnText: {
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },

  // ── Generating ─────────────────────────────────────────────────────────────

  generatingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  generatingTitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    lineHeight: 32,
    marginBottom: 32,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.disabled,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
  },

  // ── Result ─────────────────────────────────────────────────────────────────

  // placeholder 원본 1792×2388 = 3:4 portrait
  characterImage: {
    width: '55%',
    aspectRatio: 3 / 4,
    alignSelf: 'center',
    marginBottom: 32,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
  },
});
