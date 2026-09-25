import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";

// RAG 검색 결과 표의 열 순서 — 이미지·부위·유사도는 고정폭, 나머지는 남는 폭을 나눠 쓴다.
// 6열이 화면 폭 안에 다 들어와야 유사도까지 보여서, 가로 스크롤 대신 flex로 폭을 맞춘다.
const COLUMNS = [
    { key: "image", label: "이미지", width: 48 },
    { key: "plant_species", label: "종", flex: 1.2 },
    { key: "plant_part", label: "부위", width: 34 },
    { key: "symptom_group", label: "증상", flex: 1.2 },
    { key: "suspected_cause", label: "원인", flex: 1.2 },
    { key: "score", label: "유사도", width: 46 },
];

const columnStyle = (col) => (col.width ? { width: col.width } : { flex: col.flex });

// 상담 화면·새 상담 화면이 같은 표를 쓰도록 분리했다. 썸네일을 누르면 전체화면으로 본다.
export default function RagResultTable({ cases }) {
    const [viewerImageUrl, setViewerImageUrl] = useState(null);

    const renderCell = (c, col) => {
        if (col.key === "image") {
            return c.image_url ? (
                <TouchableOpacity activeOpacity={0.8} onPress={() => setViewerImageUrl(c.image_url)}>
                    <Image source={{ uri: c.image_url }} style={styles.thumb} resizeMode="cover" />
                </TouchableOpacity>
            ) : (
                <Text style={styles.cellText}>-</Text>
            );
        }
        if (col.key === "score") return <Text style={styles.cellText}>{Math.round(c.score * 100)}%</Text>;
        return <Text style={styles.cellText}>{c[col.key] ?? "-"}</Text>;
    };

    return (
        <>
            <View style={styles.table}>
                <View style={[styles.row, styles.header]}>
                    {COLUMNS.map((col) => (
                        <Text key={col.key} style={[styles.cell, styles.headerText, columnStyle(col)]}>
                            {col.label}
                        </Text>
                    ))}
                </View>
                {cases.map((c, idx) => (
                    <View key={idx} style={styles.row}>
                        {COLUMNS.map((col) => (
                            <View key={col.key} style={[styles.cell, columnStyle(col)]}>
                                {renderCell(c, col)}
                            </View>
                        ))}
                    </View>
                ))}
            </View>
            <Modal
                visible={!!viewerImageUrl}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setViewerImageUrl(null)}
            >
                <TouchableOpacity
                    style={styles.viewer}
                    activeOpacity={1}
                    onPress={() => setViewerImageUrl(null)}
                >
                    {viewerImageUrl ? (
                        <Image source={{ uri: viewerImageUrl }} style={styles.viewerImage} resizeMode="contain" />
                    ) : null}
                    <Ionicons name="close" size={28} color={Colors.white} style={styles.viewerClose} />
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    table: {
        marginTop: Spacing.xs,
        padding: Spacing.xs,
        borderRadius: Radius.lg,
        backgroundColor: Colors.surfaceGrayTint,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: Spacing.xxs,
    },
    header: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingBottom: Spacing.xs,
    },
    cell: {
        paddingHorizontal: Spacing.xxs,
    },
    headerText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    cellText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        lineHeight: 17,
        color: Colors.textGray,
    },
    thumb: {
        width: 40,
        height: 40,
        borderRadius: Radius.sm,
    },
    viewer: {
        flex: 1,
        justifyContent: "center",
        backgroundColor: Colors.textBlack,
    },
    viewerImage: {
        width: "100%",
        height: "100%",
    },
    viewerClose: {
        position: "absolute",
        top: Spacing.xxxl,
        right: Spacing.xl,
    },
});
