import React, { useRef, useState } from "react";
import {
    ImageBackground,
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

const MENU_ITEMS = [
    "프로필",
    "식물 꾸미기",
    "돌보기 정보",
    "센서 데이터",
    "분갈이",
    "영양제",
];

export default function PlantDetailScreen({ navigation }) {
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

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

    return (
        <View style={styles.root}>
            <ImageBackground
                source={require("../../assets/images/detail-bg.png")}
                resizeMode="cover"
                style={styles.background}
            >
                <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
                    <View style={styles.resourceArea}>
                        <ResourceCounter />
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
                        <PlantImage imageKey="spaghetti" width={230} height={230} />

                        <View style={styles.plantLabelGroup}>
                            <PixelOutlineText style={styles.plantName} strokeWidth={2}>
                                스파게티
                            </PixelOutlineText>

                            <PixelOutlineText style={styles.dayText} strokeWidth={2}>
                                D+45
                            </PixelOutlineText>
                        </View>
                    </View>

                    {menuVisible && (
                        <View style={styles.menuPopup}>
                            {MENU_ITEMS.map((label, index) => {
                                const anim = menuAnimations[index];

                                return (
                                    <Animated.View
                                        key={label}
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

                                                if (label === "프로필") {
                                                    navigation.navigate("Profile");
                                                }
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
                                                    <Text style={styles.menuItemText}>{label}</Text>
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
                        <LiquidGlassButton size={54}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={29}
                                color="#3D7842"
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={54}>
                            <Ionicons name="bulb-outline" size={30} color="#5C6131" />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={68}>
                            <MaterialCommunityIcons
                                name="watering-can-outline"
                                size={40}
                                color="#8A4E24"
                            />
                        </LiquidGlassButton>
                    </View>
                </SafeAreaView>
            </ImageBackground>
        </View>
    );
}

const pixelShadow = {
    textShadowColor: "#171717",
    textShadowOffset: { width: 2.5, height: 2.5 },
    textShadowRadius: 0,
};

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
        backgroundColor: "#FFFFFF",
        borderWidth: 4,
        borderColor: "#121212",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
    },
    speechText: {
        fontFamily: "NeoDunggeunmo",
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

    smallDayText: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 18,
        color: "#FFFFFF",
        letterSpacing: 0.5,
        lineHeight: 24,
    },
    affinityText: {
        marginTop: 2,
        fontFamily: "NeoDunggeunmo",
        fontSize: 20,
        color: "#FFFFFF",
        ...pixelShadow,
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

    // 개체별탭 햄버거 버튼 디자인
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
        fontFamily: "NeoDunggeunmo",
        fontSize: 13,
        color: "#263326",
        textShadowColor: "rgba(255,255,255,0.65)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 0,
    },
});