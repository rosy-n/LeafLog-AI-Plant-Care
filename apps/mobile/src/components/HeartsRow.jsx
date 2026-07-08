import React from "react";
import { Colors } from "../../constants/colors";
import { Spacing } from "../../constants/spacing";
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
                            color: item <= count ? Colors.danger : Colors.textFaint,
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
        marginHorizontal: Spacing.xxs,
        fontWeight: "900",
        textShadowColor: Colors.textBlack,
        textShadowOffset: { width: 1.5, height: 1.5 },
        textShadowRadius: 0,
    },
});