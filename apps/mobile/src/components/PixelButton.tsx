import React from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Colors, Shadow, Glass } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Spacing } from "../../constants/spacing";
import PixelOutlineText from "./PixelOutlineText";

// 픽셀 아트 버튼 구성 단위 (모두 4px 그리드 토큰 기반)
const STEP = Spacing.xs; // 계단 한 칸 = 픽셀 하나
const BORDER = 3; // 검정 외곽선 두께 (xxs 2 ~ xs 4 사이 값 — 3px 토큰이 없어 직접 지정)

type PixelButtonProps = {
  label: string;
  onPress: () => void;
  /** 버튼 채움색 — colors 토큰 값을 넘겨받는다 (기본: 메인 초록) */
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * 2단 계단형 픽셀 라운드 사각형.
 * borderRadius(부드러운 곡선) 대신, 겹치는 3개의 사각형으로 계단(픽셀) 코너를 만든다.
 * inset 만큼 안쪽으로 그리면 바깥 검정 도형이 그대로 픽셀 테두리로 보인다.
 */
function PixelShape({ color, inset }: { color: string; inset: number }) {
  const s = STEP;
  return (
    <>
      <View
        style={[
          styles.layer,
          { backgroundColor: color, left: inset, right: inset, top: inset + 2 * s, bottom: inset + 2 * s },
        ]}
      />
      <View
        style={[
          styles.layer,
          { backgroundColor: color, left: inset + s, right: inset + s, top: inset + s, bottom: inset + s },
        ]}
      />
      <View
        style={[
          styles.layer,
          { backgroundColor: color, left: inset + 2 * s, right: inset + 2 * s, top: inset, bottom: inset },
        ]}
      />
    </>
  );
}

/**
 * 픽셀 아트 스타일 버튼 (assets/button_ex.png 참고).
 * 계단형 검정 픽셀 테두리 + 솔리드 채움 + 블록형 좌상단 하이라이트 +
 * 하단 음영 + 계단형 드롭섀도로 레트로 픽셀 버튼을 표현한다.
 */
export default function PixelButton({
  label,
  onPress,
  color = Colors.primary,
  disabled = false,
  style,
}: PixelButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.frame}>
        {/* 계단형 드롭섀도 (아래로 한 칸 오프셋) */}
        <View style={styles.shadowLayer}>
          <PixelShape color={Shadow.color} inset={0} />
        </View>
        {/* 검정 픽셀 테두리 */}
        <PixelShape color={Colors.textBlack} inset={0} />
        {/* 채움 (테두리 두께만큼 안쪽) */}
        <PixelShape color={color} inset={BORDER} />
        {/* 하단 음영 — 입체감 */}
        <View style={styles.shade} />
        {/* 좌상단 블록형 픽셀 하이라이트 */}
        <View style={styles.glossBar} />
        <View style={styles.glossDot} />
        {/* 라벨 (흐름 배치 → 버튼 크기를 결정, 항상 최상단) */}
        <View style={styles.content}>
          <PixelOutlineText style={styles.label}>{label}</PixelOutlineText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
  },
  wrapper: {
    alignItems: "stretch",
  },
  pressed: {
    transform: [{ translateY: 2 }],
  },
  disabled: {
    opacity: 0.5,
  },
  frame: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  label: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
  },
  shadowLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.28,
    transform: [{ translateY: STEP }],
  },
  shade: {
    position: "absolute",
    left: BORDER + 2 * STEP,
    right: BORDER + 2 * STEP,
    bottom: BORDER,
    height: Spacing.md,
    backgroundColor: Shadow.color,
    opacity: 0.18,
  },
  glossBar: {
    position: "absolute",
    top: BORDER + STEP,
    left: BORDER + 2 * STEP,
    width: STEP * 4,
    height: STEP,
    backgroundColor: Glass.frost72,
  },
  glossDot: {
    position: "absolute",
    top: BORDER + 2 * STEP,
    left: BORDER + STEP,
    width: STEP,
    height: STEP,
    backgroundColor: Glass.frost72,
  },
});