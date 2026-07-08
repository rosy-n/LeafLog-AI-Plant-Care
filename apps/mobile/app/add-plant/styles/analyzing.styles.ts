import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.huge,
  },

  // Image에 aspectRatio를 런타임으로 주입하여 잘림 없이 표시
  photoPreview: {
    width: '100%',
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    marginBottom: Spacing.xxl,
  },

  // previewUri가 없을 때 보여줄 placeholder
  photoPreviewPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.lg,
    backgroundColor: Colors.disabled,
    marginBottom: Spacing.xxl,
  },

  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.disabled,
    borderRadius: Radius.xs,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.xs,
  },

  subtitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textGray,
    textAlign: 'center',
  },
});