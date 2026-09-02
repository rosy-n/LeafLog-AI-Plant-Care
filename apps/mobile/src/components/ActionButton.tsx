import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Radius, Spacing } from "../../constants/spacing";
import { tapFeedback } from "../feedback";

type Props = {
  /** children 을 넘기면 무시된다 */
  label?: string;
  onPress: () => void;
  /** 채움색. 화면 주제색(영양제·분갈이 등)이 그대로 들어온다 */
  color: string;
  textColor?: string;
  /** Ionicons 이름 — 있으면 라벨 왼쪽에 붙는다 */
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  /** 테두리를 두르는 버튼(흰 바탕 + 색 테두리)일 때만 지정 */
  borderColor?: string;
  /** lg: 화면 하단 저장 버튼 · md: 카드 안이나 모달의 작은 버튼 */
  size?: "md" | "lg";
  /** 채움색과 같은 색의 그림자 — 바탕에 얹히는 버튼만 켠다 */
  shadow?: boolean;
  disabled?: boolean;
  activeOpacity?: number;
  /** 폭·여백처럼 호출부에서만 아는 배치값 (마지막에 적용돼 위를 덮는다) */
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /**
   * 라벨 대신 직접 그릴 내용. 아이콘 여러 개를 섞는 버튼처럼
   * label 하나로 표현이 안 될 때만 쓴다 (PixelSurface 와 같은 방식).
   * 넘기면 icon·label 은 무시된다.
   */
  children?: React.ReactNode;
};

/**
 * 라벨(+아이콘) 하나를 담는 가로로 긴 액션 버튼.
 * 저장하기·새 기록 작성·모달의 확인처럼 화면마다 따로 만들어 쓰던 버튼들을 모았다.
 *
 * 색과 크기만 다르고 구조는 같아서, 다른 부분만 props 로 받는다.
 * 픽셀 테두리 버튼(PixelButton)과는 결이 다른 계열이라 별도로 둔다.
 */
export default function ActionButton({
  label,
  onPress,
  color,
  textColor = Colors.white,
  icon,
  iconColor,
  iconSize = 22,
  borderColor,
  size = "lg",
  shadow = true,
  disabled = false,
  activeOpacity = 0.82,
  style,
  textStyle,
  children,
}: Props) {
  const large = size === "lg";
  const handlePress = () => {
    tapFeedback();
    onPress();
  };
  return (
    <TouchableOpacity
      style={[
        styles.button,
        large ? styles.buttonLarge : styles.buttonMedium,
        { backgroundColor: color },
        borderColor ? { borderWidth: 1.5, borderColor } : null,
        shadow ? [styles.shadow, large ? styles.shadowLarge : styles.shadowMedium, { shadowColor: color }] : null,
        disabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      activeOpacity={activeOpacity}
      disabled={disabled}
    >
      {children ?? (
        <>
          {icon ? (
            <Ionicons name={icon as any} size={iconSize} color={iconColor ?? textColor} />
          ) : null}
          <Text
            style={[
              styles.label,
              large ? styles.labelLarge : styles.labelMedium,
              { color: textColor },
              textStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  buttonLarge: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
  },
  buttonMedium: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
  },
  shadow: {
    shadowOffset: { width: 0, height: 3 },
  },
  shadowLarge: {
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  shadowMedium: {
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    fontFamily: Fonts.neoDunggeunmo,
    includeFontPadding: false,
  },
  labelLarge: {
    fontSize: FontSizes.bodyLarge,
  },
  labelMedium: {
    fontSize: FontSizes.body,
  },
});
