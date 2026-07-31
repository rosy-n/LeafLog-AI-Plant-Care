import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CHAR_IMG_W = Math.round(screenWidth * 0.55);
const CHAR_IMG_H = Math.min(Math.round(CHAR_IMG_W * (4 / 3)), Math.round(screenHeight * 0.35));

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },

  scrollContent: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },

  // Character image at top — Dimensions 기반 명시적 픽셀로 고정
  characterImage: {
    width: CHAR_IMG_W,
    height: CHAR_IMG_H,
    alignSelf: 'center',
    marginBottom: Spacing.xxl,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
  },

  // Input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    height: 52,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.subtitle,
    color: Colors.textBlack,
  },
  charCount: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
    marginLeft: Spacing.sm,
  },

  // 버튼 고정 컨테이너 — root View 하단, 키보드/스크롤 어떤 상태에도 위치 불변
  buttonContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.huge,
  },

  // Confirm button
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: Colors.disabled },
  confirmBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },
  confirmBtnTextDisabled: { color: Colors.textGray },
});
