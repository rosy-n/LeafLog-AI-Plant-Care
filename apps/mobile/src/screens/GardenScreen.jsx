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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import PlantImage from "../components/PlantImage";
import HeartsRow from "../components/HeartsRow";
import LiquidGlassButton from "../components/LiquidGlassButton";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SKY_HEIGHT = 126;
const CLOSE_THRESHOLD = 120;

export default function GardenScreen({ navigation, plants, setPlants }) {
    /*
      처음에는 정원창을 화면 아래에 숨겨두고,
      화면 진입 후 아래에서 위로 올라오게 합니다.
    */
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const skyOpacity = translateY.interpolate({
        inputRange: [0, SCREEN_HEIGHT * 0.45],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const sortFavoriteFirst = useCallback((plantList) => {
        return [...plantList].sort((a, b) => {
            if (a.favorite === b.favorite) {
                return Number(a.id) - Number(b.id);
            }

            return a.favorite ? -1 : 1;
        });
    }, []);

    const [displayPlants, setDisplayPlants] = useState(() =>
        sortFavoriteFirst(plants)
    );

    const plantsRef = useRef(plants);
    const isFirstFocusRef = useRef(true);

    useEffect(() => {
        plantsRef.current = plants;
    }, [plants]);

    /*
      정원 화면 진입 애니메이션.
      native navigation animation은 끄고, 직접 아래에서 위로 올립니다.
    */
    useEffect(() => {
        Animated.timing(translateY, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
        }).start();
    }, [translateY]);

    /*
      정원탭을 나갔다 다시 들어왔을 때만 즐겨찾기 정렬 반영.
      별을 누르는 순간에는 순서가 바로 바뀌지 않습니다.
    */
    useFocusEffect(
        useCallback(() => {
            if (isFirstFocusRef.current) {
                isFirstFocusRef.current = false;
                return;
            }

            setDisplayPlants(sortFavoriteFirst(plantsRef.current));
        }, [sortFavoriteFirst])
    );

    const closeGarden = () => {
        Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 230,
            useNativeDriver: true,
        }).start(() => {
            navigation.goBack();
        });
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
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return (
                    gestureState.dy > 8 &&
                    Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
                );
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > CLOSE_THRESHOLD || gestureState.vy > 1.1) {
                    closeGarden();
                } else {
                    resetGardenPosition();
                }
            },
            onPanResponderTerminate: () => {
                resetGardenPosition();
            },
        })
    ).current;

    const toggleFavorite = (plantId) => {
        const nextPlants = plantsRef.current.map((plant) =>
            plant.id === plantId
                ? { ...plant, favorite: !plant.favorite }
                : plant
        );

        plantsRef.current = nextPlants;
        setPlants(nextPlants);

        setDisplayPlants((prevDisplayPlants) =>
            prevDisplayPlants.map((plant) =>
                plant.id === plantId
                    ? { ...plant, favorite: !plant.favorite }
                    : plant
            )
        );
    };

    return (
        <View style={styles.modalRoot} pointerEvents="box-none">
            <Animated.View style={[styles.sky, { opacity: skyOpacity }]}>
                <View style={styles.skyShade} />
                <View style={styles.cloud1} />
                <View style={styles.cloud2} />
            </Animated.View>

            {/* 슬라이드되는 정원창: 흰색 패널만 아래로 내려갑니다. */}
            <Animated.View
                style={[
                    styles.sheet,
                    {
                        transform: [{ translateY }],
                    },
                ]}
            >
                <View style={styles.dragZone} {...panResponder.panHandlers}>
                    <View style={styles.dragHandle} />

                    <View style={styles.header}>
                        <Text style={styles.title}>정원 11/50</Text>

                        <View style={styles.headerRight}>
                            <Text style={styles.favoriteText}>즐겨찾기▼</Text>

                            <LiquidGlassButton size={46}>
                                <Ionicons name="search" size={25} color="#2F6D2E" />
                            </LiquidGlassButton>
                        </View>
                    </View>
                </View>

                <FlatList
                    data={displayPlants}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => {
                                    if (item.id === "1") {
                                        navigation.replace("PlantDetail");
                                    }
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
                                    <Text
                                        style={[
                                            styles.star,
                                            {
                                                color: item.favorite ? "#E2C23A" : "#A7A7A7",
                                            },
                                        ]}
                                    >
                                        ★
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <HeartsRow count={item.hearts} size={17} />
                        </View>
                    )}
                />
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

    /*
      고정 하늘 배경.
      정원창을 아래로 내려도 이 영역은 움직이지 않습니다.
    */
    sky: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: SKY_HEIGHT,
        backgroundColor: "#80B1D2",
        overflow: "hidden",
    },
    skyShade: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 25,
        backgroundColor: "rgba(65,113,146,0.34)",
    },
    cloud1: {
        position: "absolute",
        top: 32,
        right: 34,
        width: 92,
        height: 10,
        backgroundColor: "rgba(255,255,255,0.14)",
    },
    cloud2: {
        position: "absolute",
        top: 51,
        right: 122,
        width: 122,
        height: 8,
        backgroundColor: "rgba(255,255,255,0.12)",
    },

    /*
      실제로 움직이는 흰색 정원창.
      top을 SKY_HEIGHT로 두었기 때문에 하늘색 부분 아래에서 시작합니다.
    */
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
        fontSize: 25,
        fontWeight: "900",
        color: "#2F702D",
        letterSpacing: 0.3,
        ...greenTextShadow,
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    favoriteText: {
        marginRight: 18,
        fontSize: 16,
        fontWeight: "900",
        color: "#2F702D",
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
        fontWeight: "900",
        color: "#2F7830",
        letterSpacing: -1,
        ...greenTextShadow,
    },
    star: {
        marginLeft: 1,
        fontSize: 21,
        textShadowColor: "#5F644F",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 0,
    },
});