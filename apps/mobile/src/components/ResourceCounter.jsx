import React from "react";
import { View, Text, StyleSheet } from "react-native";

function OutlineText({ children, style, strokeWidth = 2 }) {
    const offsets = [
        [-strokeWidth, 0],
        [strokeWidth, 0],
        [0, -strokeWidth],
        [0, strokeWidth],
        [-strokeWidth, -strokeWidth],
        [strokeWidth, -strokeWidth],
        [-strokeWidth, strokeWidth],
        [strokeWidth, strokeWidth],
    ];

    return (
        <View style={styles.outlineWrapper}>
            {offsets.map(([x, y], index) => (
                <Text
                    key={index}
                    style={[
                        style,
                        styles.outlineStroke,
                        {
                            color: "#000000",
                            transform: [{ translateX: x }, { translateY: y }],
                        },
                    ]}
                >
                    {children}
                </Text>
            ))}

            <Text style={[style, styles.outlineFill]}>
                {children}
            </Text>
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
        position: "relative",
        alignSelf: "center",
    },

    outlineStroke: {
        position: "absolute",
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