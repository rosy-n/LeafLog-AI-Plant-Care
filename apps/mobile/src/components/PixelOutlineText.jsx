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

/**
 * @param {{ children?: any, style?: any, strokeWidth?: number, numberOfLines?: number,
 *           adjustsFontSizeToFit?: boolean, minimumFontScale?: number }} props
 */
export default function PixelOutlineText({
    children,
    style,
    strokeWidth = 2,
    numberOfLines,
    adjustsFontSizeToFit,
    minimumFontScale,
}) {
    const p = strokeWidth;
    const offsets = buildOffsets(p);
    // numberOfLines/adjustsFontSizeToFit는 외곽선 레이어와 채움 레이어가 각자 별도 Text이므로
    // 모든 레이어에 동일하게 넘겨야 줄바꿈·축소 결과가 어긋나지 않는다.
    const textProps = { numberOfLines, adjustsFontSizeToFit, minimumFontScale };

    return (
        <View style={[styles.container, { padding: p }]}>
            {offsets.map(([dx, dy], index) => (
                <Text
                    key={index}
                    {...textProps}
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
            <Text {...textProps} style={[style, styles.fill]}>
                {children}
            </Text>
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