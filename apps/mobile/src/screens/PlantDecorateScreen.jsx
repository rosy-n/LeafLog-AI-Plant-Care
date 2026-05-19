import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    StatusBar,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import LiquidGlassButton from "../components/LiquidGlassButton";

const ITEMS = [
    {
        id: 1,
        requiredLevel: 1,
        label: "잎사귀",
        itemImage: require("../../assets/items/level1_item.png"),
        plantImage: require("../../assets/items/level1_plants.png"),
    },
    {
        id: 2,
        requiredLevel: 2,
        label: "반짝이",
        itemImage: require("../../assets/items/level2_item.png"),
        plantImage: require("../../assets/items/level2_plants.png"),
    },
    {
        id: 3,
        requiredLevel: 3,
        label: "하트",
        itemImage: require("../../assets/items/level3_item.png"),
        plantImage: require("../../assets/items/level3_plants.png"),
    },
    {
        id: 4,
        requiredLevel: 4,
        label: "알록달록",
        itemImage: require("../../assets/items/level4_item.png"),
        plantImage: require("../../assets/items/level4_plants.png"),
    },
    {
        id: 5,
        requiredLevel: 5,
        label: "나비",
        itemImage: require("../../assets/items/level5_item.png"),
        plantImage: require("../../assets/items/level5_plants.png"),
    },
];

const NEXT_THRESHOLD = [50, 100, 200, 500, 1000];

function getAffinityLevel(score) {
    if (score >= 1000) return 5;
    if (score >= 500) return 4;
    if (score >= 200) return 3;
    if (score >= 100) return 2;
    if (score >= 50) return 1;
    return 0;
}

function getLevelProgressPercent(score, level) {
    const thresholds = [0, 50, 100, 200, 500, 1000];
    const current = thresholds[level];
    const next = thresholds[Math.min(level + 1, 5)];
    if (level >= 5) return 100;
    return Math.min(((score - current) / (next - current)) * 100, 100);
}

export default function PlantDecorateScreen({ navigation, appliedItem, setAppliedItem }) {
    const affinityScore = 725;
    const affinityLevel = getAffinityLevel(affinityScore);
    const progressPercent = getLevelProgressPercent(affinityScore, affinityLevel);

    const [selectedItem, setSelectedItem] = useState(appliedItem ?? null);

    const handleItemPress = (item) => {
        if (item.requiredLevel > affinityLevel) return;
        const next = selectedItem?.id === item.id ? null : item;
        setSelectedItem(next);
        setAppliedItem(next);
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#E8F5DF" />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerButton} />
                    <Text style={styles.headerTitle}>식물 꾸미기</Text>
                    <View style={styles.headerButton} />
                </View>

                {/* Affinity Card */}
                <View style={styles.affinityCardWrap}>
                    <BlurView intensity={28} tint="light" style={styles.affinityBlur}>
                        <LinearGradient
                            colors={[
                                "rgba(255,255,255,0.75)",
                                "rgba(220,245,208,0.55)",
                                "rgba(195,230,180,0.38)",
                            ]}
                            start={{ x: 0.1, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.affinityGradient}
                        >
                            <View style={styles.affinityRow}>
                                <View style={styles.affinityBlock}>
                                    <Text style={styles.affinityLabel}>호감도</Text>
                                    <Text style={styles.affinityScore}>
                                        {affinityScore}
                                        <Text style={styles.affinityUnit}>점</Text>
                                    </Text>
                                </View>

                                <View style={styles.affinityDivider} />

                                <View style={styles.affinityBlock}>
                                    <Text style={styles.affinityLabel}>레벨</Text>
                                    <Text style={styles.affinityLevelText}>
                                        {affinityLevel > 0 ? `Lv.${affinityLevel}` : "Lv.-"}
                                    </Text>
                                </View>

                                <View style={styles.affinityDivider} />

                                <View style={[styles.affinityBlock, { flex: 1.6 }]}>
                                    <View style={styles.progressRow}>
                                        <Text style={styles.affinityLabel}>다음 레벨</Text>
                                        {affinityLevel < 5 && (
                                            <Text style={styles.nextThresholdText}>
                                                {NEXT_THRESHOLD[affinityLevel]}점
                                            </Text>
                                        )}
                                    </View>
                                    <View style={styles.progressBg}>
                                        <LinearGradient
                                            colors={["#72C959", "#3E8C2D"]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={[
                                                styles.progressFill,
                                                { width: `${progressPercent}%` },
                                            ]}
                                        />
                                    </View>
                                </View>
                            </View>
                        </LinearGradient>
                    </BlurView>
                </View>

                {/* Plant Preview */}
                <View style={styles.plantPreviewArea}>
                    <View style={styles.plantPreviewInner}>
                        {selectedItem ? (
                            <Image
                                source={selectedItem.plantImage}
                                style={styles.plantPreviewImage}
                                resizeMode="contain"
                            />
                        ) : (
                            <Image
                                source={require("../../assets/plants/spaghetti.png")}
                                style={styles.plantPreviewImage}
                                resizeMode="contain"
                            />
                        )}
                    </View>

                    <View style={styles.plantLabelGroup}>
                        <Text style={styles.plantName}>스파게티</Text>
                        <Text style={styles.plantDay}>D+45</Text>
                    </View>

                    {selectedItem ? (
                        <View style={styles.appliedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#3A8C2D" />
                            <Text style={styles.appliedBadgeText}>{selectedItem.label} 적용 중</Text>
                        </View>
                    ) : (
                        <View style={styles.noItemBadge}>
                            <Text style={styles.noItemBadgeText}>아이템 없음</Text>
                        </View>
                    )}
                </View>

                {/* Item Selection Section */}
                <View style={styles.itemSection}>
                    <BlurView intensity={22} tint="light" style={styles.itemSectionBlur}>
                        <LinearGradient
                            colors={[
                                "rgba(255,255,255,0.68)",
                                "rgba(225,245,215,0.48)",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.itemSectionGradient}
                        >
                            <Text style={styles.itemSectionTitle}>아이템 선택</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.itemScroll}
                            >
                                {ITEMS.map((item) => {
                                    const isUnlocked = item.requiredLevel <= affinityLevel;
                                    const isSelected = selectedItem?.id === item.id;

                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            activeOpacity={isUnlocked ? 0.78 : 1}
                                            onPress={() => handleItemPress(item)}
                                            style={styles.itemCardWrap}
                                        >
                                            <View
                                                style={[
                                                    styles.itemCard,
                                                    isSelected && styles.itemCardSelected,
                                                    !isUnlocked && styles.itemCardLocked,
                                                ]}
                                            >
                                                <BlurView
                                                    intensity={isUnlocked ? 20 : 12}
                                                    tint="light"
                                                    style={styles.itemCardBlur}
                                                >
                                                    <LinearGradient
                                                        colors={
                                                            isSelected
                                                                ? [
                                                                      "rgba(110,200,85,0.65)",
                                                                      "rgba(55,155,45,0.45)",
                                                                  ]
                                                                : isUnlocked
                                                                ? [
                                                                      "rgba(255,255,255,0.72)",
                                                                      "rgba(215,238,205,0.45)",
                                                                  ]
                                                                : [
                                                                      "rgba(200,200,200,0.45)",
                                                                      "rgba(170,170,170,0.3)",
                                                                  ]
                                                        }
                                                        start={{ x: 0.1, y: 0 }}
                                                        end={{ x: 1, y: 1 }}
                                                        style={styles.itemCardGradient}
                                                    >
                                                        <Image
                                                            source={item.itemImage}
                                                            style={[
                                                                styles.itemImage,
                                                                !isUnlocked && styles.itemImageLocked,
                                                            ]}
                                                            resizeMode="contain"
                                                        />

                                                        {!isUnlocked && (
                                                            <View style={styles.lockOverlay}>
                                                                <Ionicons
                                                                    name="lock-closed"
                                                                    size={20}
                                                                    color="rgba(255,255,255,0.9)"
                                                                />
                                                            </View>
                                                        )}

                                                        {isSelected && (
                                                            <View style={styles.selectedCheck}>
                                                                <Ionicons
                                                                    name="checkmark"
                                                                    size={13}
                                                                    color="#FFFFFF"
                                                                />
                                                            </View>
                                                        )}
                                                    </LinearGradient>
                                                </BlurView>
                                            </View>

                                            <View
                                                style={[
                                                    styles.levelBadge,
                                                    isUnlocked
                                                        ? styles.levelBadgeUnlocked
                                                        : styles.levelBadgeLocked,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.levelBadgeText,
                                                        isUnlocked && styles.levelBadgeTextUnlocked,
                                                    ]}
                                                >
                                                    Lv.{item.requiredLevel}
                                                </Text>
                                            </View>

                                            {isUnlocked && (
                                                <Text style={styles.itemLabel} numberOfLines={1}>
                                                    {item.label}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </LinearGradient>
                    </BlurView>
                </View>

                <LiquidGlassButton
                    size={60}
                    onPress={() => navigation.goBack()}
                    style={styles.closeBtn}
                >
                    <Ionicons name="close" size={30} color="#2B3E25" />
                </LiquidGlassButton>

                {selectedItem && (
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => {
                            setSelectedItem(null);
                            setAppliedItem(null);
                        }}
                        activeOpacity={0.75}
                    >
                        <Text style={styles.removeButtonText}>아이템 해제</Text>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#E8F5DF",
    },
    safe: {
        flex: 1,
    },

    // Header
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
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 27,
        color: "#111111",
        includeFontPadding: false,
    },

    // Affinity Card
    affinityCardWrap: {
        marginHorizontal: 20,
        marginTop: 12,
        marginBottom: 16,
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: "#2D4A20",
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    affinityBlur: {
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1.2,
        borderColor: "rgba(255,255,255,0.75)",
    },
    affinityGradient: {
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 18,
    },
    affinityRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    affinityBlock: {
        flex: 1,
        alignItems: "center",
        gap: 4,
    },
    affinityLabel: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 11,
        color: "#4A6240",
    },
    affinityScore: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 22,
        color: "#1F3C18",
    },
    affinityUnit: {
        fontSize: 14,
        color: "#3A5830",
    },
    affinityLevelText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 22,
        color: "#2B6B20",
    },
    affinityDivider: {
        width: 1,
        height: 36,
        backgroundColor: "rgba(80,130,60,0.25)",
    },
    progressRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: 2,
    },
    nextThresholdText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 10,
        color: "#5A7A4A",
    },
    progressBg: {
        width: "100%",
        height: 8,
        backgroundColor: "rgba(100,150,80,0.22)",
        borderRadius: 99,
        overflow: "hidden",
        marginTop: 2,
    },
    progressFill: {
        height: "100%",
        borderRadius: 99,
    },

    // Plant Preview
    plantPreviewArea: {
        alignItems: "center",
        marginBottom: 12,
    },
    plantPreviewInner: {
        width: 190,
        height: 190,
        alignItems: "center",
        justifyContent: "center",
    },
    plantPreviewImage: {
        width: 190,
        height: 190,
    },
    plantLabelGroup: {
        alignItems: "center",
        marginTop: 4,
        gap: 2,
    },
    plantName: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 20,
        color: "#1F3018",
    },
    plantDay: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 13,
        color: "#4A6840",
    },
    appliedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: "rgba(80,180,60,0.18)",
        borderRadius: 99,
        borderWidth: 1,
        borderColor: "rgba(60,140,45,0.35)",
    },
    appliedBadgeText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 11,
        color: "#2E6A22",
    },
    noItemBadge: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: "rgba(150,150,150,0.15)",
        borderRadius: 99,
        borderWidth: 1,
        borderColor: "rgba(150,150,150,0.3)",
    },
    noItemBadgeText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 11,
        color: "#888",
    },

    // Item Section
    itemSection: {
        marginHorizontal: 16,
        borderRadius: 22,
        overflow: "hidden",
        shadowColor: "#2D4A20",
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        borderWidth: 1.2,
        borderColor: "rgba(255,255,255,0.75)",
    },
    itemSectionBlur: {
        borderRadius: 22,
        overflow: "hidden",
    },
    itemSectionGradient: {
        paddingTop: 16,
        paddingBottom: 20,
        borderRadius: 22,
    },
    itemSectionTitle: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 14,
        color: "#2A4020",
        marginLeft: 18,
        marginBottom: 14,
    },
    itemScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },

    // Item Cards
    itemCardWrap: {
        alignItems: "center",
        width: 80,
        gap: 6,
    },
    itemCard: {
        width: 80,
        height: 80,
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: "#2D4A20",
        shadowOpacity: 0.16,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.6)",
    },
    itemCardSelected: {
        borderColor: "#5AB840",
        borderWidth: 2.5,
    },
    itemCardLocked: {
        borderColor: "rgba(180,180,180,0.4)",
    },
    itemCardBlur: {
        flex: 1,
        borderRadius: 18,
        overflow: "hidden",
    },
    itemCardGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
    },
    itemImage: {
        width: 54,
        height: 54,
    },
    itemImageLocked: {
        opacity: 0.3,
    },
    lockOverlay: {
        position: "absolute",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(60,60,60,0.35)",
        borderRadius: 18,
    },
    selectedCheck: {
        position: "absolute",
        top: 6,
        right: 6,
        width: 18,
        height: 18,
        borderRadius: 99,
        backgroundColor: "#3E8C2D",
        alignItems: "center",
        justifyContent: "center",
    },
    levelBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 99,
    },
    levelBadgeUnlocked: {
        backgroundColor: "rgba(70,160,50,0.2)",
        borderWidth: 1,
        borderColor: "rgba(70,160,50,0.4)",
    },
    levelBadgeLocked: {
        backgroundColor: "rgba(160,160,160,0.18)",
        borderWidth: 1,
        borderColor: "rgba(160,160,160,0.35)",
    },
    levelBadgeText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 10,
        color: "#888",
    },
    levelBadgeTextUnlocked: {
        color: "#2E7020",
    },
    itemLabel: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 10,
        color: "#2A4020",
        textAlign: "center",
    },

    closeBtn: {
        position: "absolute",
        bottom: 32,
        left: 24,
        zIndex: 100,
    },

    removeButton: {
        position: "absolute",
        bottom: 42,
        right: 24,
        zIndex: 100,
        paddingHorizontal: 28,
        paddingVertical: 9,
        backgroundColor: "rgba(200,80,60,0.14)",
        borderRadius: 99,
        borderWidth: 1,
        borderColor: "rgba(200,80,60,0.35)",
    },
    removeButtonText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 13,
        color: "#A03020",
    },
});
