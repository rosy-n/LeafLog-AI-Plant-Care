import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, Leaf } from "../../constants/colors";
import { Spacing } from "../../constants/spacing";

const STROKE_DIRS = [
    [-1,  0], [ 1,  0],
    [ 0, -1], [ 0,  1],
    [-1, -1], [ 1, -1],
    [-1,  1], [ 1,  1],
];

function OutlineText({ children, style, strokeWidth = 2, fillColor = Colors.white }) {
    const p = strokeWidth;

    return (
        <View style={[styles.outlineWrapper, { padding: p }]}>
            {STROKE_DIRS.map(([dx, dy], index) => (
                <Text
                    key={index}
                    style={[
                        style,
                        {
                            position: "absolute",
                            top:  p + dy * p,
                            left: p + dx * p,
                            color: Colors.textBlack,
                        },
                    ]}
                >
                    {children}
                </Text>
            ))}
            <Text style={[style, { color: fillColor }]}>{children}</Text>
        </View>
    );
}

// highlighted: 튜토리얼이 이 남은 날짜 표시를 가리키는 동안 버튼 하이라이트와 같은
// 초록으로 글자색을 바꾼다
export default function ResourceCounter({ wateringDays, nutrientDays, highlighted = false }) {
    const fillColor = highlighted ? Leaf.bright : Colors.white;
    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Image
                    source={require("../../assets/icons/water_icon.png")}
                    style={styles.icon}
                    resizeMode="contain"
                />
                <OutlineText style={styles.text} strokeWidth={2} fillColor={fillColor}>
                    D + {wateringDays ?? 0}
                </OutlineText>
            </View>

            <View style={styles.row}>
                <Image
                    source={require("../../assets/icons/nutrients_icon.png")}
                    style={styles.icon}
                    resizeMode="contain"
                />
                <OutlineText style={styles.text} strokeWidth={2} fillColor={fillColor}>
                    D + {nutrientDays ?? 0}
                </OutlineText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: Spacing.xs,
    },

    row: {
        height: 42,
        flexDirection: "row",
        alignItems: "center",
    },

    icon: {
        width: 38,
        height: 38,
        marginRight: Spacing.sm,
    },

    outlineWrapper: {
        alignSelf: "center",
    },

    text: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.screenTitle,
        color: Colors.white,
        letterSpacing: 0.5,
        lineHeight: 32,
    },
});