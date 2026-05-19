import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    StatusBar,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LiquidGlassButton from "../components/LiquidGlassButton";

const FONT = "NeoDunggeunmoPro-Regular";

const BG_ITEMS = [
    {
        key: "home-bg",
        name: "기본 배경",
        image: require("../../assets/images/home-bg.png"),
        price: 0,
    },
    {
        key: "store_bg1",
        name: "봄날의 정원",
        image: require("../../assets/images/store_bg1.png"),
        price: 150,
    },
    {
        key: "store_bg2",
        name: "달빛 정원",
        image: require("../../assets/images/store_bg2.png"),
        price: 150,
    },
];

export default function StoreScreen({
    navigation,
    coins,
    setCoins,
    purchasedBgs,
    setPurchasedBgs,
    appliedBg,
    setAppliedBg,
}: {
    navigation: any;
    coins: number;
    setCoins: (c: number) => void;
    purchasedBgs: string[];
    setPurchasedBgs: (bgs: string[]) => void;
    appliedBg: string;
    setAppliedBg: (bg: string) => void;
}) {
    const handleBuy = (item: (typeof BG_ITEMS)[0]) => {
        Alert.alert(
            "배경 구매",
            `${item.name}을(를) ${item.price} 코인에 구매하시겠어요?`,
            [
                { text: "취소", style: "cancel" },
                {
                    text: "구매",
                    onPress: () => {
                        setCoins(coins - item.price);
                        setPurchasedBgs([...purchasedBgs, item.key]);
                        setAppliedBg(item.key);
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                {/* 헤더 */}
                <View style={styles.header}>
                    <View style={styles.headerButton} />
                    <Text style={styles.headerTitle}>스토어</Text>
                    <View style={styles.coinBadge}>
                        <Ionicons name="ellipse" size={13} color="#F4B63F" />
                        <Text style={styles.coinText}>{coins}</Text>
                    </View>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <Text style={styles.sectionTitle}>홈 배경</Text>

                    {BG_ITEMS.map((item) => {
                        const isPurchased =
                            item.price === 0 || purchasedBgs.includes(item.key);
                        const isApplied = appliedBg === item.key;
                        const canAfford = coins >= item.price;

                        return (
                            <View
                                key={item.key}
                                style={[styles.card, isApplied && styles.cardActive]}
                            >
                                <Image
                                    source={item.image}
                                    style={styles.preview}
                                    resizeMode="cover"
                                />

                                <View style={styles.cardBody}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    {item.price === 0 ? (
                                        <Text style={styles.freeTag}>무료</Text>
                                    ) : (
                                        <View style={styles.priceRow}>
                                            <Ionicons
                                                name="ellipse"
                                                size={11}
                                                color="#F4B63F"
                                            />
                                            <Text style={styles.priceText}>
                                                {item.price} 코인
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.actionArea}>
                                    {isApplied ? (
                                        <View style={[styles.btn, styles.btnApplied]}>
                                            <Text style={styles.btnAppliedText}>
                                                적용 중
                                            </Text>
                                        </View>
                                    ) : isPurchased ? (
                                        <TouchableOpacity
                                            style={[styles.btn, styles.btnApply]}
                                            onPress={() => setAppliedBg(item.key)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.btnApplyText}>
                                                적용하기
                                            </Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={[
                                                styles.btn,
                                                styles.btnBuy,
                                                !canAfford && styles.btnBuyDisabled,
                                            ]}
                                            onPress={() => handleBuy(item)}
                                            activeOpacity={0.8}
                                            disabled={!canAfford}
                                        >
                                            <Text
                                                style={[
                                                    styles.btnBuyText,
                                                    !canAfford &&
                                                        styles.btnBuyTextDisabled,
                                                ]}
                                            >
                                                구매하기
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>

                <View style={styles.footer}>
                    <LiquidGlassButton
                        size={48}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="close" size={24} color="#2B3E25" />
                    </LiquidGlassButton>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#FAFFF0",
    },
    safe: {
        flex: 1,
    },

    header: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
    },
    headerButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontFamily: FONT,
        fontSize: 25,
        color: "#111111",
        includeFontPadding: false,
    },
    coinBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "#FFFBE8",
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "#F4D98A",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    coinText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#C8870A",
        includeFontPadding: false,
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 40,
        gap: 12,
    },

    sectionTitle: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#5A8A5A",
        includeFontPadding: false,
        marginBottom: 4,
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: "#E0EBCD",
        overflow: "hidden",
        gap: 14,
        paddingRight: 16,
    },
    cardActive: {
        borderColor: "#5A9A5A",
        borderWidth: 2,
    },

    preview: {
        width: 110,
        height: 80,
    },

    cardBody: {
        flex: 1,
        gap: 6,
    },
    itemName: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#222222",
        includeFontPadding: false,
    },
    freeTag: {
        fontFamily: FONT,
        fontSize: 12,
        color: "#5A9A5A",
        includeFontPadding: false,
    },
    priceRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    priceText: {
        fontFamily: FONT,
        fontSize: 12,
        color: "#C8870A",
        includeFontPadding: false,
    },

    footer: {
        height: 76,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: "#EEF5E6",
    },

    actionArea: {
        alignItems: "center",
    },
    btn: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: "center",
        minWidth: 72,
    },
    btnApplied: {
        backgroundColor: "#EAF5EA",
        borderWidth: 1.5,
        borderColor: "#5A9A5A",
    },
    btnAppliedText: {
        fontFamily: FONT,
        fontSize: 12,
        color: "#5A9A5A",
        includeFontPadding: false,
    },
    btnApply: {
        backgroundColor: "#2F702D",
    },
    btnApplyText: {
        fontFamily: FONT,
        fontSize: 12,
        color: "#FFFFFF",
        includeFontPadding: false,
    },
    btnBuy: {
        backgroundColor: "#F4B63F",
    },
    btnBuyDisabled: {
        backgroundColor: "#E0E0E0",
    },
    btnBuyText: {
        fontFamily: FONT,
        fontSize: 12,
        color: "#FFFFFF",
        includeFontPadding: false,
    },
    btnBuyTextDisabled: {
        color: "#AAAAAA",
    },
});