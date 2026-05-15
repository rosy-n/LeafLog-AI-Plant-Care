import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

export const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },

  // Top plant header
  plantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
  },
  plantHeaderImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  plantHeaderName: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 18,
    color: Colors.textBlack,
  },
  plantHeaderScientific: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textGray,
    marginTop: 2,
  },

  // Section
  section: { marginBottom: 28 },
  sectionLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 15,
    color: Colors.textBlack,
    marginBottom: 12,
  },
  requiredMark: { color: Colors.primary },

  // Chip group
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
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
    fontSize: 13,
    color: Colors.textGray,
  },
  chipLabelActive: { color: Colors.white },
  chipSub: {
    fontSize: 10,
    color: Colors.textGray,
    marginTop: 2,
  },
  chipSubActive: { color: Colors.white },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
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
    fontSize: 20,
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
  },
  stepperValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    height: 44,
    minWidth: 80,
    justifyContent: 'center',
    gap: 4,
  },
  stepperInput: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
    color: Colors.textBlack,
    minWidth: 40,
    textAlign: 'center',
  },
  stepperUnit: {
    fontSize: 13,
    color: Colors.textGray,
  },

  // Date row (두 날짜 나란히)
  dateRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateBlock: { flex: 1 },
  dateBlockLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textBlack,
    marginBottom: 8,
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  dateDropdownText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textBlack,
  },
  dateDropdownPlaceholder: { color: Colors.textGray },
  dateDropdownArrow: {
    fontSize: 10,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: 340,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  pickerTitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 14,
    color: Colors.textBlack,
  },
  pickerDoneText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 15,
    color: Colors.primary,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  pickerItemSelected: {
    backgroundColor: Colors.primaryLight,
  },
  pickerItemText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 15,
    color: Colors.textBlack,
    textAlign: 'center',
  },
  pickerItemTextSelected: { color: Colors.primary },

  // Soil input
  soilInput: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    color: Colors.textBlack,
    minHeight: 80,
  },
  charCount: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: 4,
  },

  // Save button
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { backgroundColor: Colors.disabled },
  saveBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },
  saveBtnTextDisabled: { color: Colors.textGray },
});
