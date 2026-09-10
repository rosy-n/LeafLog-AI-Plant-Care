import { Dimensions, StyleSheet } from 'react-native';
import { Colors, GreenTint } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

const { width: screenWidth } = Dimensions.get('window');

// 칩 그리드(위치·햇빛 2열, 화분 종류 3열) — 퍼센트 flexBasis는 RN에서 gap을 빼고
// 계산하지 않아 줄바꿈이 어긋나므로, 컨테이너 폭 기준 픽셀 폭을 직접 계산한다
// (character.styles.ts / persona.styles.ts와 동일 패턴)
const CHIP_GRID_CONTAINER_WIDTH = screenWidth - Spacing.xl * 2;
const chipGridItemWidth = (columns: number) =>
  Math.floor((CHIP_GRID_CONTAINER_WIDTH - Spacing.sm * (columns - 1)) / columns);
const CHIP_GRID_ITEM_WIDTH_2 = chipGridItemWidth(2);
const CHIP_GRID_ITEM_WIDTH_3 = chipGridItemWidth(3);

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
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: GreenTint.line,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  plantHeaderImage: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
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

  // Chip (선택 버튼 공용 색상 · 폰트 토큰 — 크기는 그리드별 스타일이 덧씌운다)
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textGray,
  },
  chipLabelActive: { color: Colors.white },
  chipSub: {
    fontSize: FontSizes.body,
    color: Colors.textGray,
    marginTop: Spacing.xxs,
  },
  chipSubActive: { color: Colors.white },

  // 칩 그리드 컨테이너 (위치 · 햇빛 · 화분 종류 공용) — 열 개수는 아이템 폭으로 결정
  chipGridGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  // 2열 (위치 · 햇빛)
  chipGrid2: {
    width: CHIP_GRID_ITEM_WIDTH_2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  // 3열 (화분 종류)
  chipGrid3: {
    width: CHIP_GRID_ITEM_WIDTH_3,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },

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