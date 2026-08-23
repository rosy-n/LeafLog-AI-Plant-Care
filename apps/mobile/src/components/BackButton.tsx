import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";

import { Colors } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { tapFeedback } from "../feedback";

type Props = {
  onPress: () => void;
  /**
   * 글리프 크기. 옆에 나란히 놓이는 텍스트와 높이를 맞출 때 그 글자 크기를
   * 넘긴다 (예: ScreenHeader는 headerTitle.fontSize). 생략하면 기본 크기.
   */
  size?: number;
  /** 배치용 스타일 오버라이드 (절대 위치·박스 크기 등) */
  style?: StyleProp<ViewStyle>;
};

/**
 * 앱 공용 뒤로가기 버튼.
 * 글리프는 던근모(픽셀) '<' — 던근모에 '‹'(U+2039)가 없어 ASCII '<'를 쓴다.
 * 화면마다 헤더 높이가 달라 박스 크기는 style로 덮어쓸 수 있게 열어둔다.
 */
export default function BackButton({ onPress, size, style }: Props) {
  const handlePress = () => {
    tapFeedback();
    onPress();
  };
  return (
    <Pressable onPress={handlePress} style={[styles.button, style]} hitSlop={12}>
      {/* size 지정 시 lineHeight를 두지 않아 같은 크기의 일반 텍스트와 높이가 같아진다 */}
      <Text style={[styles.glyph, size == null ? styles.glyphDefault : { fontSize: size }]}>
        &lt;
      </Text>
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
    includeFontPadding: false,
  },
  glyphDefault: {
    fontSize: FontSizes.display,
    lineHeight: 38,
  },
});