import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";

import { Colors } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";

type Props = {
  onPress: () => void;
  /** 배치용 스타일 오버라이드 (절대 위치·박스 크기 등) */
  style?: StyleProp<ViewStyle>;
};

/**
 * 앱 공용 뒤로가기 버튼.
 * 글리프는 던근모(픽셀) '<' — 던근모에 '‹'(U+2039)가 없어 ASCII '<'를 쓴다.
 * 화면마다 헤더 높이가 달라 박스 크기는 style로 덮어쓸 수 있게 열어둔다.
 */
export default function BackButton({ onPress, style }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.button, style]} hitSlop={12}>
      <Text style={styles.glyph}>&lt;</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    color: Colors.textGray,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.display,
    lineHeight: 38,
    includeFontPadding: false,
  },
});