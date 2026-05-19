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

const FONT = "NanumSquareNeo";

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
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />

            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        activeOpacity={0.75}
                        style={styles.headerBackButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={32} color="#222222" />
                    </TouchableOpacity>

                    <Text style={styles.title}>상담 기록</Text>

                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.searchRow}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search-outline" size={18} color="#666" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="검색"
                            placeholderTextColor="#B5B5B5"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                                <Ionicons name="close-circle" size={16} color="#999" />
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
                                        <Ionicons name="trash-outline" size={15} color="#BBBBBB" />
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
                    <Ionicons name="chatbox-outline" size={32} color="#1F5D01" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#FAFFF0",
    },

    container: {
        flex: 1,
        backgroundColor: "#FAFFF0",
        paddingHorizontal: 20,
    },

    header: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    headerBackButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },

    headerSpacer: {
        width: 44,
    },

    title: {
        fontFamily: FONT,
        fontSize: 22,
        color: "#111111",
        includeFontPadding: false,
    },

    searchRow: {
        marginTop: 8,
        marginBottom: 18,
    },

    searchBox: {
        flexDirection: "row",
        alignItems: "center",
        height: 40,
        borderWidth: 1.5,
        borderColor: "rgba(31, 93, 1, 0.4)",
        borderRadius: 20,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 14,
        gap: 8,
    },

    searchIcon: {
        marginRight: 2,
    },

    searchInput: {
        flex: 1,
        height: "100%",
        fontSize: 13,
        color: "#111",
        fontFamily: FONT,
        paddingVertical: 0,
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
        borderColor: "rgba(31, 93, 1, 0.5)",
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        paddingTop: 14,
        paddingHorizontal: 16,
        paddingBottom: 14,
        marginBottom: 12,
    },

    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },

    cardTitle: {
        flex: 1,
        fontSize: 15,
        color: "#111",
        fontFamily: FONT,
        includeFontPadding: false,
        marginRight: 8,
    },

    deleteButton: {
        padding: 2,
    },

    cardSummary: {
        fontSize: 12,
        color: "#333",
        fontFamily: FONT,
        includeFontPadding: false,
        marginBottom: 6,
        lineHeight: 18,
    },

    cardDetail: {
        fontSize: 11,
        color: "#555",
        fontFamily: FONT,
        includeFontPadding: false,
        lineHeight: 17,
    },

    emptyText: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#999",
        textAlign: "center",
        marginTop: 40,
    },

    chatButton: {
        position: "absolute",
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: "#1F5D01",
        backgroundColor: "#FAFFF0",
        alignItems: "center",
        justifyContent: "center",
    },
});
