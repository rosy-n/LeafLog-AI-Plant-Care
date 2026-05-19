import React from "react";
import { View, Text, StyleSheet } from "react-native";

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
                            color: "#000000",
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
        gap: 4,
    },

    row: {
        height: 42,
        flexDirection: "row",
        alignItems: "center",
    },

    drop: {
        width: 38,
        fontSize: 31,
        marginRight: 7,
    },

    nutrient: {
        width: 38,
        fontSize: 35,
        marginRight: 7,
        color: "#39D13A",
        textShadowColor: "#177E25",
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 0,
    },

    outlineWrapper: {
        alignSelf: "center",
    },

    outlineFill: {
        color: "#FFFFFF",
    },

    text: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 27,
        color: "#FFFFFF",
        letterSpacing: 0.5,
        lineHeight: 32,
    },
});