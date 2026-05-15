import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

export const common = StyleSheet.create({
  flex: { flex: 1 },

  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 18,
    color: Colors.primary,
    textAlign: 'center' as const,
    marginBottom: 20,
  },

  // Primary filled button
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },

  // Outline button
  outlineBtn: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  outlineBtnText: {
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },

  // Disabled button
  disabledBtn: { backgroundColor: Colors.disabled },
  disabledBtnText: { color: Colors.textGray },

  // Row of two buttons
  rowBtns: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  rowBtn: { flex: 1 },

  spacer: { flex: 1 },

  // Section label
  sectionLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 15,
    color: Colors.textBlack,
    marginBottom: 12,
  },

  // Chip (selection pill)
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
  },
  chipTextActive: { color: Colors.white },
});
