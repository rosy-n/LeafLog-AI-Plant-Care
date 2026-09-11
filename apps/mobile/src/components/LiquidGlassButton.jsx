import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Leaf, Glass } from "../../constants/colors";
import { Radius } from "../../constants/spacing";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { tapFeedback } from "../feedback";
import { useHighlightPulse } from "../hooks/useHighlightPulse";

// highlighted: 튜토리얼이 이 버튼을 가리키는 동안 배경을 초록 계열로 바꾸고
// 커졌다 작아졌다 펄스를 줘서 "눌러야 하는 버튼"임을 알려준다
export default function LiquidGlassButton({
                                              children,
                                              onPress,
                                              size = 54,
                                              style,
                                              highlighted = false,
                                          }) {
    const pulseScale = useHighlightPulse(highlighted);
    const handlePress = () => {
        tapFeedback();
        onPress?.();
    };
    return (
        <TouchableOpacity
            activeOpacity={0.78}
            onPress={handlePress}
            style={[
                styles.touch,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                style,
                { transform: [{ scale: pulseScale }] },
            ]}
        >
            <BlurView
                intensity={28}
                tint="light"
                style={[
                    styles.blur,
                    { borderRadius: size / 2 },
                    highlighted && styles.blurHighlighted,
                ]}
            >
                <LinearGradient
                    colors={
                        highlighted
                            ? [Glass.leafHi, Glass.leafMid, Glass.leafLow]
                            : [Glass.frost72, Glass.mist, Glass.mistSoft]
                    }
                    start={{ x: 0.12, y: 0.05 }}
                    end={{ x: 0.9, y: 1 }}
                    style={[
                        styles.gradient,
                        { borderRadius: size / 2 },
                        highlighted && styles.gradientHighlighted,
                    ]}
                >
                    <View style={styles.highlight} />
                    <View style={styles.content}>{children}</View>
                </LinearGradient>
            </BlurView>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    touch: {
        overflow: "hidden",
        shadowColor: Leaf.forest,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 5,
        elevation: 5,
    },
    blur: {
        flex: 1,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Glass.frost72,
    },
    // 튜토리얼이 이 버튼을 가리킬 때 — 테두리도 같은 초록 계열로 바꿔 채움과 함께 눈에 띄게 한다
    blurHighlighted: {
        borderColor: Glass.leafLow,
    },
    gradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 0.8,
        borderColor: Glass.frost45,
    },
    gradientHighlighted: {
        borderColor: Glass.leafMid,
    },
    highlight: {
        position: "absolute",
        top: 7,
        left: 10,
        width: "38%",
        height: "20%",
        borderRadius: Radius.pill,
        backgroundColor: Glass.frost60,
    },
    content: {
        alignItems: "center",
        justifyContent: "center",
    },
});