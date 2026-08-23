import React, { useRef, useState } from "react";
import {
    ImageBackground,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Modal,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { accessorySpriteBundle } from "../data/decor";
import DecorImage from "../components/DecorImage";
import HeartsRow from "../components/HeartsRow";
import PlantImage from "../components/PlantImage";
import LiquidGlassButton from "../components/LiquidGlassButton";
import PixelOutlineText from "../components/PixelOutlineText";
import GlassMenuItem from "../components/GlassMenuItem";
import ActionButton from "../components/ActionButton";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint, Paper, Pink, Accent } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";

const MENU_ITEMS = [
    { label: "프로필", screen: "Profile" },
    { label: "식물 꾸미기", screen: "PlantDecorate" },
    { label: "돌보기 정보", screen: "CareInfo" },
    { label: "센서 데이터", screen: "SensorData" },
    { label: "분갈이", screen: "Repotting" },
    { label: "영양제", screen: "Nutrient" },
];

let heartIdCounter = 0;

export default function MemorialPlantScreen({ navigation, route, decorations }) {
    const plant = route?.params?.plant;
    // 착용 중인 액세서리 — App.js 의 맵에서 찾는다 (PlantDetailScreen 과 같은 방식)
    const accessory = decorations?.[String(plant?.id)]?.accessory ?? null;
    const decorRemote = accessory?.spriteUrl ? { uri: accessory.spriteUrl } : null;
    const decorBundle = accessorySpriteBundle(accessory?.key);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [graveModalVisible, setGraveModalVisible] = useState(false);
    const [floatingHearts, setFloatingHearts] = useState([]);

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

        Animated.stagger(
            35,
            [...menuAnimations].map((anim) =>
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 140,
                    useNativeDriver: true,
                })
            )
        ).start(() => setMenuVisible(false));
    };

    const toggleMenu = () => {
        if (menuOpen) closeMenu();
        else openMenu();
    };

    const spawnHeart = () => {
        const id = ++heartIdCounter;
        const animValue = new Animated.Value(0);
        const xOffset = (Math.random() - 0.5) * 80;
        const scale = 0.7 + Math.random() * 0.7;

        setFloatingHearts((prev) => [...prev, { id, animValue, xOffset, scale }]);

        Animated.timing(animValue, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
        }).start(() => {
            setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
        });
    };

    const handleHeartPress = () => {
        for (let i = 0; i < 5; i++) {
            setTimeout(spawnHeart, i * 90);
        }
    };

    const handleRevive = () => {
        setGraveModalVisible(false);
        navigation.navigate("PlantDetail");
    };

    return (
        <View style={styles.root}>
            <ImageBackground
                source={require("../../assets/images/detail-bg.png")}
                resizeMode="cover"
                style={styles.background}
            >
                <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
                    {/* 함께한 동안 쌓인 애정도 — 떠난 개체라 더 이상 오르지 않는다 */}
                    <View style={styles.heartsArea}>
                        <HeartsRow count={plant?.hearts ?? 0} size={25} />
                    </View>

                    <View style={styles.speechBubble}>
                        <Text style={styles.speechText}>보고 싶어...</Text>
                        <View style={styles.tailBorder} />
                        <View style={styles.tailInner} />
                    </View>

                    {/* Plant — same structure as PlantDetailScreen, no overlay */}
                    <View style={styles.mainPlantArea}>
                        {decorRemote || decorBundle ? (
                            <DecorImage
                                remote={decorRemote}
                                fallback={decorBundle}
                                style={{ width: 230, height: 230 }}
                            />
                        ) : (
                            <PlantImage uri={plant?.imageUri} imageKey={plant?.imageKey ?? "spaghetti"} width={230} height={230} />
                        )}

                        <View style={styles.plantLabelGroup}>
                            <PixelOutlineText style={styles.plantName} strokeWidth={2}>
                                스파게티
                            </PixelOutlineText>
                            <PixelOutlineText style={styles.dayText} strokeWidth={2}>
                                D+45
                            </PixelOutlineText>
                        </View>
                    </View>

                    {/* Floating hearts — centered over the plant */}
                    <View pointerEvents="none" style={styles.floatingHeartsOrigin}>
                        {floatingHearts.map((heart) => (
                            <Animated.View
                                key={heart.id}
                                style={{
                                    position: "absolute",
                                    opacity: heart.animValue.interpolate({
                                        inputRange: [0, 0.5, 1],
                                        outputRange: [1, 1, 0],
                                    }),
                                    transform: [
                                        {
                                            translateY: heart.animValue.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, -180],
                                            }),
                                        },
                                        { translateX: heart.xOffset },
                                        { scale: heart.scale },
                                    ],
                                }}
                            >
                                <Ionicons name="heart" size={36} color={Pink.rose} />
                            </Animated.View>
                        ))}
                    </View>

                    {/* Hamburger menu popup */}
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
                                        <GlassMenuItem
                                            label={item.label}
                                            onPress={() => {
                                                closeMenu();
                                                navigation.navigate(item.screen);
                                            }}
                                        />
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
                            onPress={() => navigation.navigate("ConsultationHistory", { plant })}
                        >
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={29}
                                color={GreenTint.strong}
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={54} onPress={() => setGraveModalVisible(true)}>
                            <MaterialCommunityIcons
                                name="grave-stone"
                                size={30}
                                color={Accent.mauve}
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={68} onPress={handleHeartPress}>
                            <Ionicons name="heart" size={36} color={Pink.rose} />
                        </LiquidGlassButton>
                    </View>
                </SafeAreaView>
            </ImageBackground>

            {/* Revive modal */}
            <Modal
                visible={graveModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setGraveModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setGraveModalVisible(false)}
                >
                    <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                    <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                        <View style={styles.modalBox}>

                            {/* X 닫기 버튼 */}
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setGraveModalVisible(false)}
                            >
                                <Ionicons name="close" size={20} color={Colors.textFaint} />
                            </TouchableOpacity>

                            {/* 상단 장식 아이콘 */}
                            <View style={styles.modalTopDecor}>
                                <MaterialCommunityIcons
                                    name="leaf"
                                    size={15}
                                    color={GreenTint.medium}
                                    style={{ transform: [{ rotate: "-35deg" }], marginBottom: 2 }}
                                />
                                <MaterialCommunityIcons
                                    name="butterfly"
                                    size={26}
                                    color={GreenTint.medium}
                                />
                                <MaterialCommunityIcons
                                    name="leaf"
                                    size={15}
                                    color={GreenTint.medium}
                                    style={{ transform: [{ rotate: "35deg" }], marginBottom: 2 }}
                                />
                            </View>

                            {/* 타이틀 */}
                            <Text style={styles.modalTitle}>다시 함께할까요?</Text>

                            {/* 하트 구분자 */}
                            <Ionicons name="heart" size={13} color={Pink.light} style={styles.modalHeart} />

                            {/* 설명 */}
                            <Text style={styles.modalDesc}>
                                스파게티를 추억공간에서{"\n"}다시 정원으로 옮길 수 있어요.
                            </Text>

                            {/* 버튼 영역 */}
                            <View style={styles.modalBtnRow}>
                                <ActionButton
                                    label="계속 추억하기"
                                    color={Paper.taupeBg}
                                    borderColor={Paper.taupeBorder}
                                    textColor={Paper.taupeText}
                                    size="md"
                                    shadow={false}
                                    activeOpacity={0.85}
                                    onPress={() => setGraveModalVisible(false)}
                                    style={styles.modalBtnSecondary}
                                    textStyle={styles.modalBtnLabel}
                                />

                                {/* 반짝임·하트가 섞여 라벨 하나로는 안 돼서 내용을 직접 넘긴다 */}
                                <ActionButton
                                    color={GreenTint.line}
                                    size="md"
                                    activeOpacity={0.85}
                                    onPress={handleRevive}
                                    style={styles.modalBtnPrimary}
                                >
                                    <Text style={styles.modalSparkle}>✦ </Text>
                                    <Ionicons name="heart" size={12} color={Colors.white} />
                                    <Text style={styles.modalBtnPrimaryText}> 다시 함께하기</Text>
                                    <Text style={styles.modalSparkle}> ✦</Text>
                                </ActionButton>
                            </View>

                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    modalBtnLabel: {
        fontSize: FontSizes.small,
    },
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

    mainPlantArea: {
        position: "absolute",
        top: 355,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 5,
    },
    plantLabelGroup: {
        position: "absolute",
        top: 210,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 30,
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

    // Hearts origin at the center of the plant (top: 355 + ~115 = ~470)
    floatingHeartsOrigin: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 430,
        alignItems: "center",
        zIndex: 100,
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

    // ── Modal ──────────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    modalBox: {
        width: 300,
        backgroundColor: Colors.separator,
        borderRadius: Radius.xl,
        borderWidth: 1.5,
        borderColor: Paper.taupe,
        paddingTop: Spacing.section,
        paddingBottom: Spacing.xxl,
        paddingHorizontal: Spacing.xl,
        alignItems: "center",
        shadowColor: Colors.textBlack,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 12,
    },
    modalCloseBtn: {
        position: "absolute",
        top: 12,
        right: 14,
    },
    modalTopDecor: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: Spacing.xs,
        marginBottom: Spacing.lg,
    },
    modalTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.textBlack,
        textAlign: "center",
        marginBottom: Spacing.sm,
    },
    modalHeart: {
        marginBottom: Spacing.md,
    },
    modalDesc: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textFaint,
        textAlign: "center",
        lineHeight: 21,
        marginBottom: Spacing.xxl,
    },
    modalBtnRow: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    modalBtnSecondary: {
        flex: 1,
        height: 46,
        borderRadius: Radius.pill,
        paddingVertical: Spacing.none,
    },
    modalBtnPrimary: {
        flex: 1,
        height: 46,
        borderRadius: Radius.pill,
        paddingVertical: Spacing.none,
        gap: Spacing.none,
        shadowColor: GreenTint.strong,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 4,
    },
    modalBtnPrimaryText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.white,
    },
    modalSparkle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        color: Colors.white,
    },
});