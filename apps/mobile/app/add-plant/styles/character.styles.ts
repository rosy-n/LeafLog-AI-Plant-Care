import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    lineHeight: 32,
    marginBottom: 28,
    textAlign: 'center',
  },

  spacer: { flex: 1 },

  // Intro: sample characters row
  sampleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  sampleChar: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
  },

  // Guide: good/bad boxes
  guideSection: { gap: 14 },
  guideBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    gap: 8,
  },
  guideBoxBad: { borderLeftColor: '#E53935' },
  guideBoxTitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 14,
    color: Colors.textBlack,
    marginBottom: 4,
  },
  guideItem: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 22,
  },
  guideImageRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  guideImage: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },

  // Preview
  previewImage: {
    flex: 1,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: Colors.primaryLight,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: { flex: 1 },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },
  outlineBtn: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  outlineBtnText: {
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },

  // Generating
  generatingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  generatingTitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    lineHeight: 32,
    marginBottom: 32,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.disabled,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
  },

  // Result: completed character
  characterImage: {
    width: '70%',
    aspectRatio: 1,
    alignSelf: 'center',
    marginBottom: 32,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
  },
});
