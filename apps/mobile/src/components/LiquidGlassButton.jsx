import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Leaf, Glass } from "../../constants/colors";
import { Radius } from "../../constants/spacing";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { playTapSfx } from "../feedback";

export default function LiquidGlassButton({
                                              children,
                                              onPress,
                                              size = 54,
                                              style,
                                          }) {
    const handlePress = () => {
        playTapSfx();
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
                        Glass.frost72,
                        Glass.mist,
                        Glass.mistSoft,
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
    gradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 0.8,
        borderColor: Glass.frost45,
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