import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

export const styles = StyleSheet.create({
  flex: { flex: 1 },

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
    marginBottom: 24,
    textAlign: 'center',
  },

  // Camera button (solid green, full-width)
  cameraBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  cameraBtnIcon: { fontSize: 20 },
  cameraBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
  },

  // Search row (input + 취소 버튼)
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  searchWrapperActive: {
    borderColor: Colors.primary,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: Colors.textBlack,
  },
  searchSpinner: { marginLeft: 8 },

  cancelBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  cancelText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 14,
    color: Colors.primary,
  },

  // Dropdown
  dropdown: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: Colors.textBlack,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textBlack,
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: Colors.separator,
    marginHorizontal: 14,
  },

  // Loading overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 100,
  },
  overlayText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 14,
    color: Colors.textBlack,
  },
});
