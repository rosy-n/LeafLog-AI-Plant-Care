import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { Spacing } from "../../constants/spacing";

const FULL_HEART = require("../../assets/icons/fullheart_icon.png");
const HALF_HEART = require("../../assets/icons/halfheart_icon.png");
const EMPTY_HEART = require("../../assets/icons/emptyheart_icon.png");

// count 는 0~5 (반 칸 0.5 단위까지 표현). 호감도 DB 연동 전까지는 임의 값 사용.
function heartSource(position, count) {
    if (count >= position) return FULL_HEART;
    if (count >= position - 0.5) return HALF_HEART;
    return EMPTY_HEART;
}

export default function HeartsRow({ count = 5, size = 26 }) {
    return (
        <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((position) => (
                <Image
                    key={position}
                    source={heartSource(position, count ?? 0)}
                    style={[styles.heart, { width: size, height: size }]}
                    resizeMode="contain"
                />
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
        marginHorizontal: Spacing.none,
    },
});