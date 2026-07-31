import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.huge,
  },

  // common.title 위에 덮는 오버라이드만 남김
  titleOverride: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },

  // Thumbnail strip (multiple photos only)
  photoStripList: {
    flexGrow: 0,
    flexShrink: 0,
  },
  photoStrip: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    borderWidth: 2.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  photoThumbSelected: {
    borderColor: Colors.primary,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  organTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xs,
    paddingVertical: Spacing.xxs,
    alignItems: 'center',
  },
  organTagText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.caption,
    color: Colors.white,
  },

  // "선택된 사진" label (multiple only)
  selectedLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },

  // Large photo
  largePhotoContainer: {
    flex: 1,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.primaryLight,
  },
  largePhoto: {
    width: '100%',
    height: '100%',
  },

  // Organ section — no white background
  organSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  organLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textBlack,
  },
  organChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  organChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  organChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  organChipEmoji: {
    fontSize: FontSizes.subtitle,
  },
  organChipText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.textGray,
  },
  organChipTextActive: {
    color: Colors.primary,
  },
  organChipWide: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  organChipSub: {
    fontSize: FontSizes.caption,
    color: Colors.textGray,
    marginTop: Spacing.xxs,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.xl,
  },
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
});