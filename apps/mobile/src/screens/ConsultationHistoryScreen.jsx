import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";

export default function ConsultationHistoryScreen({ navigation }) {
    const [searchQuery, setSearchQuery] = useState("");

    const [consultations, setConsultations] = useState([
        {
            id: 1,
            title: "잎의 변색 원인",
            summary: "잎 끝 갈변은 대부분 수분 스트레스나 환경 문제에서 비롯돼요.",
            detail: "수분 부족, 낮은 공중 습도, 수돗물 수질, 비료 과다 등이 원인일 수 있어요.",
        },
        {
            id: 2,
            title: "잎의 상처 원인",
            summary: "총채벌레 피해일 가능성이 높아요.",
            detail: "다른 식물과 격리 후 살충제를 뿌려 방제해보세요.",
        },
        {
            id: 3,
            title: "흙에 피는 곰팡이 문제",
            summary: "통풍 부족과 유기물이 많은 흙이 주원인이에요.",
            detail: "곰팡이를 걷어내고 습하지 않게 관리해보세요.",
        },
    ]);

    const deleteConsultation = (id) => {
        Alert.alert("상담 기록 삭제", "이 상담 기록을 삭제할까요?", [
            { text: "취소", style: "cancel" },
            {
                text: "삭제",
                style: "destructive",
                onPress: () => setConsultations((prev) => prev.filter((item) => item.id !== id)),
            },
        ]);
    };

    const filteredConsultations = [...consultations]
        .filter((item) =>
            item.title.includes(searchQuery.trim()) ||
            item.summary.includes(searchQuery.trim()) ||
            item.detail.includes(searchQuery.trim())
        );

    const goToConsultation = (item) => {
        navigation.navigate("Consultation", { consultation: item });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

            <ScreenHeader title="상담 기록" onBack={() => navigation.goBack()} />

            <View style={styles.container}>
                <View style={styles.searchRow}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search-outline" size={18} color={Colors.textGray} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="검색"
                            placeholderTextColor={Colors.textFaint}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                                <Ionicons name="close-circle" size={16} color={Colors.textFaint} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <ScrollView
                    style={styles.cardList}
                    contentContainerStyle={styles.cardListContent}
                    showsVerticalScrollIndicator={false}
                >
                    {filteredConsultations.length === 0 ? (
                        <Text style={styles.emptyText}>검색 결과가 없어요.</Text>
                    ) : (
                        filteredConsultations.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.card}
                                activeOpacity={0.85}
                                onPress={() => goToConsultation(item)}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{item.title}</Text>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => deleteConsultation(item.id)}
                                        activeOpacity={0.6}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="trash-outline" size={15} color={Colors.textFaint} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.cardSummary}>{item.summary}</Text>
                                <Text style={styles.cardDetail}>{item.detail}</Text>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>

                <TouchableOpacity
                    style={styles.chatButton}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate("ConsultationStart")}
                >
                    <Ionicons name="chatbox-outline" size={32} color={Colors.primary} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    container: {
        flex: 1,
        backgroundColor: Colors.background,
        paddingHorizontal: Spacing.xl,
    },

    searchRow: {
        marginTop: Spacing.sm,
        marginBottom: Spacing.xl,
    },

    searchBox: {
        flexDirection: "row",
        alignItems: "center",
        height: 40,
        borderWidth: 1.5,
        borderColor: GreenTint.medium,
        borderRadius: Radius.xl,
        backgroundColor: Colors.white,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
    },

    searchIcon: {
        marginRight: Spacing.xxs,
    },

    searchInput: {
        flex: 1,
        height: "100%",
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        fontFamily: Fonts.neoDunggeunmo,
        paddingVertical: Spacing.none,
        includeFontPadding: false,
    },

    cardList: {
        flex: 1,
    },

    cardListContent: {
        paddingBottom: 100,
    },

    card: {
        width: "100%",
        borderWidth: 1.5,
        borderColor: GreenTint.half,
        borderRadius: Radius.md,
        backgroundColor: Colors.white,
        paddingTop: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.lg,
        marginBottom: Spacing.md,
    },

    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: Spacing.sm,
    },

    cardTitle: {
        flex: 1,
        fontSize: FontSizes.bodyLarge,
        color: Colors.textBlack,
        fontFamily: Fonts.neoDunggeunmo,
        includeFontPadding: false,
        marginRight: Spacing.sm,
    },

    deleteButton: {
        padding: Spacing.xxs,
    },

    cardSummary: {
        fontSize: FontSizes.small,
        color: Colors.textBlack,
        fontFamily: Fonts.neoDunggeunmo,
        includeFontPadding: false,
        marginBottom: Spacing.sm,
        lineHeight: 18,
    },

    cardDetail: {
        fontSize: FontSizes.small,
        color: Colors.textGray,
        fontFamily: Fonts.neoDunggeunmo,
        includeFontPadding: false,
        lineHeight: 17,
    },

    emptyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textFaint,
        textAlign: "center",
        marginTop: Spacing.huge,
    },

    chatButton: {
        position: "absolute",
        right: 24,
        bottom: 28,
        width: 60,
        height: 60,
        borderRadius: Radius.pill,
        borderWidth: 2,
        borderColor: Colors.primary,
        backgroundColor: Colors.background,
        alignItems: "center",
        justifyContent: "center",
    },
});
