import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // common.title 위에 덮는 오버라이드만 남김
  titleOverride: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },

  // Thumbnail strip (multiple photos only)
  photoStripList: {
    flexGrow: 0,
    flexShrink: 0,
  },
  photoStrip: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
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
    borderRadius: 4,
    paddingVertical: 2,
    alignItems: 'center',
  },
  organTagText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 10,
    color: Colors.white,
  },

  // "선택된 사진" label (multiple only)
  selectedLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
    paddingHorizontal: 20,
    marginBottom: 8,
    textAlign: 'center',
  },

  // Large photo
  largePhotoContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.primaryLight,
  },
  largePhoto: {
    width: '100%',
    height: '100%',
  },

  // Organ section — no white background
  organSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  organLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textBlack,
  },
  organChips: {
    flexDirection: 'row',
    gap: 8,
  },
  organChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 4,
  },
  organChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  organChipEmoji: {
    fontSize: 18,
  },
  organChipText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 11,
    color: Colors.textGray,
  },
  organChipTextActive: {
    color: Colors.primary,
  },
  organChipWide: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 10,
  },
  organChipSub: {
    fontSize: 10,
    color: Colors.textGray,
    marginTop: 2,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
  },
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
});
