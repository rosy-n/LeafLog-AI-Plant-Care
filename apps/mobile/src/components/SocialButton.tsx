import React from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { Colors, Brand } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Spacing } from "../../constants/spacing";
import { PixelSurface } from "./PixelButton";

type SocialButtonProps = {
  icon: string;
  label: string;
  tone?: "kakao";
  onPress?: () => void;
};

/**
 * 소셜 로그인 버튼 — PixelSurface(계단형 픽셀 테두리)에 아이콘+라벨을 얹는다.
 * 3개가 가로로 나란히 놓이므로 기본 패딩보다 좁게 잡는다.
 */
export default function SocialButton({ icon, label, tone, onPress }: SocialButtonProps) {
  const handlePress =
    onPress ?? (() => Alert.alert("준비 중", `${label} 로그인은 추후 연결하면 됩니다.`));
  return (
    <PixelSurface
      onPress={handlePress}
      color={Colors.background}
      style={styles.socialButton}
      contentStyle={styles.socialContent}
    >
      <Text style={[styles.socialIcon, tone === "kakao" && styles.kakaoIcon]}>{icon}</Text>
      <Text style={styles.socialLabel}>{label}</Text>
    </PixelSurface>
  );
}

const styles = StyleSheet.create({
  socialButton: {
    flex: 1,
  },
  socialContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  socialIcon: {
    color: Brand.google,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },
  // 픽셀 스타일이므로 라운드 없이 정사각 블록으로 둔다
  kakaoIcon: {
    width: 18,
    height: 18,
    backgroundColor: Brand.kakao,
    color: Colors.textBlack,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.caption,
    textAlign: "center",
    lineHeight: 18,
  },
  socialLabel: {
    color: Colors.textBlack,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
  },
});