import React, { useRef, useState } from "react";
import {
    ImageBackground,
    Image,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Modal,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import HeartsRow from "../components/HeartsRow";
import PlantImage from "../components/PlantImage";
import LiquidGlassButton from "../components/LiquidGlassButton";
import PixelOutlineText from "../components/PixelOutlineText";

const MENU_ITEMS = [
    { label: "프로필", screen: "Profile" },
    { label: "식물 꾸미기", screen: "PlantDecorate" },
    { label: "돌보기 정보", screen: "CareInfo" },
    { label: "센서 데이터", screen: "SensorData" },
    { label: "분갈이", screen: "Repotting" },
    { label: "영양제", screen: "Nutrient" },
];

let heartIdCounter = 0;

export default function MemorialPlantScreen({ navigation, appliedItem }) {
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
                    <View style={styles.heartsArea}>
                        <HeartsRow count={5} size={25} />
                    </View>

                    <View style={styles.speechBubble}>
                        <Text style={styles.speechText}>보고 싶어...</Text>
                        <View style={styles.tailBorder} />
                        <View style={styles.tailInner} />
                    </View>

                    {/* Plant — same structure as PlantDetailScreen, no overlay */}
                    <View style={styles.mainPlantArea}>
                        {appliedItem ? (
                            <Image
                                source={appliedItem.plantImage}
                                style={{ width: 230, height: 230 }}
                                resizeMode="contain"
                            />
                        ) : (
                            <PlantImage imageKey="spaghetti" width={230} height={230} />
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
                                <Ionicons name="heart" size={36} color="#FF6B8A" />
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
                                        <TouchableOpacity
                                            activeOpacity={0.82}
                                            style={styles.menuItemTouch}
                                            onPress={() => {
                                                closeMenu();
                                                navigation.navigate(item.screen);
                                            }}
                                        >
                                            <BlurView intensity={28} tint="light" style={styles.menuItemBlur}>
                                                <LinearGradient
                                                    colors={[
                                                        "rgba(255,255,255,0.72)",
                                                        "rgba(235,248,228,0.52)",
                                                        "rgba(211,235,201,0.38)",
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
                                color="#3D4B34"
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton
                            size={54}
                            onPress={() => navigation.navigate("Home")}
                        >
                            <Ionicons name="home-outline" size={30} color="#315E35" />
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
                                color="#3D7842"
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={54} onPress={() => setGraveModalVisible(true)}>
                            <MaterialCommunityIcons
                                name="grave-stone"
                                size={30}
                                color="#7B6A8A"
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={68} onPress={handleHeartPress}>
                            <Ionicons name="heart" size={36} color="#FF6B8A" />
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
                                <Ionicons name="close" size={20} color="#BBBBBB" />
                            </TouchableOpacity>

                            {/* 상단 장식 아이콘 */}
                            <View style={styles.modalTopDecor}>
                                <MaterialCommunityIcons
                                    name="leaf"
                                    size={15}
                                    color="#6BBF6A"
                                    style={{ transform: [{ rotate: "-35deg" }], marginBottom: 2 }}
                                />
                                <MaterialCommunityIcons
                                    name="butterfly"
                                    size={26}
                                    color="#6BBF6A"
                                />
                                <MaterialCommunityIcons
                                    name="leaf"
                                    size={15}
                                    color="#6BBF6A"
                                    style={{ transform: [{ rotate: "35deg" }], marginBottom: 2 }}
                                />
                            </View>

                            {/* 타이틀 */}
                            <Text style={styles.modalTitle}>다시 함께할까요?</Text>

                            {/* 하트 구분자 */}
                            <Ionicons name="heart" size={13} color="#FFAAC2" style={styles.modalHeart} />

                            {/* 설명 */}
                            <Text style={styles.modalDesc}>
                                스파게티를 추억공간에서{"\n"}다시 정원으로 옮길 수 있어요.
                            </Text>

                            {/* 버튼 영역 */}
                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity
                                    style={styles.modalBtnSecondary}
                                    activeOpacity={0.85}
                                    onPress={() => setGraveModalVisible(false)}
                                >
                                    <Text style={styles.modalBtnSecondaryText}>계속 추억하기</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.modalBtnPrimary}
                                    activeOpacity={0.85}
                                    onPress={handleRevive}
                                >
                                    <Text style={styles.modalSparkle}>✦ </Text>
                                    <Ionicons name="heart" size={12} color="#FFFFFF" />
                                    <Text style={styles.modalBtnPrimaryText}> 다시 함께하기</Text>
                                    <Text style={styles.modalSparkle}> ✦</Text>
                                </TouchableOpacity>
                            </View>

                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#91C881",
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
        backgroundColor: "#FFFFFF",
        borderWidth: 4,
        borderColor: "#121212",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
    },
    speechText: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 19,
        color: "#1D1D1D",
    },
    tailBorder: {
        position: "absolute",
        bottom: -22,
        left: 58,
        width: 31,
        height: 31,
        backgroundColor: "#121212",
        transform: [{ rotate: "45deg" }],
    },
    tailInner: {
        position: "absolute",
        bottom: -14,
        left: 64,
        width: 20,
        height: 20,
        backgroundColor: "#FFFFFF",
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
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 30,
        color: "#FFFFFF",
        letterSpacing: 1,
        lineHeight: 50,
    },
    dayText: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 20,
        color: "#FFFFFF",
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
        gap: 18,
        zIndex: 30,
    },
    rightButtons: {
        position: "absolute",
        right: 20,
        bottom: 50,
        alignItems: "center",
        gap: 14,
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
        marginBottom: 8,
    },
    menuItemTouch: {
        width: 116,
        height: 31,
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#2D3B2C",
        shadowOpacity: 0.18,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    menuItemBlur: {
        flex: 1,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.72)",
    },
    menuItemGlass: {
        flex: 1,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.46)",
    },
    menuItemHighlight: {
        position: "absolute",
        top: 4,
        left: 10,
        width: 34,
        height: 8,
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.62)",
    },
    menuItemText: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 13,
        color: "#263326",
        textShadowColor: "rgba(255,255,255,0.65)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 0,
    },

    // ── Modal ──────────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    modalBox: {
        width: 300,
        backgroundColor: "#FAF5E8",
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: "#D8CCAA",
        paddingTop: 28,
        paddingBottom: 22,
        paddingHorizontal: 20,
        alignItems: "center",
        shadowColor: "#000000",
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
        gap: 3,
        marginBottom: 14,
    },
    modalTitle: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 21,
        color: "#2A2A2A",
        textAlign: "center",
        marginBottom: 8,
    },
    modalHeart: {
        marginBottom: 12,
    },
    modalDesc: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 13,
        color: "#999999",
        textAlign: "center",
        lineHeight: 21,
        marginBottom: 22,
    },
    modalBtnRow: {
        flexDirection: "row",
        gap: 10,
        width: "100%",
    },
    modalBtnSecondary: {
        flex: 1,
        height: 46,
        borderRadius: 23,
        borderWidth: 1.5,
        borderColor: "#C9B890",
        backgroundColor: "#EDE5CC",
        alignItems: "center",
        justifyContent: "center",
    },
    modalBtnSecondaryText: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 12,
        color: "#7A6E54",
    },
    modalBtnPrimary: {
        flex: 1,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#76C973",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#3A8C38",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 4,
    },
    modalBtnPrimaryText: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 12,
        color: "#FFFFFF",
    },
    modalSparkle: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 10,
        color: "#FFFFFF",
    },
});