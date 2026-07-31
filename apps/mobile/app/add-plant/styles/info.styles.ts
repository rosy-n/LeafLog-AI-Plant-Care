import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

export const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.huge2,
  },

  // Top plant header
  plantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.section,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  plantHeaderImage: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  plantHeaderName: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.subtitle,
    color: Colors.textBlack,
  },
  plantHeaderScientific: {
    fontSize: FontSizes.small,
    fontStyle: 'italic',
    color: Colors.textGray,
    marginTop: Spacing.xxs,
  },

  // Section
  section: { marginBottom: Spacing.section },
  sectionLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textBlack,
    marginBottom: Spacing.md,
  },
  requiredMark: { color: Colors.primary },

  // Chip group
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
  },
  chipLabelActive: { color: Colors.white },
  chipSub: {
    fontSize: FontSizes.caption,
    color: Colors.textGray,
    marginTop: Spacing.xxs,
  },
  chipSubActive: { color: Colors.white },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.none,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  stepperBtnText: {
    fontSize: FontSizes.title,
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
  },
  stepperValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    height: 44,
    minWidth: 80,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  stepperInput: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textBlack,
    minWidth: 40,
    textAlign: 'center',
  },
  stepperUnit: {
    fontSize: FontSizes.body,
    color: Colors.textGray,
  },

  // Date row (두 날짜 나란히)
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  dateBlock: { flex: 1 },
  dateBlockLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textBlack,
    marginBottom: Spacing.sm,
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dateDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  dateDropdownText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textBlack,
  },
  dateDropdownPlaceholder: { color: Colors.textGray },
  dateDropdownArrow: {
    fontSize: FontSizes.caption,
    color: Colors.textGray,
  },

  // Modal picker
  pickerBackdrop: {
    flex: 1,
    backgroundColor: Colors.scrim,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing.xxxl,
    maxHeight: 340,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  pickerTitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textBlack,
  },
  pickerDoneText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.primary,
  },
  pickerItem: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  pickerItemSelected: {
    backgroundColor: Colors.primaryLight,
  },
  pickerItemText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textBlack,
    textAlign: 'center',
  },
  pickerItemTextSelected: { color: Colors.primary },

  // Soil input
  soilInput: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    fontSize: FontSizes.body,
    color: Colors.textBlack,
    minHeight: 80,
  },
  charCount: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },

  // Save button
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnDisabled: { backgroundColor: Colors.disabled },
  saveBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },
  saveBtnTextDisabled: { color: Colors.textGray },
});