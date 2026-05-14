import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function PixelOutlineText({
                                             children,
                                             style,
                                             strokeWidth = 2,
                                         }) {
    const strokeOffsets = [
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
        <View style={styles.container}>
            {strokeOffsets.map(([x, y], index) => (
                <Text
                    key={index}
                    style={[
                        styles.strokeText,
                        style,
                        {
                            color: "#000000",
                            transform: [{ translateX: x }, { translateY: y }],
                        },
                    ]}
                >
                    {children}
                </Text>
            ))}

            <Text style={[styles.fillText, style]}>{children}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "relative",
        alignSelf: "center",
    },
    strokeText: {
        position: "absolute",
        fontFamily: "NeoDunggeunmoPro-Regular",
    },
    fillText: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        color: "#FFFFFF",
    },
});