import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

export const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Character image at top
  characterImage: {
    width: '55%',
    aspectRatio: 1,
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

  spacer: { flex: 1 },

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
