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

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";

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
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                {/* 헤더 */}
                <ScreenHeader
                    title="스토어"
                    onBack={() => navigation.goBack()}
                    right={
                        <View style={styles.coinBadge}>
                            <Ionicons name="ellipse" size={13} color={Colors.coin} />
                            <Text style={styles.coinText}>{coins}</Text>
                        </View>
                    }
                />

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
                                                color={Colors.coin}
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
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    safe: {
        flex: 1,
    },

    coinBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
        backgroundColor: "#FFFBE8",
        borderRadius: Radius.xl,
        borderWidth: 1.5,
        borderColor: "#F4D98A",
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    coinText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: "#C8870A",
        includeFontPadding: false,
    },

    scrollContent: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.huge,
        gap: Spacing.md,
    },

    sectionTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        includeFontPadding: false,
        marginBottom: Spacing.xs,
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
        overflow: "hidden",
        gap: Spacing.lg,
        paddingRight: Spacing.lg,
    },
    cardActive: {
        borderColor: GreenTint.medium,
        borderWidth: 2,
    },

    preview: {
        width: 110,
        height: 80,
    },

    cardBody: {
        flex: 1,
        gap: Spacing.sm,
    },
    itemName: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    freeTag: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.medium,
        includeFontPadding: false,
    },
    priceRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
    },
    priceText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: "#C8870A",
        includeFontPadding: false,
    },

    actionArea: {
        alignItems: "center",
    },
    btn: {
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        alignItems: "center",
        minWidth: 72,
    },
    btnApplied: {
        backgroundColor: Colors.separator,
        borderWidth: 1.5,
        borderColor: GreenTint.medium,
    },
    btnAppliedText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.medium,
        includeFontPadding: false,
    },
    btnApply: {
        backgroundColor: GreenTint.deep,
    },
    btnApplyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.white,
        includeFontPadding: false,
    },
    btnBuy: {
        backgroundColor: Colors.coin,
    },
    btnBuyDisabled: {
        backgroundColor: Colors.border,
    },
    btnBuyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.white,
        includeFontPadding: false,
    },
    btnBuyTextDisabled: {
        color: Colors.textFaint,
    },
});