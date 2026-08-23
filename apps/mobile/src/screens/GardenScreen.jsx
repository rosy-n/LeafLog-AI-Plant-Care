import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Animated,
    PanResponder,
    Dimensions,
    TextInput,
    Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { updatePlant } from "../api";
import PlantImage from "../components/PlantImage";
import HeartsRow from "../components/HeartsRow";
import LiquidGlassButton from "../components/LiquidGlassButton";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint, Paper, Leaf, Accent, Glass } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import { getPlantExpressionSource } from "../data/characterExpressions";
import { accessorySpriteBundle } from "../data/decor";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SKY_HEIGHT = 126;
const CLOSE_THRESHOLD = 120;

const SORT_OPTIONS = [
    { key: "favorite", label: "즐겨찾기" },
    { key: "hearts",   label: "호감도순" },
    { key: "recent",   label: "최신순"   },
    { key: "memorial", label: "추모정원" },
];

function applySortFilter(plantList, sort, query) {
    let result = [...plantList];

    if (sort === "memorial") {
        result = result.filter((p) => p.memorial);
    } else if (sort === "favorite") {
        result.sort((a, b) => {
            if (a.favorite === b.favorite) return Number(a.id) - Number(b.id);
            return a.favorite ? -1 : 1;
        });
    } else if (sort === "hearts") {
        result.sort((a, b) => (b.hearts ?? 0) - (a.hearts ?? 0));
    } else if (sort === "recent") {
        result.sort((a, b) => Number(b.id) - Number(a.id));
    }

    const q = query.trim().toLowerCase();
    if (q) result = result.filter((p) => p.name.toLowerCase().includes(q));

    return result;
}

export default function GardenScreen({ navigation, plants, setPlants, username, reloadPlants, decorations = {} }) {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const searchAnim = useRef(new Animated.Value(0)).current;

    const [sortKey, setSortKey] = useState("favorite");
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef(null);

    const sortKeyRef = useRef("favorite");
    const searchQueryRef = useRef("");
    const plantsRef = useRef(plants);
    useEffect(() => { sortKeyRef.current = sortKey; }, [sortKey]);
    useEffect(() => { searchQueryRef.current = searchQuery; }, [searchQuery]);
    useEffect(() => { plantsRef.current = plants; }, [plants]);

    const [displayPlants, setDisplayPlants] = useState(() =>
        applySortFilter(plants, "favorite", "")
    );

    const isFirstFocusRef = useRef(true);

    useEffect(() => {
        setDisplayPlants(applySortFilter(plants, sortKey, searchQuery));
    }, [plants, sortKey, searchQuery]);

    useEffect(() => {
        Animated.timing(translateY, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
        }).start();
    }, [translateY]);

    /*
      정원탭을 나갔다 다시 들어왔을 때만 정렬 반영.
      별을 누르는 순간에는 순서가 바로 바뀌지 않습니다.
    */
    useFocusEffect(
        useCallback(() => {
            // 정원 재진입 시 DB에서 최신 목록 반영 (식물 등록 후 등)
            reloadPlants?.();
            if (isFirstFocusRef.current) {
                isFirstFocusRef.current = false;
                return;
            }
            setDisplayPlants(
                applySortFilter(plantsRef.current, sortKeyRef.current, searchQueryRef.current)
            );
        }, [reloadPlants])
    );

    useEffect(() => {
        if (isSearchActive) {
            Animated.spring(searchAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 120,
                friction: 10,
            }).start(() => searchInputRef.current?.focus());
        }
    }, [isSearchActive, searchAnim]);

    const closeGarden = () => {
        Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 230,
            useNativeDriver: true,
        }).start(() => navigation.goBack());
    };

    const resetGardenPosition = () => {
        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 90,
            friction: 13,
        }).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) =>
                gestureState.dy > 8 &&
                Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) translateY.setValue(gestureState.dy);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > CLOSE_THRESHOLD || gestureState.vy > 1.1) {
                    closeGarden();
                } else {
                    resetGardenPosition();
                }
            },
            onPanResponderTerminate: () => resetGardenPosition(),
        })
    ).current;

    /*
        즐겨찾기는 서버(plant.is_favorite)가 원본이다 — 앱을 다시 켜도 유지되게.

        별을 누르면 화면을 먼저 바꾸고 저장에 실패하면 되돌린다. 응답을 기다렸다가
        칠하면 한 박자 늦게 바뀌어 눌리지 않은 것처럼 보인다.
        같은 개체를 연달아 누르면 응답이 보낸 순서대로 오지 않을 수 있어
        (먼저 보낸 요청의 응답이 나중에 도착하면 옛 값으로 되돌아간다)
        개체별로 마지막 요청의 응답만 반영한다.
    */
    const favoriteSeq = useRef({});

    const paintFavorite = (plantId, value) => {
        const nextPlants = plantsRef.current.map((plant) =>
            plant.id === plantId ? { ...plant, favorite: value } : plant
        );
        plantsRef.current = nextPlants;
        setPlants(nextPlants);
        setDisplayPlants((prev) =>
            prev.map((plant) =>
                plant.id === plantId ? { ...plant, favorite: value } : plant
            )
        );
    };

    const toggleFavorite = async (plantId) => {
        const target = plantsRef.current.find((plant) => plant.id === plantId);
        if (!target) return;

        const previous = target.favorite;
        const next = !previous;
        const seq = (favoriteSeq.current[plantId] ?? 0) + 1;
        favoriteSeq.current[plantId] = seq;

        paintFavorite(plantId, next);
        try {
            const saved = await updatePlant(Number(plantId), { is_favorite: next });
            if (seq !== favoriteSeq.current[plantId]) return;
            // 서버가 준 값으로 한 번 더 맞춘다
            paintFavorite(plantId, saved.is_favorite);
        } catch (error) {
            if (seq !== favoriteSeq.current[plantId]) return;
            paintFavorite(plantId, previous);
            Alert.alert("즐겨찾기 저장 실패", error?.message ?? "다시 시도해주세요.");
        }
    };

    const openSearch = () => {
        searchAnim.setValue(0);
        setShowSortMenu(false);
        setIsSearchActive(true);
    };

    const closeSearch = () => {
        Animated.timing(searchAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
        }).start(() => {
            setIsSearchActive(false);
            setSearchQuery("");
        });
    };

    const searchTranslateX = searchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [120, 0],
    });
    const searchOpacity = searchAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.6, 1],
    });

    const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "즐겨찾기";
    const isMemorialMode = sortKey === "memorial";

    return (
        <View style={styles.modalRoot} pointerEvents="box-none">
            <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
                <View style={styles.dragZone} {...panResponder.panHandlers}>
                    <View style={styles.dragHandle} />

                    <View style={styles.header}>
                        {!isSearchActive && (
                            <Text style={styles.title}>{username}의 정원</Text>
                        )}

                        <View style={[styles.headerRight, isSearchActive && styles.headerRightExpanded]}>
                            {isSearchActive ? (
                                <Animated.View
                                    style={[
                                        styles.searchContainer,
                                        {
                                            opacity: searchOpacity,
                                            transform: [{ translateX: searchTranslateX }],
                                        },
                                    ]}
                                >
                                    <TextInput
                                        ref={searchInputRef}
                                        style={styles.searchInput}
                                        placeholder="식물 이름 검색"
                                        placeholderTextColor={Colors.textFaint}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        returnKeyType="search"
                                        autoCorrect={false}
                                        autoCapitalize="none"
                                    />
                                </Animated.View>
                            ) : (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setShowSortMenu((v) => !v)}
                                    style={styles.sortButton}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={[
                                        styles.sortButtonText,
                                        isMemorialMode && styles.sortButtonTextMemorial,
                                    ]}>
                                        {currentSortLabel}▼
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <LiquidGlassButton
                                size={46}
                                onPress={isSearchActive ? closeSearch : openSearch}
                            >
                                <Ionicons
                                    name={isSearchActive ? "close" : "search"}
                                    size={25}
                                    color={GreenTint.deep}
                                />
                            </LiquidGlassButton>
                        </View>
                    </View>
                </View>

                <FlatList
                    style={{ flex: 1 }}
                    data={displayPlants}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>
                                {isMemorialMode
                                    ? "추모정원이 비어 있습니다"
                                    : "검색 결과가 없습니다"}
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const accessory = decorations[String(item.id)]?.accessory ?? null;
                        return (
                            <View style={styles.card}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => navigation.replace("PlantDetail", { plant: item })}
                                >
                                    <PlantImage
                                        uri={item.imageUri}
                                        imageKey={item.imageKey}
                                        expressionSource={item.characterFaceRemoved ? getPlantExpressionSource(item) : null}
                                        expressionBounds={item.characterFaceBounds}
                                        effectRemote={accessory?.spriteUrl ? { uri: accessory.spriteUrl } : null}
                                        effectFallback={accessorySpriteBundle(accessory?.key)}
                                        width={118}
                                        height={118}
                                    />

                                {/*
                                    물 줄 때가 지난 개체 표시 — 알림을 놓쳤을 때의 안전망.
                                    추모정원(떠나보낸 개체)에는 붙이지 않는다.
                                */}
                                {!item.memorial && item.daysUntilWatering != null
                                && item.daysUntilWatering <= 0 ? (
                                    <View style={styles.wateringBadge}>
                                        <Text style={styles.wateringBadgeText}>
                                            {item.daysUntilWatering === 0
                                                ? "물 주는 날"
                                                : `${-item.daysUntilWatering}일 지남`}
                                        </Text>
                                    </View>
                                ) : null}
                                </TouchableOpacity>

                                <View style={styles.nameRow}>
                                    <Text style={styles.plantName} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => toggleFavorite(item.id)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={[styles.star, { color: item.favorite ? Leaf.gold : Colors.textFaint }]}>
                                            ★
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <HeartsRow count={item.hearts} size={15} />
                            </View>
                        );
                    }}
                />

                <LiquidGlassButton
                    size={60}
                    onPress={() => navigation.navigate('AddPlant')}
                    style={styles.addBtn}
                >
                    <Ionicons name="add" size={34} color={GreenTint.deep} />
                </LiquidGlassButton>

                {showSortMenu && (
                    <>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={() => setShowSortMenu(false)}
                        />
                        <View style={styles.sortMenuShadow}>
                            <View style={styles.sortMenu}>
                                {SORT_OPTIONS.map((option, index) => (
                                    <TouchableOpacity
                                        key={option.key}
                                        style={[
                                            styles.sortMenuItem,
                                            index < SORT_OPTIONS.length - 1 && styles.sortMenuItemDivider,
                                        ]}
                                        onPress={() => {
                                            setSortKey(option.key);
                                            setShowSortMenu(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.sortMenuText,
                                            sortKey === option.key && styles.sortMenuTextActive,
                                            option.key === "memorial" && styles.sortMenuTextMemorial,
                                        ]}>
                                            {sortKey === option.key ? "✓ " : "   "}{option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </>
                )}
            </Animated.View>
        </View>
    );
}

const greenTextShadow = {
    textShadowColor: GreenTint.soft,
    textShadowOffset: { width: 1.3, height: 1.3 },
    textShadowRadius: 0,
};

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        backgroundColor: "transparent",
    },

    sheet: {
        position: "absolute",
        top: SKY_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Colors.white,
    },

    dragZone: {
        backgroundColor: Colors.white,
    },
    dragHandle: {
        alignSelf: "center",
        width: 70,
        height: 5,
        borderRadius: Radius.xs,
        backgroundColor: Colors.border,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },

    header: {
        height: 76,
        paddingHorizontal: Spacing.xl,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    title: {
        fontSize: FontSizes.title,
        fontFamily: Fonts.neoDunggeunmo,
        color: GreenTint.deep,
        letterSpacing: 0.3,
        flexShrink: 1,
        ...greenTextShadow,
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerRightExpanded: {
        flex: 1,
    },

    sortButton: {
        marginRight: Spacing.xl,
    },
    sortButtonText: {
        fontSize: FontSizes.bodyLarge,
        fontFamily: Fonts.neoDunggeunmo,
        color: GreenTint.deep,
    },
    sortButtonTextMemorial: {
        color: Accent.brown,
    },

    searchContainer: {
        flex: 1,
        height: 38,
        backgroundColor: Glass.frost92,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: Colors.border,
        marginRight: Spacing.md,
    },
    searchInput: {
        fontSize: FontSizes.bodyLarge,
        fontFamily: Fonts.neoDunggeunmo,
        color: GreenTint.deep,
        padding: Spacing.none,
    },

    sortMenuShadow: {
        position: "absolute",
        top: 101,
        right: 70,
        shadowColor: GreenTint.deep,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
        elevation: 8,
        borderRadius: Radius.md,
    },
    sortMenu: {
        backgroundColor: Colors.white,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        minWidth: 130,
        overflow: "hidden",
    },
    sortMenuItem: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    sortMenuItemDivider: {
        borderBottomWidth: 1,
        borderBottomColor: Paper.tan,
    },
    sortMenuText: {
        fontSize: FontSizes.bodyLarge,
        fontFamily: Fonts.neoDunggeunmo,
        color: GreenTint.strong,
        letterSpacing: -0.3,
    },
    sortMenuTextActive: {
        color: GreenTint.deep,
        fontFamily: Fonts.neoDunggeunmo,
    },
    sortMenuTextMemorial: {
        color: Accent.brown,
    },

    listContent: {
        ...screenContent,
        paddingTop: Spacing.xxl,
        gap: Spacing.none,
    },
    columnWrapper: {
        justifyContent: "flex-start",
    },
    card: {
        width: "33.333%",
        alignItems: "center",
        marginBottom: Spacing.section,
    },
    // 물 줄 때가 지난 개체 배지 — 캐릭터 이미지 우상단
    wateringBadge: {
        position: "absolute",
        top: 0,
        right: 0,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Radius.pill,
        backgroundColor: Accent.airBlue,
    },
    wateringBadgeText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    nameRow: {
        marginTop: -3,
        maxWidth: 120,
        flexDirection: "row",
        alignItems: "center",
    },
    plantName: {
        fontSize: FontSizes.subtitle,
        fontFamily: Fonts.neoDunggeunmo,
        color: GreenTint.deep,
        letterSpacing: -1,
        ...greenTextShadow,
    },
    star: {
        marginLeft: Spacing.xxs,
        fontSize: FontSizes.title,
        fontFamily: Fonts.neoDunggeunmo,
        textShadowColor: Colors.textGray,
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 0,
    },

    addBtn: {
        position: "absolute",
        bottom: 28,
        right: 24,
        zIndex: 100,
    },

    emptyState: {
        paddingTop: 60,
        alignItems: "center",
    },
    emptyStateText: {
        fontSize: FontSizes.bodyLarge,
        color: Colors.textFaint,
        fontFamily: Fonts.neoDunggeunmo,
    },
});
