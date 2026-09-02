import React, { useCallback, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { deleteConsultation as deleteConsultationRequest, listConsultations } from "../api";

const FALLBACK_TITLE = "상담 기록";

// 카드에 쓸 "몇 시간 전" / "8월 16일" 표시. 라이브러리 없이 네이티브 Date만 쓴다
// (앱 전체에 date-fns 등 날짜 라이브러리가 없어 다른 화면들도 같은 방식).
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function formatRelativeTime(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMinutes = Math.floor((now - date) / 60000);
    if (diffMinutes < 1) return "방금 전";
    if (diffMinutes < 60) return `${diffMinutes}분 전`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    // "어제"는 경과 시간이 아니라 달력 날짜 기준이라 시분과 무관하게 하루 전 날짜를 뜻한다.
    const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
    if (diffDays === 1) return "어제";
    if (diffDays < 7) return `${diffDays}일 전`;

    if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function ConsultationHistoryScreen({ navigation, route }) {
    const plant = route?.params?.plant;
    const [searchQuery, setSearchQuery] = useState("");
    const [consultations, setConsultations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadConsultations = useCallback(() => {
        const id = plant?.id;
        if (!id) {
            setConsultations([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        listConsultations(Number(id))
            .then(setConsultations)
            .catch(() => setConsultations([]))
            .finally(() => setIsLoading(false));
    }, [plant?.id]);

    // 뒤로가기로 스택 안에서 이 화면에 되돌아올 때도(pop) 새로 불러와야
    // 방금 끝낸 상담이 카드로 바로 보인다 — 마운트 시 1회만 도는 useEffect로는
    // 이 화면이 스택에 이미 떠 있던 채로 재사용될 때 갱신되지 않는다.
    useFocusEffect(
        useCallback(() => {
            loadConsultations();
        }, [loadConsultations])
    );

    const deleteConsultation = (id) => {
        Alert.alert("상담 기록 삭제", "이 상담 기록을 삭제할까요? 되돌릴 수 없어요.", [
            { text: "취소", style: "cancel" },
            {
                text: "삭제",
                style: "destructive",
                onPress: async () => {
                    // 실패해도 목록에서 먼저 지우면 삭제 안 된 항목이 다시 눌리는 게 더 혼란스러우니,
                    // 서버 응답을 받고 나서 반영한다.
                    try {
                        await deleteConsultationRequest(id);
                        setConsultations((prev) => prev.filter((item) => item.id !== id));
                    } catch (e) {
                        Alert.alert("삭제 실패", e?.message ?? "다시 시도해주세요.");
                    }
                },
            },
        ]);
    };

    const filteredConsultations = consultations.filter((item) => {
        const query = searchQuery.trim();
        if (!query) return true;
        return (item.title ?? FALLBACK_TITLE).includes(query) || (item.preview ?? "").includes(query);
    });

    const goToConsultation = (item) => {
        navigation.navigate("Consultation", { sessionId: item.id, plant });
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
                    {isLoading ? (
                        <ActivityIndicator style={styles.loadingIndicator} color={Colors.primary} />
                    ) : filteredConsultations.length === 0 ? (
                        <Text style={styles.emptyText}>
                            {consultations.length === 0 ? "아직 상담 기록이 없어요." : "검색 결과가 없어요."}
                        </Text>
                    ) : (
                        filteredConsultations.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.card}
                                activeOpacity={0.85}
                                onPress={() => goToConsultation(item)}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        {item.title || FALLBACK_TITLE}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => deleteConsultation(item.id)}
                                        activeOpacity={0.6}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="trash-outline" size={15} color={Colors.textFaint} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.cardMeta}>{formatRelativeTime(item.updated_at)}</Text>
                                {!!item.preview && (
                                    <Text style={styles.cardSummary} numberOfLines={2}>
                                        {item.preview}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>

                <TouchableOpacity
                    style={styles.chatButton}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate("ConsultationStart", { plant })}
                >
                    <Ionicons name="add" size={32} color={Colors.white} />
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

    cardMeta: {
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        fontFamily: Fonts.neoDunggeunmo,
        includeFontPadding: false,
        marginBottom: Spacing.xs,
    },

    cardSummary: {
        fontSize: FontSizes.small,
        color: Colors.textGray,
        fontFamily: Fonts.neoDunggeunmo,
        includeFontPadding: false,
        lineHeight: 18,
    },

    emptyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textFaint,
        textAlign: "center",
        marginTop: Spacing.huge,
    },

    loadingIndicator: {
        marginTop: Spacing.huge,
    },

    chatButton: {
        position: "absolute",
        right: 24,
        bottom: 28,
        width: 60,
        height: 60,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: Colors.textBlack,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
});
