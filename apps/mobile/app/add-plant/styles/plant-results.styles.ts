import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/fonts';

export const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    marginBottom: 16,
    textAlign: 'center',
  },

  // 사용자 입력 사진 (상단 크게)
  userPhotoSection: {
    marginBottom: 20,
  },
  userPhotoLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
    marginBottom: 8,
  },
  userPhotoScroll: {
    gap: 8,
  },
  userPhoto: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
  },

  // Result card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: Colors.textBlack,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
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
