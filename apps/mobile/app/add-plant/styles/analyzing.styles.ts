import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 40,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    lineHeight: 32,
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 32,
  },

  // Skeleton blocks
  skeletonImage: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 16,
    backgroundColor: Colors.disabled,
    marginBottom: 20,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.disabled,
    marginBottom: 10,
  },
  skeletonLineShort: {
    width: '60%',
  },
});
