import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { Colors, Glass } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Radius, Spacing } from "../../constants/spacing";
import { playTapSfx } from "../feedback";

type Props = {
  label: string;
  onPress: () => void;
  /** Ionicons 이름 — 생략하면 라벨만 보인다 (홈만 아이콘을 쓴다) */
  icon?: string;
  /** 알약 너비 — 라벨 길이에 맞춰 화면마다 조금씩 다르다 */
  width?: number;
};

/**
 * 반투명 유리 알약 메뉴 항목.
 * 홈·추모·개체상세의 팝업 메뉴가 같은 모양이라 하나로 모았다.
 *
 * 원형 아이콘 버튼(LiquidGlassButton)과 재료는 같지만 그쪽은 지름 하나로
 * 원을 그리는 구조라 이 알약 모양에는 쓸 수 없어 따로 둔다.
 */
export default function GlassMenuItem({ label, onPress, icon, width = 116 }: Props) {
  const handlePress = () => {
    playTapSfx();
    onPress();
  };
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={[styles.touch, { width }]}
      onPress={handlePress}
    >
      <BlurView intensity={28} tint="light" style={styles.blur}>
        <LinearGradient
          colors={[Glass.frost72, Glass.mist, Glass.mistSoft]}
          start={{ x: 0.12, y: 0.05 }}
          end={{ x: 1, y: 1 }}
          style={styles.glass}
        >
          <View style={styles.highlight} />
          {icon ? (
            <Ionicons
              name={icon as any}
              size={14}
              color={Colors.textBlack}
              style={styles.icon}
            />
          ) : null}
          <Text style={styles.text}>{label}</Text>
        </LinearGradient>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: {
    height: 31,
    borderRadius: Radius.lg,
    overflow: "hidden",
    shadowColor: Colors.textBlack,
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  blur: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Glass.frost72,
  },
  glass: {
    flex: 1,
    borderRadius: Radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Glass.frost45,
  },
  highlight: {
    position: "absolute",
    top: 4,
    left: 10,
    width: 34,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Glass.frost60,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  text: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.textBlack,
    textShadowColor: Glass.frost60,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
});
