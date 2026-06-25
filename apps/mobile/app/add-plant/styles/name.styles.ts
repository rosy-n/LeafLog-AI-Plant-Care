import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },

  // Character image at top — Dimensions 기반 명시적 픽셀로 고정
  characterImage: {
    width: CHAR_IMG_W,
    height: CHAR_IMG_H,
    alignSelf: 'center',
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
  },

  // Input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    height: 52,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 18,
    color: Colors.textBlack,
  },
  charCount: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
    marginLeft: 8,
  },

  // 버튼 고정 컨테이너 — root View 하단, 키보드/스크롤 어떤 상태에도 위치 불변
  buttonContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  // Confirm button
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: Colors.disabled },
  confirmBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },
  confirmBtnTextDisabled: { color: Colors.textGray },
});
