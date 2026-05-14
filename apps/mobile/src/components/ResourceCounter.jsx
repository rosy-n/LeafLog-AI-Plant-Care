import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function ResourceCounter() {
    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.drop}>💧</Text>
                <Text style={styles.text}>D + 4</Text>
            </View>

            <View style={styles.row}>
                <Text style={styles.nutrient}>✚</Text>
                <Text style={styles.text}>D + 10</Text>
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
    text: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 27,
        color: "#1F1F1F",
        letterSpacing: 0.5,
        textShadowColor: "#FFFFFF",
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 0,
    },
});