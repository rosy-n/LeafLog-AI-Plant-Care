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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import PlantImage from "../components/PlantImage";
import HeartsRow from "../components/HeartsRow";
import LiquidGlassButton from "../components/LiquidGlassButton";

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

export default function GardenScreen({ navigation, plants, setPlants, username }) {
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
            if (isFirstFocusRef.current) {
                isFirstFocusRef.current = false;
                return;
            }
            setDisplayPlants(
                applySortFilter(plantsRef.current, sortKeyRef.current, searchQueryRef.current)
            );
        }, [])
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

    const toggleFavorite = (plantId) => {
        const nextPlants = plantsRef.current.map((plant) =>
            plant.id === plantId ? { ...plant, favorite: !plant.favorite } : plant
        );
        plantsRef.current = nextPlants;
        setPlants(nextPlants);
        setDisplayPlants((prev) =>
            prev.map((plant) =>
                plant.id === plantId ? { ...plant, favorite: !plant.favorite } : plant
            )
        );
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
                                        placeholderTextColor="#A7A7A7"
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
                                    color="#2F6D2E"
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
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    if (item.id === "1") navigation.replace("PlantDetail");
                                }}
                            >
                                <PlantImage imageKey={item.imageKey} width={118} height={118} />
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
                                    <Text style={[styles.star, { color: item.favorite ? "#E2C23A" : "#A7A7A7" }]}>
                                        ★
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <HeartsRow count={item.hearts} size={17} />
                        </View>
                    )}
                />

                <LiquidGlassButton
                    size={60}
                    onPress={closeGarden}
                    style={styles.closeBtn}
                >
                    <Ionicons name="close" size={30} color="#2F6D2E" />
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
    textShadowColor: "#CFE6BE",
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
        backgroundColor: "#FFFDF1",
    },

    dragZone: {
        backgroundColor: "#FFFDF1",
    },
    dragHandle: {
        alignSelf: "center",
        width: 70,
        height: 5,
        borderRadius: 3,
        backgroundColor: "#E3DED1",
        marginTop: 12,
        marginBottom: 8,
    },

    header: {
        height: 76,
        paddingHorizontal: 18,
        backgroundColor: "#FFFDF1",
        borderBottomWidth: 1,
        borderBottomColor: "#DEDCCB",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    title: {
        fontSize: 20,
        fontFamily: "NeoDunggeunmoPro-Regular",
        color: "#2F702D",
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
        marginRight: 18,
    },
    sortButtonText: {
        fontSize: 16,
        fontFamily: "NeoDunggeunmoPro-Regular",
        color: "#2F702D",
    },
    sortButtonTextMemorial: {
        color: "#8B6B5E",
    },

    searchContainer: {
        flex: 1,
        height: 38,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: 10,
        paddingHorizontal: 12,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#DEDCCB",
        marginRight: 10,
    },
    searchInput: {
        fontSize: 15,
        fontFamily: "NeoDunggeunmoPro-Regular",
        color: "#2F7830",
        padding: 0,
    },

    sortMenuShadow: {
        position: "absolute",
        top: 101,
        right: 70,
        shadowColor: "#385236",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
        elevation: 8,
        borderRadius: 12,
    },
    sortMenu: {
        backgroundColor: "#FFFDF1",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#DEDCCB",
        minWidth: 130,
        overflow: "hidden",
    },
    sortMenuItem: {
        paddingVertical: 13,
        paddingHorizontal: 18,
    },
    sortMenuItemDivider: {
        borderBottomWidth: 1,
        borderBottomColor: "#EEEAD8",
    },
    sortMenuText: {
        fontSize: 15,
        fontFamily: "NeoDunggeunmoPro-Regular",
        color: "#5A7A59",
        letterSpacing: -0.3,
    },
    sortMenuTextActive: {
        color: "#2F7030",
        fontFamily: "NeoDunggeunmoPro-Regular",
    },
    sortMenuTextMemorial: {
        color: "#8B6B5E",
    },

    listContent: {
        paddingTop: 24,
        paddingHorizontal: 18,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: "flex-start",
    },
    card: {
        width: "33.333%",
        alignItems: "center",
        marginBottom: 28,
    },
    nameRow: {
        marginTop: -3,
        maxWidth: 120,
        flexDirection: "row",
        alignItems: "center",
    },
    plantName: {
        fontSize: 18,
        fontFamily: "NeoDunggeunmoPro-Regular",
        color: "#2F7830",
        letterSpacing: -1,
        ...greenTextShadow,
    },
    star: {
        marginLeft: 1,
        fontSize: 21,
        fontFamily: "NeoDunggeunmoPro-Regular",
        textShadowColor: "#5F644F",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 0,
    },

    closeBtn: {
        position: "absolute",
        bottom: 32,
        left: 24,
        zIndex: 100,
    },

    emptyState: {
        paddingTop: 60,
        alignItems: "center",
    },
    emptyStateText: {
        fontSize: 15,
        color: "#A7A7A7",
        fontFamily: "NeoDunggeunmoPro-Regular",
    },
});