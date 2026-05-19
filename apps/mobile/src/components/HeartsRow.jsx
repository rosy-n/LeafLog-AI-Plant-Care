import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HeartsRow({ count = 5, size = 26 }) {
    return (
        <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((item) => (
                <Text
                    key={item}
                    style={[
                        styles.heart,
                        {
                            fontSize: size,
                            color: item <= count ? "#D83226" : "#FFFFFF",
                        },
                    ]}
                >
                    ♥
                </Text>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    heart: {
        marginHorizontal: 1,
        fontWeight: "900",
        textShadowColor: "#151515",
        textShadowOffset: { width: 1.5, height: 1.5 },
        textShadowRadius: 0,
    },
});