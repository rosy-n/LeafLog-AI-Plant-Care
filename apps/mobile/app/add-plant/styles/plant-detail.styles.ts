import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';

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
    fontSize: FontSizes.title,
    color: Colors.textBlack,
    marginBottom: 20,
    textAlign: 'center',
  },

  // Image area with prev/next
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  plantImage: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textBlack,
  },
  navBtnHidden: { opacity: 0 },

  // Photo counter
  photoCounter: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Plant info
  plantName: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.title,
    color: Colors.textBlack,
    marginBottom: 4,
  },
  scientificName: {
    fontSize: FontSizes.body,
    fontStyle: 'italic',
    color: Colors.textGray,
    marginBottom: 4,
  },
  familyName: {
    fontSize: FontSizes.body,
    color: Colors.textGray,
    marginBottom: 28,
  },

  spacer: { flex: 1 },

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
    fontSize: FontSizes.bodyLarge,
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
    fontSize: FontSizes.bodyLarge,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
  },
});
