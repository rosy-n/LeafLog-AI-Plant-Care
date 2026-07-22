import React from "react";
import { Image, StyleSheet } from "react-native";
import { plantImages } from "../data/plants";

export default function PlantImage({
                                       imageKey = "spaghetti",
                                       uri,
                                       width = 160,
                                       height = 160,
                                       style,
                                   }) {
    // 원격 URL(S3 등)이 있으면 우선 사용, 없으면 번들 기본 이미지로 fallback
    const source = uri ? { uri } : plantImages[imageKey];
    return (
        <Image
            source={source}
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