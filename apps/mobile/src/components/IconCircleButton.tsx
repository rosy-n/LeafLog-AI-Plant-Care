import React from "react";
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors, GreenTint } from "../../constants/colors";
import { Radius } from "../../constants/spacing";

type Props = {
  /** Ionicons 이름 */
  icon: string;
  onPress: () => void;
  /** 원 지름 — 기본값은 채팅 입력줄 옆 버튼 크기 */
  size?: number;
  iconSize?: number;
  /** 원 배경. 생략하면 투명 (아이콘만 보이는 버튼) */
  color?: string;
  iconColor?: string;
  disabled?: boolean;
  /** 비활성일 때 배경 — color 를 준 버튼에만 의미가 있다 */
  disabledColor?: string;
  activeOpacity?: number;
  /** 배치용 여백 등 호출부 사정에 맞춘 오버라이드 */
  style?: StyleProp<ViewStyle>;
};

/**
 * 아이콘 하나만 담는 원형 버튼.
 * 채팅 입력줄의 보내기·첨부·닫기처럼 입력창 옆에 붙는 작은 버튼들이 이 모양이다.
 *
 * 색과 여백만 다른 같은 버튼이 상담·개체상세에 흩어져 있어서 하나로 모았다.
 */
export default function IconCircleButton({
  icon,
  onPress,
  size = 34,
  iconSize = 20,
  color,
  iconColor = Colors.white,
  disabled = false,
  disabledColor = GreenTint.line,
  activeOpacity = 0.8,
  style,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { width: size, height: size },
        color ? { backgroundColor: color } : null,
        disabled && color ? { backgroundColor: disabledColor } : null,
        style,
      ]}
      onPress={onPress}
      activeOpacity={activeOpacity}
      disabled={disabled}
    >
      <Ionicons name={icon as any} size={iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
