import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { Colors } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Spacing } from "../../constants/spacing";

const STEP = Spacing.xs; // 본체 계단 한 칸
const BORDER = 3; // 검정 테두리 두께
const TAIL = Spacing.sm; // 꼬리 계단 한 칸 (8px)
const TAIL_STEPS = 3; // 꼬리 계단 수

// 2단 계단형 픽셀 라운드 사각형 (겹치는 3개의 사각형)
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

// 아래로 향하는 계단형 픽셀 꼬리 — 검정 계단(외곽선) 위에 흰 계단(속)을 겹쳐 그린다.
function PixelTail({ fill, border, offset }: { fill: string; border: string; offset: number }) {
  const blackRows = [];
  const whiteRows = [];
  for (let i = 0; i < TAIL_STEPS; i++) {
    const isLast = i === TAIL_STEPS - 1;
    const w = (TAIL_STEPS - i) * TAIL; // 위가 가장 넓고 아래로 좁아짐
    const iw = Math.max(0, w - BORDER * 2); // 흰 속 (좌우 테두리만큼 좁게)
    blackRows.push(
      <View
        key={`b${i}`}
        style={[styles.tailRow, { backgroundColor: border, width: w, height: TAIL, top: i * TAIL, marginLeft: -w / 2 }]}
      />
    );
    whiteRows.push(
      <View
        key={`w${i}`}
        style={[
          styles.tailRow,
          {
            backgroundColor: fill,
            width: iw,
            // 마지막(끝) 칸은 아래에 검정 테두리가 보이도록 높이를 줄인다
            height: isLast ? Math.max(0, TAIL - BORDER) : TAIL,
            top: i * TAIL,
            marginLeft: -iw / 2,
          },
        ]}
      />
    );
  }
  return (
    <View style={[styles.tail, { left: offset }]}>
      {blackRows}
      {whiteRows}
    </View>
  );
}

type PixelSpeechBubbleProps = {
  children: React.ReactNode;
  /** 본체 크기·위치 (width/height/position 등) */
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fill?: string;
  border?: string;
  /** 꼬리의 가로 중심 x (본체 왼쪽 기준) */
  tailOffset?: number;
};

/**
 * 도트(픽셀) 스타일 말풍선. 본체는 계단형 픽셀 테두리, 꼬리도 계단형 픽셀로
 * 그려 대각선 앤티앨리어싱 없이 레트로 도트 느낌을 낸다.
 */
export default function PixelSpeechBubble({
  children,
  style,
  textStyle,
  fill = Colors.white,
  border = Colors.textBlack,
  tailOffset = 60,
}: PixelSpeechBubbleProps) {
  return (
    <View style={[styles.frame, style]}>
      {/* 검정 픽셀 테두리 */}
      <PixelShape color={border} inset={0} />
      {/* 흰 속 (테두리 두께만큼 안쪽) */}
      <PixelShape color={fill} inset={BORDER} />
      {/* 계단형 꼬리 */}
      <PixelTail fill={fill} border={border} offset={tailOffset} />
      {/* 내용 */}
      <View style={styles.content}>
        <Text style={[styles.text, textStyle]}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
  },
  frame: {
    position: "relative",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
  },
  text: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.subtitle,
    color: Colors.textBlack,
  },
  tail: {
    position: "absolute",
    top: "100%",
    marginTop: -BORDER, // 본체 바닥 테두리와 겹쳐 속을 연결
  },
  tailRow: {
    position: "absolute",
    left: 0,
  },
});