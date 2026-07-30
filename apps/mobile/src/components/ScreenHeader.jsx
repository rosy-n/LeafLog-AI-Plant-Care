import React from "react";
import { View, Text, StyleSheet } from "react-native";
import BackButton from "./BackButton";
import { Gutter } from "../../constants/spacing";
import { HEADER_HEIGHT, headerTitle } from "../../constants/layout";

/**
 * 공통 화면 헤더 (뒤로가기 + 제목/커스텀 중앙 + 우측 슬롯)
 * - title:      제목 텍스트 (center 미지정 시 표준 스타일로 렌더)
 * - onBack:     뒤로가기 핸들러
 * - right:      우측 커스텀 노드 (미지정 시 44×44 스페이서로 균형)
 * - center:     중앙 커스텀 노드 (지정 시 title 대신 렌더)
 * - titleStyle: 제목 스타일 오버라이드 — 크기는 화면끼리 어긋나므로 바꾸지 말 것
 */
export default function ScreenHeader({ title, onBack, right = null, center = null, titleStyle = null }) {
    return (
        <View style={styles.header}>
            <BackButton onPress={onBack} style={styles.button} />

            {center != null ? center : (
                <Text style={[styles.title, titleStyle]} numberOfLines={1}>{title}</Text>
            )}

            {right != null ? right : <View style={styles.button} />}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        height: HEADER_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: Gutter,
    },
    button: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    // 제목 스타일은 constants/layout.ts에서 관리 — 여기서 값을 바꾸지 않는다
    title: headerTitle,
});
