import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

export const common = StyleSheet.create({
  flex: { flex: 1 },

  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.huge,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.subtitle,
    color: Colors.primary,
    textAlign: 'center' as const,
    marginBottom: Spacing.xl,
  },

  // Primary filled button
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },

  // Outline button
  outlineBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  outlineBtnText: {
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },

  // Disabled button
  disabledBtn: { backgroundColor: Colors.disabled },
  disabledBtnText: { color: Colors.textGray },

  // Row of two buttons
  rowBtns: {
    flexDirection: 'row' as const,
    gap: Spacing.md,
  },
  rowBtn: { flex: 1 },

  spacer: { flex: 1 },

  // Section label
  sectionLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textBlack,
    marginBottom: Spacing.md,
  },

  // Chip (selection pill)
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
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
    fontSize: FontSizes.body,
    color: Colors.textGray,
  },
  chipTextActive: { color: Colors.white },
});