import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing } from "../../constants/spacing";

const STROKE_DIRS = [
    [-1,  0], [ 1,  0],
    [ 0, -1], [ 0,  1],
    [-1, -1], [ 1, -1],
    [-1,  1], [ 1,  1],
];

function OutlineText({ children, style, strokeWidth = 2 }) {
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
            <Text style={[style, styles.outlineFill]}>{children}</Text>
        </View>
    );
}

export default function ResourceCounter() {
    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.drop}>💧</Text>
                <OutlineText style={styles.text} strokeWidth={2}>
                    D + 4
                </OutlineText>
            </View>

            <View style={styles.row}>
                <Text style={styles.nutrient}>✚</Text>
                <OutlineText style={styles.text} strokeWidth={2}>
                    D + 10
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

    drop: {
        width: 38,
        fontSize: FontSizes.display,
        marginRight: Spacing.sm,
    },

    nutrient: {
        width: 38,
        fontSize: FontSizes.display,
        marginRight: Spacing.sm,
        color: Colors.nutrient,
        textShadowColor: GreenTint.deep,
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 0,
    },

    outlineWrapper: {
        alignSelf: "center",
    },

    outlineFill: {
        color: Colors.white,
    },

    text: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.screenTitle,
        color: Colors.white,
        letterSpacing: 0.5,
        lineHeight: 32,
    },
});