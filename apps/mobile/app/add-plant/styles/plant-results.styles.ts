import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts, FontSizes } from '../../../constants/fonts';
import { Spacing, Radius } from '../../../constants/spacing';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    backgroundColor: Colors.background,
    paddingBottom: Spacing.xxl,
  },

  // common.title 위에 덮는 오버라이드만 남김 (heroPhoto 풀너비 때문에 패딩 직접 지정)
  titleOverride: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },

  // 사용자 촬영 사진 (전체 너비, aspectRatio는 런타임에 설정)
  heroPhoto: {
    width: '100%',
    marginBottom: Spacing.xl,
    backgroundColor: Colors.primaryLight,
  },

  // Result card
  card: {
    backgroundColor: Colors.surfaceGray,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.xl,
  },

  // 가로 스크롤 참고 이미지
  refImageRow: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  refImage: {
    width: 72,
    height: 72,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
  },

  // Card 정보 영역
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  cardInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  cardScore: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.primary,
  },
  cardScientific: {
    fontSize: FontSizes.body,
    fontStyle: 'italic',
    color: Colors.textBlack,
  },
  cardCommon: {
    fontSize: FontSizes.small,
    color: Colors.textGray,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  confirmBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
  },

  // 참고 이미지 풀스크린 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: width,
    height: height * 0.75,
  },

  // 결과 없음
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.xl,
  },
  emptyText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorText: {
    fontSize: FontSizes.small,
    color: Colors.danger,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.section,
  },
  retryBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },
});