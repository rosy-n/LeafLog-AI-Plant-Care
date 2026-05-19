import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

export default function LiquidGlassButton({
                                              children,
                                              onPress,
                                              size = 54,
                                              style,
                                          }) {
    return (
        <TouchableOpacity
            activeOpacity={0.78}
            onPress={onPress}
            style={[
                styles.touch,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                style,
            ]}
        >
            <BlurView
                intensity={28}
                tint="light"
                style={[
                    styles.blur,
                    {
                        borderRadius: size / 2,
                    },
                ]}
            >
                <LinearGradient
                    colors={[
                        "rgba(255,255,255,0.68)",
                        "rgba(230,246,220,0.50)",
                        "rgba(207,232,197,0.36)",
                    ]}
                    start={{ x: 0.12, y: 0.05 }}
                    end={{ x: 0.9, y: 1 }}
                    style={[
                        styles.gradient,
                        {
                            borderRadius: size / 2,
                        },
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
        shadowColor: "#385236",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 5,
        elevation: 5,
    },
    blur: {
        flex: 1,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.68)",
    },
    gradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 0.8,
        borderColor: "rgba(255,255,255,0.45)",
    },
    highlight: {
        position: "absolute",
        top: 7,
        left: 10,
        width: "38%",
        height: "20%",
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.60)",
    },
    content: {
        alignItems: "center",
        justifyContent: "center",
    },
});