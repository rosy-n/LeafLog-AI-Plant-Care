import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    StatusBar,
    Alert,
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
import {
    ACCESSORY_IMAGES,
    BACKGROUND_IMAGES,
    DEFAULT_BACKGROUND_KEY,
} from "../data/decor";
import {
    getItems,
    getPlantAffinity,
    setPlantDecoration,
    updateHomeBackground,
} from "../api";

/*
    꾸미기 아이템 — 이름과 requiredLevel("꽉 찬 하트 수")은 서버 item 테이블이 단일 출처다
    (GET /api/items). 돌봄(물주기/영양제/분갈이)으로 애정도가 쌓여 하트가 한 칸
    채워질 때마다 다음 아이템이 해금된다. 점수→하트 환산은 app/affinity.py 가 정한다.

    이미지는 앱 번들이라 서버가 준 item_key 로 src/data/decor.js 에서 찾는다.
    번들에 이미지가 없는 키(서버에 아이템만 먼저 추가된 경우)는 그려질 게 없어 건너뛴다.
*/
function toAccessory(item) {
    const images = ACCESSORY_IMAGES[item.item_key];
    if (!images) return null;
    return {
        id: item.id,
        key: item.item_key,
        label: item.item_name,
        requiredLevel: item.required_level,
        itemImage: images.card,
        plantImage: images.plant,
    };
}

function toBackground(item) {
    const preview = BACKGROUND_IMAGES[item.item_key];
    if (!preview) return null;
    return {
        id: item.id,
        key: item.item_key,
        label: item.item_name,
        requiredLevel: item.required_level,
        preview,
    };
}

// 등록일 기준 함께한 일수
function daysSince(iso) {
    if (!iso) return 0;
    const created = new Date(iso).getTime();
    if (Number.isNaN(created)) return 0;
    return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

export default function PlantDecorateScreen({
    navigation,
    route,
    plants = [],
    decorations,
    applyDecoration,
    appliedBg = DEFAULT_BACKGROUND_KEY,
    setAppliedBg,
}) {
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

    /*
        배경 해금 기준은 개체가 아니라 "개체 중 가장 높은 단계"다 —
        배경은 홈 전체에 적용되는데 애정도는 개체별이라, 한 마리를 잘 키운 보상이
        홈에 남게 하려는 것. 서버(PATCH /api/settings/home-background)도 같은 기준으로
        검증하므로 여기서 다르게 그리면 눌러도 403이 난다.
    */
    const backgroundUnlockLevel = plants.reduce(
        (best, row) => Math.max(best, row?.affinityLevel ?? 0),
        affinityLevel,
    );

    // 아이템 목록 — 서버에서 받아 번들 이미지가 있는 것만 남긴다
    const [accessories, setAccessories] = useState([]);
    const [backgrounds, setBackgrounds] = useState([]);

    useEffect(() => {
        let active = true;
        getItems()
            .then((rows) => {
                if (!active) return;
                setAccessories(
                    rows.filter((r) => r.item_type === "ACCESSORY").map(toAccessory).filter(Boolean),
                );
                setBackgrounds(
                    rows.filter((r) => r.item_type === "BACKGROUND").map(toBackground).filter(Boolean),
                );
            })
            .catch((e) => console.warn("꾸미기 아이템 조회 실패:", e?.message));
        return () => {
            active = false;
        };
    }, []);

    // 착용 중인 액세서리 — 서버(plant_decoration)에 저장된 키를 목록에서 찾아 맞춘다
    const appliedKey = decorations?.[String(plant?.id)] ?? null;
    const selectedItem = accessories.find((item) => item.key === appliedKey) ?? null;

    // 저장 중에는 다음 탭을 받지 않는다 — 연달아 누르면 응답 순서가 뒤바뀔 수 있다
    const [saving, setSaving] = useState(false);

    const changeDecoration = async (next) => {
        const id = plant?.id;
        if (!id || saving) return;
        setSaving(true);
        try {
            await setPlantDecoration(Number(id), next?.id ?? null);
            // 서버 저장이 끝난 뒤에만 화면에 반영한다 (실패하면 이전 상태 그대로)
            applyDecoration?.(id, next?.key ?? null);
        } catch (e) {
            Alert.alert("적용 실패", e?.message ?? "다시 시도해주세요.");
        } finally {
            setSaving(false);
        }
    };

    const handleItemPress = (item) => {
        if (item.requiredLevel > affinityLevel) return;
        // 착용 중인 아이템을 다시 누르면 벗는다
        changeDecoration(selectedItem?.id === item.id ? null : item);
    };

    // 배경은 홈 화면 전체에 적용된다 — 해제 개념이 없어 다시 눌러도 유지한다
    const handleBackgroundPress = async (background) => {
        if (background.requiredLevel > backgroundUnlockLevel) return;
        if (appliedBg === background.key || saving) return;
        const previous = appliedBg;
        setAppliedBg?.(background.key);
        setSaving(true);
        try {
            await updateHomeBackground(background.id);
        } catch (e) {
            setAppliedBg?.(previous);
            Alert.alert("배경 적용 실패", e?.message ?? "다시 시도해주세요.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>

                {/* Header */}
                <ScreenHeader title="식물 꾸미기" onBack={() => navigation.goBack()} />

                {/* 아이템 + 배경 두 섹션이 들어가 화면을 넘길 수 있어 스크롤로 감싼다 */}
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >

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
                                {accessories.map((item) => {
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

                {/* Background Selection Section — 아이템과 같은 애정도 단계 기준으로 해금 */}
                <View style={[styles.itemSection, styles.bgSection]}>
                    <BlurView intensity={22} tint="light" style={styles.itemSectionBlur}>
                        <LinearGradient
                            colors={[Glass.frost72, Glass.mist]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.itemSectionGradient}
                        >
                            <Text style={styles.itemSectionTitle}>홈 배경</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.itemScroll}
                            >
                                {backgrounds.map((background) => {
                                    const isUnlocked =
                                        background.requiredLevel <= backgroundUnlockLevel;
                                    const isApplied = appliedBg === background.key;

                                    return (
                                        <TouchableOpacity
                                            key={background.key}
                                            activeOpacity={isUnlocked ? 0.78 : 1}
                                            onPress={() => handleBackgroundPress(background)}
                                            style={styles.bgCardWrap}
                                        >
                                            <View
                                                style={[
                                                    styles.bgCard,
                                                    isApplied && styles.itemCardSelected,
                                                    !isUnlocked && styles.itemCardLocked,
                                                ]}
                                            >
                                                <Image
                                                    source={background.preview}
                                                    style={[
                                                        styles.bgPreview,
                                                        !isUnlocked && styles.itemImageLocked,
                                                    ]}
                                                    resizeMode="cover"
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

                                                {isApplied && (
                                                    <View style={styles.selectedCheck}>
                                                        <Ionicons
                                                            name="checkmark"
                                                            size={13}
                                                            color={Colors.white}
                                                        />
                                                    </View>
                                                )}
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
                                                    {background.requiredLevel === 0
                                                        ? "기본"
                                                        : `Lv.${background.requiredLevel}`}
                                                </Text>
                                            </View>

                                            {isUnlocked ? (
                                                <Text style={styles.itemLabel} numberOfLines={1}>
                                                    {background.label}
                                                </Text>
                                            ) : (
                                                <Text
                                                    style={[styles.itemLabel, styles.itemLabelLocked]}
                                                    numberOfLines={1}
                                                >
                                                    하트 {background.requiredLevel}개
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </LinearGradient>
                    </BlurView>
                </View>

                </ScrollView>

                {selectedItem && (
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => changeDecoration(null)}
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
    // 아래 "아이템 해제" 플로팅 버튼에 마지막 섹션이 가리지 않도록 여유를 둔다
    scrollContent: {
        paddingBottom: 110,
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

    // 홈 배경 카드 — 세로 화면 비율이라 아이템 카드보다 길다
    bgSection: {
        marginTop: Spacing.lg,
    },
    bgCardWrap: {
        alignItems: "center",
        width: 84,
        gap: Spacing.sm,
    },
    bgCard: {
        width: 84,
        height: 132,
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
    bgPreview: {
        width: "100%",
        height: "100%",
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
