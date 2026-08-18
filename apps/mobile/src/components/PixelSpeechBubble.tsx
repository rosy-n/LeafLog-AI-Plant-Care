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
  /** 내용 영역(content) 패딩 등을 개별 사용처에서 덮어쓸 때 */
  contentStyle?: StyleProp<ViewStyle>;
  fill?: string;
  border?: string;
  /** 꼬리의 가로 중심 x (본체 왼쪽 기준) */
  tailOffset?: number;
  /**
   * true면 children(문자열)을 공백 기준 단어로 쪼개 flex-wrap 행에 각각 별도 Text로 그린다.
   * RN의 기본 줄바꿈은 한글에서 공백이 아닌 음절 사이에서도 끊을 수 있어(단어 중간 개행),
   * 이를 막고 "공백에서만 다음 줄로" 넘어가게 하려면 단어 자체를 쪼개지지 않는 레이아웃
   * 단위(각각의 Text)로 만들어야 한다.
   */
  wrapWords?: boolean;
};

// 다른 말풍선형 UI(페르소나 대화창 등)에서도 같은 단어-보존 줄바꿈이 필요해 컴포넌트 밖에서도 쓸 수 있게 export.
export function WordWrapText({
  text,
  style,
  align = "center",
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  /** 줄마다 단어를 어느 쪽으로 모을지 — 중앙 정렬 말풍선 vs 왼쪽 정렬 대화문 */
  align?: "center" | "flex-start";
}) {
  const words = text.split(" ");
  return (
    <View style={[styles.wordWrapRow, { justifyContent: align }]}>
      {words.map((word, i) => (
        <Text key={i} style={style}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </Text>
      ))}
    </View>
  );
}

/**
 * 도트(픽셀) 스타일 말풍선. 본체는 계단형 픽셀 테두리, 꼬리도 계단형 픽셀로
 * 그려 대각선 앤티앨리어싱 없이 레트로 도트 느낌을 낸다.
 */
export default function PixelSpeechBubble({
  children,
  style,
  textStyle,
  contentStyle,
  fill = Colors.white,
  border = Colors.textBlack,
  tailOffset = 60,
  wrapWords = false,
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
      <View style={[styles.content, contentStyle]}>
        {wrapWords && typeof children === "string" ? (
          <WordWrapText text={children} style={[styles.text, textStyle]} />
        ) : (
          <Text style={[styles.text, textStyle]} textBreakStrategy="simple">
            {children}
          </Text>
        )}
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
  wordWrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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