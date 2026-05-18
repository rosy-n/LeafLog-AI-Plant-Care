import React from "react";
import { View, Text, StyleSheet } from "react-native";

const STROKE_DIRS = [
    [-1,  0], [ 1,  0],
    [ 0, -1], [ 0,  1],
    [-1, -1], [ 1, -1],
    [-1,  1], [ 1,  1],
];

export default function PixelOutlineText({ children, style, strokeWidth = 2 }) {
    const p = strokeWidth;

    return (
        <View style={[styles.container, { padding: p }]}>
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
            {/* Fill layer — in-flow, always on top of absolute stroke layers */}
            <Text style={[style, styles.fill]}>{children}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignSelf: "center",
    },
    fill: {
        color: "#FFFFFF",
    },
});