import React from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors, GreenTint } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Radius, Spacing } from "../../constants/spacing";
import { playTapSfx } from "../feedback";

type Props = {
  onPress?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * 기록 작성 화면의 "사진 추가" 자리.
 * 분갈이·영양제 기록 폼에 똑같은 것이 하나씩 있어서 모았다.
 *
 * onPress 는 아직 붙는 화면이 없다 — 사진 선택 기능이 생기면 넘겨주면 된다.
 */
export default function PhotoPickerButton({
  onPress,
  label = "사진 추가",
  style,
}: Props) {
  // 아직 핸들러가 안 붙은 화면도 있어서, 실제로 반응할 때만 소리를 낸다
  const handlePress = onPress
    ? () => {
        playTapSfx();
        onPress();
      }
    : undefined;
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      activeOpacity={0.75}
      onPress={handlePress}
    >
      <Ionicons name="camera-outline" size={28} color={GreenTint.line} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: GreenTint.soft,
    height: 88,
    gap: Spacing.sm,
  },
  label: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: GreenTint.line,
    includeFontPadding: false,
  },
});
