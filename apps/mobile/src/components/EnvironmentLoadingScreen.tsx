import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, StyleSheet, View } from "react-native";
import { Colors } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Radius, Spacing } from "../../constants/spacing";
import { BACKGROUND_IMAGES, HOME_BACKGROUND_KEY } from "../data/decor";
import PixelOutlineText from "./PixelOutlineText";

const BAR_WIDTH = 220;
const FILL_WIDTH = 90;

// 대기 시간 동안 순환 표시할 안내 문구 — 실제로 뭘 불러오는지 번갈아 알려준다
const LOADING_MESSAGES = [
  "우리 동네 날씨를 확인하고 있어요",
  "우리 동네 대기질을 확인하고 있어요",
  "식물들의 정보를 불러오고 있어요",
];
const MESSAGE_INTERVAL_MS = 1800;

/*
    로그인 직후 날씨/대기질(getCurrentEnvironment) 응답을 기다리는 동안 보여주는 화면.
    응답 시간이 일정하지 않아 실제 진행률을 계산할 수 없으므로, 로딩바는 진행률이
    아니라 "기다리는 중"이라는 사실만 전달하는 무한 반복 애니메이션이다.
*/
export default function EnvironmentLoadingScreen() {
  const progress = useRef(new Animated.Value(0)).current;
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-FILL_WIDTH, BAR_WIDTH],
  });

  return (
    <ImageBackground
      source={BACKGROUND_IMAGES[HOME_BACKGROUND_KEY]}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.captionWrap}>
        <PixelOutlineText style={styles.caption}>
          {LOADING_MESSAGES[messageIndex]}
        </PixelOutlineText>
      </View>
      <View style={styles.barWrap}>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, { width: FILL_WIDTH, transform: [{ translateX }] }]}
          />
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // 진행바 너비(BAR_WIDTH)와 안내 문구 너비는 서로 무관하다 — barWrap에
  // 함께 두면 문구가 진행바 폭에 맞춰 줄바꿈된다. 별도 래퍼로 분리해서
  // 화면 폭 안에서는 한 줄에 들어가게 한다.
  captionWrap: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    alignItems: "center",
  },
  barWrap: {
    width: BAR_WIDTH,
    alignItems: "center",
  },
  caption: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    textAlign: "center",
  },
  track: {
    width: "100%",
    height: Spacing.md,
    borderRadius: Radius.xs,
    backgroundColor: Colors.overlay,
    borderWidth: 2,
    borderColor: Colors.textBlack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: Radius.xs,
    backgroundColor: Colors.primary,
  },
});
