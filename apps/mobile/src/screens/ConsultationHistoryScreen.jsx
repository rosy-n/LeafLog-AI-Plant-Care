import React from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    SafeAreaView,
    StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
const FONT = "NeoDunggeunmoPro-Regular";

export default function ConsultationHistoryScreen({ navigation }) {
    const consultations = [
        {
            id: 1,
            title: "잎의 변색 원인",
            summary: "과습 때문일 가능성이 높아요.",
            detail: "흙이 충분히 마른 뒤에 물을 주고, 배수가 잘 되는지도 확인해보세요",
        },
        {
            id: 2,
            title: "잎의 변색 원인",
            summary: "과습때문일 가능성이 높아요.",
            detail: "흙이 충분히 마른뒤에 물을 주고, 배수가 잘되는지도 확인해보세요",
        },
        {
            id: 3,
            title: "잎의 변색 원인",
            summary: "과습 때문일 가능성이 높아요.",
            detail: "흙이 충분히 마른 뒤에 물을 주고, 배수가 잘 되는지도 확인해보세요",
        },
    ];

    const goToConsultation = () => {
        navigation.navigate("Consultation");
    };

    const goToConsultationStart = () => {
        navigation.navigate("ConsultationStart");
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
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search"
                            placeholderTextColor="#B5B5B5"
                        />
                        <Ionicons name="search-outline" size={21} color="#111" />
                    </View>

                    <TouchableOpacity style={styles.sortButton} activeOpacity={0.8}>
                        <Text style={styles.sortText}>날짜순</Text>
                        <Ionicons name="caret-down" size={14} color="#111" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.cardList}
                    contentContainerStyle={styles.cardListContent}
                    showsVerticalScrollIndicator={false}
                >
                    {consultations.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.card}
                            activeOpacity={0.85}
                            onPress={goToConsultation}
                        >
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardSummary}>{item.summary}</Text>
                            <Text style={styles.cardDetail}>{item.detail}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <TouchableOpacity
                    style={styles.chatButton}
                    activeOpacity={0.85}
                    onPress={goToConsultationStart}
                >
                    <Ionicons name="chatbox-outline" size={38} color="#1F5D01" />
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
        paddingHorizontal: 24,
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
        marginTop: 0,
    },

    headerSpacer: {
        width: 44,
    },

    title: {
        fontFamily: FONT,
        fontSize: 27,
        color: "#111111",
        includeFontPadding: false,
        marginTop: 0,
    },

    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: 20,
        marginBottom: 24,
        gap: 10,
    },

    searchBox: {
        width: 130,
        height: 35,
        borderWidth: 2.5,
        borderColor: "#1F5D01",
        borderRadius: 19,
        backgroundColor: "#FAFFF0",
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 18,
        paddingRight: 10,
    },

    searchInput: {
        flex: 1,
        height: "100%",
        fontSize: 14,
        color: "#111",
        fontFamily: FONT,
        paddingVertical: 0,
        includeFontPadding: false,
    },

    sortButton: {
        width: 85,
        height: 35,
        borderWidth: 2.5,
        borderColor: "#1F5D01",
        borderRadius: 19,
        backgroundColor: "#FAFFF0",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
    },

    sortText: {
        fontSize: 12,
        color: "#111",
        fontFamily: FONT,
        includeFontPadding: false,
    },

    cardList: {
        flex: 1,
    },

    cardListContent: {
        paddingBottom: 120,
    },

    card: {
        width: "100%",
        minHeight: 118,
        borderWidth: 3,
        borderColor: "#1F5D01",
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        paddingTop: 20,
        paddingHorizontal: 22,
        paddingBottom: 18,
        marginBottom: 20,
    },

    cardTitle: {
        fontSize: 21,
        color: "#111",
        fontFamily: FONT,
        includeFontPadding: false,
        marginBottom: 22,
    },

    cardSummary: {
        fontSize: 14,
        color: "#222",
        fontFamily: FONT,
        includeFontPadding: false,
        marginBottom: 10,
        lineHeight: 20,
    },

    cardDetail: {
        fontSize: 13,
        color: "#222",
        fontFamily: FONT,
        includeFontPadding: false,
        lineHeight: 19,
    },

    chatButton: {
        position: "absolute",
        right: 28,
        bottom: 20,
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: "#1F5D01",
        backgroundColor: "#FAFFF0",
        alignItems: "center",
        justifyContent: "center",
    },
});