import React from "react";
import { Image, StyleSheet } from "react-native";
import { plantImages } from "../data/plants";

export default function PlantImage({
                                       imageKey = "spaghetti",
                                       width = 160,
                                       height = 160,
                                       style,
                                   }) {
    return (
        <Image
            source={plantImages[imageKey]}
            style={[
                styles.image,
                {
                    width,
                    height,
                },
                style,
            ]}
            resizeMode="contain"
        />
    );
}

const styles = StyleSheet.create({
    image: {
        backgroundColor: "transparent",
    },
});