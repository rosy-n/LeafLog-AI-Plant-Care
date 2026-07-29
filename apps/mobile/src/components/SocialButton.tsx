import React from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { Colors, Brand } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Radius, Spacing } from "../../constants/spacing";

type SocialButtonProps = {
  icon: string;
  label: string;
  tone?: "kakao";
  onPress?: () => void;
};

export default function SocialButton({ icon, label, tone, onPress }: SocialButtonProps) {
  const handlePress =
    onPress ?? (() => Alert.alert("준비 중", `${label} 로그인은 추후 연결하면 됩니다.`));
  return (
    <Pressable style={styles.socialButton} onPress={handlePress}>
      <Text style={[styles.socialIcon, tone === "kakao" && styles.kakaoIcon]}>{icon}</Text>
      <Text style={styles.socialLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  socialButton: {
    flex: 1,
    height: 58,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  socialIcon: {
    color: Brand.google,
    fontFamily: Fonts.nanumSquareNeo.heavy,
    fontSize: FontSizes.subtitle,
  },
  kakaoIcon: {
    width: 18,
    height: 18,
    borderRadius: Radius.sm,
    backgroundColor: Brand.kakao,
    color: Colors.textBlack,
    fontFamily: Fonts.nanumSquareNeo.bold,
    fontSize: FontSizes.caption,
    textAlign: "center",
    lineHeight: 18,
  },
  socialLabel: {
    color: Colors.textBlack,
    fontFamily: Fonts.nanumSquareNeo.bold,
    fontSize: FontSizes.body,
  },
});