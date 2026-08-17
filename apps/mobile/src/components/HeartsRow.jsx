import React, { useEffect, useMemo, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import { Spacing } from "../../constants/spacing";

const FULL_HEART = require("../../assets/icons/fullheart_icon.png");
const HALF_HEART = require("../../assets/icons/halfheart_icon.png");
const EMPTY_HEART = require("../../assets/icons/emptyheart_icon.png");

const POSITIONS = [1, 2, 3, 4, 5];

// 하트 아이콘이 빈/반/가득 3종뿐이라 한 칸은 0 / 0.5 / 1 세 상태만 갖는다.
// count 는 0~5 (0.5 단위) — 서버가 애정도 점수에서 계산해 내려준 값(affinity.hearts).
function heartSource(position, count) {
    if (count >= position) return FULL_HEART;
    if (count >= position - 0.5) return HALF_HEART;
    return EMPTY_HEART;
}

export default function HeartsRow({ count = 0, size = 26 }) {
    const hearts = Math.max(0, Math.min(POSITIONS.length, count ?? 0));

    // 애정도가 올라 새로 채워진 칸만 통통 튀게 한다 (0=평소, 1=튄 순간)
    const pops = useRef(POSITIONS.map(() => new Animated.Value(0))).current;
    const previousHearts = useRef(hearts);

    const scales = useMemo(
        () =>
            pops.map((pop) =>
                pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] })
            ),
        [pops]
    );

    useEffect(() => {
        const before = previousHearts.current;
        previousHearts.current = hearts;
        if (hearts <= before) return;

        // 빈→반, 반→가득 모두 "채워진" 변화로 본다 (require 결과가 모듈 id라 값 비교 가능)
        const filled = POSITIONS.filter(
            (position) => heartSource(position, hearts) !== heartSource(position, before)
        );

        Animated.stagger(
            70,
            filled.map((position) =>
                Animated.sequence([
                    Animated.timing(pops[position - 1], {
                        toValue: 1,
                        duration: 140,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.spring(pops[position - 1], {
                        toValue: 0,
                        friction: 4,
                        tension: 90,
                        useNativeDriver: true,
                    }),
                ])
            )
        ).start();
    }, [hearts, pops]);

    return (
        <View style={styles.row}>
            {POSITIONS.map((position) => (
                <Animated.Image
                    key={position}
                    source={heartSource(position, hearts)}
                    style={[
                        styles.heart,
                        {
                            width: size,
                            height: size,
                            transform: [{ scale: scales[position - 1] }],
                        },
                    ]}
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