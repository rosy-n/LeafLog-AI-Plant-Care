import React, { useEffect, useState } from "react";
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
import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import HeartsRow from "../components/HeartsRow";
import { Colors, GreenTint, Leaf, Accent, Glass } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { plantImages } from "../data/plants";
import { getPlantAffinity } from "../api";

/*
    꾸미기 아이템 — requiredLevel 은 "꽉 찬 하트 수"다.
    돌봄(물주기/영양제/분갈이)으로 애정도가 쌓여 하트가 한 칸 채워질 때마다
    다음 아이템이 해금된다. 점수→하트 환산은 서버(app/affinity.py)가 정한다.
*/
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

// 등록일 기준 함께한 일수
function daysSince(iso) {
    if (!iso) return 0;
    const created = new Date(iso).getTime();
    if (Number.isNaN(created)) return 0;
    return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

export default function PlantDecorateScreen({ navigation, route, appliedItem, setAppliedItem }) {
    const plant = route?.params?.plant;

    // 애정도 — 정원 목록에서 넘어온 값으로 먼저 그리고 서버 값으로 갱신한다.
    // 점수/하트/해금 단계와 다음 단계 기준은 모두 서버가 계산해서 내려준다.
    const [affinity, setAffinity] = useState(() => ({
        score: plant?.affinityScore ?? 0,
        hearts: plant?.hearts ?? 0,
        level: plant?.affinityLevel ?? 0,
        next_level_score: null,
        level_progress_pct: 0,
    }));

    useEffect(() => {
        const id = plant?.id;
        if (!id) return;
        let active = true;
        getPlantAffinity(Number(id))
            .then((status) => {
                if (active) setAffinity(status);
            })
            .catch((e) => console.warn("애정도 조회 실패:", e?.message));
        return () => {
            active = false;
        };
    }, [plant?.id]);

    const affinityLevel = affinity.level ?? 0;
    const progressPercent = affinity.level_progress_pct ?? 0;

    const [selectedItem, setSelectedItem] = useState(appliedItem ?? null);

    const handleItemPress = (item) => {
        if (item.requiredLevel > affinityLevel) return;
        const next = selectedItem?.id === item.id ? null : item;
        setSelectedItem(next);
        setAppliedItem(next);
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>

                {/* Header */}
                <ScreenHeader title="식물 꾸미기" onBack={() => navigation.goBack()} />

                {/* Affinity Card */}
                <View style={styles.affinityCardWrap}>
                    <BlurView intensity={28} tint="light" style={styles.affinityBlur}>
                        <LinearGradient
                            colors={[
                                Glass.frost72,
                                Glass.mist,
                                Glass.mistSoft,
                            ]}
                            start={{ x: 0.1, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.affinityGradient}
                        >
                            {/* 하트 — 돌봄으로 쌓인 애정도를 개체탭과 같은 아이콘으로 */}
                            <View style={styles.affinityHeartsRow}>
                                <HeartsRow count={affinity.hearts ?? 0} size={24} />
                            </View>

                            <View style={styles.affinityRow}>
                                <View style={styles.affinityBlock}>
                                    <Text style={styles.affinityLabel}>애정도</Text>
                                    <Text style={styles.affinityScore}>
                                        {affinity.score ?? 0}
                                        <Text style={styles.affinityUnit}>점</Text>
                                    </Text>
                                </View>

                                <View style={styles.affinityDivider} />

                                <View style={styles.affinityBlock}>
                                    <Text style={styles.affinityLabel}>단계</Text>
                                    <Text style={styles.affinityLevelText}>
                                        {affinityLevel > 0 ? `Lv.${affinityLevel}` : "Lv.-"}
                                    </Text>
                                </View>

                                <View style={styles.affinityDivider} />

                                <View style={[styles.affinityBlock, { flex: 1.6 }]}>
                                    <View style={styles.progressRow}>
                                        <Text style={styles.affinityLabel}>
                                            {affinity.next_level_score ? "다음 단계" : "최고 단계"}
                                        </Text>
                                        {affinity.next_level_score ? (
                                            <Text style={styles.nextThresholdText}>
                                                {affinity.next_level_score}점
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.progressBg}>
                                        <LinearGradient
                                            colors={[Leaf.bright, Leaf.deep]}
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
                                source={plant?.imageUri ? { uri: plant.imageUri } : plantImages[plant?.imageKey ?? "spaghetti"]}
                                style={styles.plantPreviewImage}
                                resizeMode="contain"
                            />
                        )}
                    </View>

                    <View style={styles.plantLabelGroup}>
                        <Text style={styles.plantName}>{plant?.name ?? "내 식물"}</Text>
                        <Text style={styles.plantDay}>D+{daysSince(plant?.createdAt)}</Text>
                    </View>

                    {selectedItem ? (
                        <View style={styles.appliedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={GreenTint.strong} />
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
                                Glass.frost72,
                                Glass.mist,
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
                                                                      Glass.leafBright,
                                                                      Glass.leafSoft,
                                                                  ]
                                                                : isUnlocked
                                                                ? [
                                                                      Glass.frost72,
                                                                      Glass.mist,
                                                                  ]
                                                                : [
                                                                      Glass.gray45,
                                                                      Glass.gray30,
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
                                                                    color={Glass.frost92}
                                                                />
                                                            </View>
                                                        )}

                                                        {isSelected && (
                                                            <View style={styles.selectedCheck}>
                                                                <Ionicons
                                                                    name="checkmark"
                                                                    size={13}
                                                                    color={Colors.white}
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

                                            {/* 잠긴 아이템은 해금 조건(하트 수)을 대신 보여준다 */}
                                            {isUnlocked ? (
                                                <Text style={styles.itemLabel} numberOfLines={1}>
                                                    {item.label}
                                                </Text>
                                            ) : (
                                                <Text
                                                    style={[styles.itemLabel, styles.itemLabelLocked]}
                                                    numberOfLines={1}
                                                >
                                                    하트 {item.requiredLevel}개
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </LinearGradient>
                    </BlurView>
                </View>

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
        backgroundColor: Colors.background,
    },
    safe: {
        flex: 1,
    },

    // Header

    // Affinity Card
    affinityCardWrap: {
        marginHorizontal: Spacing.xl,
        marginTop: Spacing.md,
        marginBottom: Spacing.lg,
        borderRadius: Radius.xl,
        overflow: "hidden",
        shadowColor: GreenTint.deep,
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    affinityBlur: {
        borderRadius: Radius.xl,
        overflow: "hidden",
        borderWidth: 1.2,
        borderColor: Glass.frost72,
    },
    affinityGradient: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        borderRadius: Radius.xl,
    },
    affinityHeartsRow: {
        alignItems: "center",
        marginBottom: Spacing.md,
    },
    affinityRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },
    affinityBlock: {
        flex: 1,
        alignItems: "center",
        gap: Spacing.xs,
    },
    affinityLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.deep,
    },
    affinityScore: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.primary,
    },
    affinityUnit: {
        fontSize: FontSizes.body,
        color: GreenTint.deep,
    },
    affinityLevelText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: GreenTint.deep,
    },
    affinityDivider: {
        width: 1,
        height: 36,
        backgroundColor: GreenTint.line,
    },
    progressRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: Spacing.xxs,
    },
    nextThresholdText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        color: GreenTint.strong,
    },
    progressBg: {
        width: "100%",
        height: 8,
        backgroundColor: GreenTint.soft,
        borderRadius: Radius.pill,
        overflow: "hidden",
        marginTop: Spacing.xxs,
    },
    progressFill: {
        height: "100%",
        borderRadius: Radius.pill,
    },

    // Plant Preview
    plantPreviewArea: {
        alignItems: "center",
        marginBottom: Spacing.md,
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
        marginTop: Spacing.xs,
        gap: Spacing.xxs,
    },
    plantName: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.primary,
    },
    plantDay: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.deep,
    },
    appliedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
        marginTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: GreenTint.soft,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: GreenTint.line,
    },
    appliedBadgeText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.deep,
    },
    noItemBadge: {
        marginTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Glass.gray15,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Glass.gray30b,
    },
    noItemBadgeText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textGray,
    },

    // Item Section
    itemSection: {
        marginHorizontal: Spacing.lg,
        borderRadius: Radius.xl,
        overflow: "hidden",
        shadowColor: GreenTint.deep,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        borderWidth: 1.2,
        borderColor: Glass.frost72,
    },
    itemSectionBlur: {
        borderRadius: Radius.xl,
        overflow: "hidden",
    },
    itemSectionGradient: {
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xl,
        borderRadius: Radius.xl,
    },
    itemSectionTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.primary,
        marginLeft: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    itemScroll: {
        paddingHorizontal: Spacing.lg,
        gap: Spacing.md,
    },

    // Item Cards
    itemCardWrap: {
        alignItems: "center",
        width: 80,
        gap: Spacing.sm,
    },
    itemCard: {
        width: 80,
        height: 80,
        borderRadius: Radius.xl,
        overflow: "hidden",
        shadowColor: GreenTint.deep,
        shadowOpacity: 0.16,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
        borderWidth: 1.5,
        borderColor: Glass.frost60,
    },
    itemCardSelected: {
        borderColor: GreenTint.medium,
        borderWidth: 2.5,
    },
    itemCardLocked: {
        borderColor: Glass.gray40,
    },
    itemCardBlur: {
        flex: 1,
        borderRadius: Radius.xl,
        overflow: "hidden",
    },
    itemCardGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Radius.xl,
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
        backgroundColor: Glass.gray35d,
        borderRadius: Radius.xl,
    },
    selectedCheck: {
        position: "absolute",
        top: 6,
        right: 6,
        width: 18,
        height: 18,
        borderRadius: Radius.pill,
        backgroundColor: GreenTint.strong,
        alignItems: "center",
        justifyContent: "center",
    },
    levelBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xxs,
        borderRadius: Radius.pill,
    },
    levelBadgeUnlocked: {
        backgroundColor: GreenTint.soft,
        borderWidth: 1,
        borderColor: GreenTint.line,
    },
    levelBadgeLocked: {
        backgroundColor: Glass.gray18,
        borderWidth: 1,
        borderColor: Glass.gray35,
    },
    levelBadgeText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        color: Colors.textGray,
    },
    levelBadgeTextUnlocked: {
        color: GreenTint.deep,
    },
    itemLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        color: Colors.primary,
        textAlign: "center",
    },
    itemLabelLocked: {
        color: Colors.textGray,
    },

    removeButton: {
        position: "absolute",
        bottom: 42,
        right: 24,
        zIndex: 100,
        paddingHorizontal: Spacing.section,
        paddingVertical: Spacing.sm,
        backgroundColor: Glass.warm14,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Glass.warm35,
    },
    removeButtonText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Accent.rust,
    },
});
