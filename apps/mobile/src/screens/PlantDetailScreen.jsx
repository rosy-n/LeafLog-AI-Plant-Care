import React, { useEffect, useRef, useState } from "react";
import {
    ImageBackground,
    Image,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import ResourceCounter from "../components/ResourceCounter";
import HeartsRow from "../components/HeartsRow";
import PlantImage from "../components/PlantImage";
import LiquidGlassButton from "../components/LiquidGlassButton";
import PixelOutlineText from "../components/PixelOutlineText";
import { getPlantCare, createCareRecord } from "../api";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint, Leaf, Accent, Glass } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";

const MENU_ITEMS = [
    { label: "프로필", screen: "Profile" },
    { label: "식물 꾸미기", screen: "PlantDecorate" },
    { label: "돌보기 정보", screen: "CareInfo" },
    { label: "센서 데이터", screen: "SensorData" },
    { label: "분갈이", screen: "Repotting" },
    { label: "영양제", screen: "Nutrient" },
];

// 등록일 기준 함께한 일수 (중앙 D+N)
function daysSince(iso) {
    if (!iso) return 0;
    const created = new Date(iso).getTime();
    if (Number.isNaN(created)) return 0;
    return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

let dropIdCounter = 0;

export default function PlantDetailScreen({ navigation, route, appliedItem }) {
    const plant = route?.params?.plant;
    const plantName = plant?.name ?? "스파게티";
    const togetherDays = daysSince(plant?.createdAt);

    // 물 준 후 지난 일수 → 좌측 상단 ResourceCounter(💧 D+N)에 표시
    const [wateringDays, setWateringDays] = useState(null);

    // 영양제 준 후 지난 일수 → 좌측 상단 ResourceCounter(✚ D+N)에 표시
    const [nutrientDays, setNutrientDays] = useState(null);

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // 물주기 애니메이션 (식물 위로 떨어지는 물방울) + 진행 중 중복 탭 방지
    const [wateringDrops, setWateringDrops] = useState([]);
    const [isWatering, setIsWatering] = useState(false);

    useEffect(() => {
        const id = plant?.id;
        if (!id) return;
        let mounted = true;
        getPlantCare(Number(id))
            .then((care) => {
                if (mounted) {
                    setWateringDays(care.days_since_watering);
                    setNutrientDays(care.days_since_fertilizing);
                }
            })
            .catch(() => {
                if (mounted) {
                    setWateringDays(null);
                    setNutrientDays(null);
                }
            });
        return () => {
            mounted = false;
        };
    }, [plant?.id]);

    const menuAnimations = useRef(
        MENU_ITEMS.map(() => new Animated.Value(0))
    ).current;

    const openMenu = () => {
        setMenuVisible(true);
        setMenuOpen(true);

        const bottomToTopAnimations = [...menuAnimations].reverse();

        Animated.stagger(
            45,
            bottomToTopAnimations.map((anim) =>
                Animated.timing(anim, {
                    toValue: 1,
                    duration: 180,
                    useNativeDriver: true,
                })
            )
        ).start();
    };

    const closeMenu = () => {
        setMenuOpen(false);

        const topToBottomAnimations = [...menuAnimations];

        Animated.stagger(
            35,
            topToBottomAnimations.map((anim) =>
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 140,
                    useNativeDriver: true,
                })
            )
        ).start(() => {
            setMenuVisible(false);
        });
    };

    const toggleMenu = () => {
        if (menuOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    };

    // 물방울 하나를 생성해 아래로 떨어지며 사라지는 애니메이션 실행
    const spawnDrop = () => {
        const id = ++dropIdCounter;
        const animValue = new Animated.Value(0);
        const xOffset = (Math.random() - 0.5) * 130;
        const scale = 0.7 + Math.random() * 0.6;

        setWateringDrops((prev) => [...prev, { id, animValue, xOffset, scale }]);

        Animated.timing(animValue, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
        }).start(() => {
            setWateringDrops((prev) => prev.filter((d) => d.id !== id));
        });
    };

    // 물주기 버튼: 물방울 애니메이션 + WATERING 관리 기록 저장 → 💧 D+N 갱신
    const handleWaterPress = async () => {
        if (isWatering) return;
        setIsWatering(true);

        for (let i = 0; i < 8; i++) {
            setTimeout(spawnDrop, i * 110);
        }

        const id = plant?.id;
        if (id) {
            try {
                await createCareRecord(Number(id), { care_type: "WATERING" });
                const care = await getPlantCare(Number(id));
                setWateringDays(care.days_since_watering);
                setNutrientDays(care.days_since_fertilizing);
            } catch (e) {
                console.warn("물주기 기록 실패:", e?.message);
            }
        }

        setTimeout(() => setIsWatering(false), 1200);
    };

    return (
        <View style={styles.root}>
            <ImageBackground
                source={require("../../assets/images/detail-bg.png")}
                resizeMode="cover"
                style={styles.background}
            >
                <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
                    <View style={styles.resourceArea}>
                        <ResourceCounter wateringDays={wateringDays} nutrientDays={nutrientDays} />
                    </View>

                    <View style={styles.heartsArea}>
                        <HeartsRow count={5} size={25} />
                    </View>

                    <View style={styles.speechBubble}>
                        <Text style={styles.speechText}>안녕! 좋은 아침이야</Text>
                        <View style={styles.tailBorder} />
                        <View style={styles.tailInner} />
                    </View>

                    <View style={styles.mainPlantArea}>
                        {appliedItem ? (
                            <Image
                                source={appliedItem.plantImage}
                                style={{ width: 230, height: 230 }}
                                resizeMode="contain"
                            />
                        ) : (
                            <PlantImage uri={plant?.imageUri} imageKey={plant?.imageKey ?? "spaghetti"} width={230} height={230} />
                        )}

                        <View style={styles.plantLabelGroup}>
                            <PixelOutlineText style={styles.plantName} strokeWidth={2}>
                                {plantName}
                            </PixelOutlineText>

                            <PixelOutlineText style={styles.dayText} strokeWidth={2}>
                                D+{togetherDays}
                            </PixelOutlineText>
                        </View>
                    </View>

                    {/* 물주기 물방울 애니메이션 — 식물 위로 떨어짐 */}
                    <View pointerEvents="none" style={styles.wateringDropsOrigin}>
                        {wateringDrops.map((drop) => (
                            <Animated.View
                                key={drop.id}
                                style={{
                                    position: "absolute",
                                    opacity: drop.animValue.interpolate({
                                        inputRange: [0, 0.7, 1],
                                        outputRange: [0.9, 0.9, 0],
                                    }),
                                    transform: [
                                        {
                                            translateY: drop.animValue.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, 150],
                                            }),
                                        },
                                        { translateX: drop.xOffset },
                                        { scale: drop.scale },
                                    ],
                                }}
                            >
                                <Text style={styles.dropEmoji}>💧</Text>
                            </Animated.View>
                        ))}
                    </View>

                    {menuVisible && (
                        <View style={styles.menuPopup}>
                            {MENU_ITEMS.map((item, index) => {
                                const anim = menuAnimations[index];

                                return (
                                    <Animated.View
                                        key={item.label}
                                        style={[
                                            styles.menuItemWrapper,
                                            {
                                                opacity: anim,
                                                transform: [
                                                    {
                                                        translateY: anim.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [14, 0],
                                                        }),
                                                    },
                                                    {
                                                        scale: anim.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [0.92, 1],
                                                        }),
                                                    },
                                                ],
                                            },
                                        ]}
                                    >
                                        <TouchableOpacity
                                            activeOpacity={0.82}
                                            style={styles.menuItemTouch}
                                            onPress={() => {
                                                closeMenu();
                                                navigation.navigate(item.screen, { plant });
                                            }}
                                        >
                                            <BlurView intensity={28} tint="light" style={styles.menuItemBlur}>
                                                <LinearGradient
                                                    colors={[
                                                        Glass.frost72,
                                                        Glass.mist,
                                                        Glass.mistSoft,
                                                    ]}
                                                    start={{ x: 0.12, y: 0.05 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={styles.menuItemGlass}
                                                >
                                                    <View style={styles.menuItemHighlight} />
                                                    <Text style={styles.menuItemText}>{item.label}</Text>
                                                </LinearGradient>
                                            </BlurView>
                                        </TouchableOpacity>
                                    </Animated.View>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.leftButtons}>
                        <LiquidGlassButton size={54} onPress={toggleMenu}>
                            <Ionicons
                                name={menuOpen ? "close" : "menu"}
                                size={30}
                                color={GreenTint.deep}
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton
                            size={54}
                            onPress={() => navigation.navigate("Home")}
                        >
                            <Ionicons name="home-outline" size={30} color={GreenTint.deep} />
                        </LiquidGlassButton>
                    </View>

                    <View style={styles.rightButtons}>
                        <LiquidGlassButton
                            size={54}
                            onPress={() => navigation.navigate("ConsultationHistory")}
                        >
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={29}
                                color={GreenTint.strong}
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={54}>
                            <Ionicons name="bulb-outline" size={30} color={Leaf.olive} />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={68} onPress={handleWaterPress}>
                            <MaterialCommunityIcons
                                name="watering-can-outline"
                                size={40}
                                color={Accent.brownDeep}
                            />
                        </LiquidGlassButton>
                    </View>
                </SafeAreaView>
            </ImageBackground>
        </View>
    );
}

const pixelShadow = {
    textShadowColor: Colors.textBlack,
    textShadowOffset: { width: 2.5, height: 2.5 },
    textShadowRadius: 0,
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: GreenTint.line,
    },
    background: {
        flex: 1,
    },
    safe: {
        flex: 1,
    },

    resourceArea: {
        position: "absolute",
        top: 80,
        left: 28,
        zIndex: 10,
    },
    heartsArea: {
        position: "absolute",
        top: 80,
        right: 24,
        zIndex: 10,
    },

    speechBubble: {
        position: "absolute",
        top: 265,
        right: 42,
        width: 250,
        height: 70,
        backgroundColor: Colors.white,
        borderWidth: 4,
        borderColor: Colors.textBlack,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
    },
    speechText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.textBlack,
    },
    tailBorder: {
        position: "absolute",
        bottom: -22,
        left: 58,
        width: 31,
        height: 31,
        backgroundColor: Colors.textBlack,
        transform: [{ rotate: "45deg" }],
    },
    tailInner: {
        position: "absolute",
        bottom: -14,
        left: 64,
        width: 20,
        height: 20,
        backgroundColor: Colors.white,
        transform: [{ rotate: "45deg" }],
    },

    plantLabelGroup: {
        position: "absolute",

        // 원하는 높이만 조정
        top: 210,

        // 화면 전체 기준 가로 중앙
        left: 0,
        right: 0,

        alignItems: "center",
        zIndex: 30,
    },
    mainPlantArea: {
        position: "absolute",
        top: 355,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 5,
    },

    // 물주기 물방울 시작점 (식물 상단 부근, 아래로 낙하)
    wateringDropsOrigin: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 360,
        alignItems: "center",
        zIndex: 40,
    },
    dropEmoji: {
        fontSize: FontSizes.display,
    },
    plantName: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.screenTitle,
        color: Colors.white,
        letterSpacing: 1,
        lineHeight: 50,
    },

    dayText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.white,
        letterSpacing: 1,
        lineHeight: 32,
    },

    smallDayText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.white,
        letterSpacing: 0.5,
        lineHeight: 24,
    },
    affinityText: {
        marginTop: Spacing.xxs,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.white,
        ...pixelShadow,
    },

    leftButtons: {
        position: "absolute",
        left: 20,
        bottom: 60,
        gap: Spacing.xl,
        zIndex: 30,
    },
    rightButtons: {
        position: "absolute",
        right: 20,
        bottom: 50,
        alignItems: "center",
        gap: Spacing.lg,
        zIndex: 30,
    },

    // 개체별탭 햄버거 버튼 디자인
    menuPopup: {
        position: "absolute",
        left: 20,
        bottom: 190,
        zIndex: 80,
        alignItems: "flex-start",
    },

    menuItemWrapper: {
        marginBottom: Spacing.sm,
    },

    menuItemTouch: {
        width: 116,
        height: 31,
        borderRadius: Radius.lg,
        overflow: "hidden",

        shadowColor: Colors.textBlack,
        shadowOpacity: 0.18,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },

    menuItemBlur: {
        flex: 1,
        borderRadius: Radius.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Glass.frost72,
    },

    menuItemGlass: {
        flex: 1,
        borderRadius: Radius.lg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: Glass.frost45,
    },

    menuItemHighlight: {
        position: "absolute",
        top: 4,
        left: 10,
        width: 34,
        height: 8,
        borderRadius: Radius.pill,
        backgroundColor: Glass.frost60,
    },

    menuItemText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        textShadowColor: Glass.frost60,
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 0,
    },
});