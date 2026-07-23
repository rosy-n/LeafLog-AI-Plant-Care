import React from "react";
import { Colors } from "../../constants/colors";
import { View, Text, StyleSheet } from "react-native";

// strokeWidth(px)만큼의 "균일하고 끊김 없는" 외곽선을 만든다.
// 체비쇼프 거리 p 이내의 모든 오프셋(원점 제외)에 검정 글자를 겹쳐 찍어
// 글리프를 사방으로 p만큼 팽창(dilation)시킨다.
// (8방향만 p 배수로 찍으면 p>=2에서 사이가 비어 외곽선이 끊겨 보였음)
function buildOffsets(p) {
    const offsets = [];
    for (let dx = -p; dx <= p; dx++) {
        for (let dy = -p; dy <= p; dy++) {
            if (dx === 0 && dy === 0) continue;
            offsets.push([dx, dy]);
        }
    }
    return offsets;
}

export default function PixelOutlineText({ children, style, strokeWidth = 2 }) {
    const p = strokeWidth;
    const offsets = buildOffsets(p);

    return (
        <View style={[styles.container, { padding: p }]}>
            {offsets.map(([dx, dy], index) => (
                <Text
                    key={index}
                    style={[
                        style,
                        {
                            position: "absolute",
                            top: p + dy,
                            left: p + dx,
                            color: Colors.textBlack,
                        },
                    ]}
                >
                    {children}
                </Text>
            ))}
            {/* Fill layer — in-flow, always on top of absolute stroke layers */}
            <Text style={[style, styles.fill]}>{children}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignSelf: "center",
    },
    fill: {
        color: Colors.white,
    },
});