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

  // Image에 aspectRatio를 런타임으로 주입하여 잘림 없이 표시
  photoPreview: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    marginBottom: 24,
  },

  // previewUri가 없을 때 보여줄 placeholder
  photoPreviewPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: Colors.disabled,
    marginBottom: 24,
  },

  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.disabled,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },

  subtitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
    textAlign: 'center',
  },
});
