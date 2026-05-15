import { Dimensions, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    backgroundColor: Colors.background,
    paddingBottom: 24,
  },

  // common.title 위에 덮는 오버라이드만 남김 (heroPhoto 풀너비 때문에 패딩 직접 지정)
  titleOverride: {
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 20,
  },

  // 사용자 촬영 사진 (전체 너비, aspectRatio는 런타임에 설정)
  heroPhoto: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: Colors.primaryLight,
  },

  // Result card
  card: {
    backgroundColor: Colors.surfaceGray,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    marginHorizontal: 20,
  },

  // 가로 스크롤 참고 이미지
  refImageRow: {
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  refImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },

  // Card 정보 영역
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardScore: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
    color: Colors.primary,
  },
  cardScientific: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.textBlack,
  },
  cardCommon: {
    fontSize: 12,
    color: Colors.textGray,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
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
    padding: 32,
    gap: 20,
  },
  emptyText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 15,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorText: {
    fontSize: 12,
    color: '#E53935',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  retryBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 15,
  },
});
