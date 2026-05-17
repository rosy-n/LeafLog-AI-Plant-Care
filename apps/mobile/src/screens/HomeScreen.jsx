import React, { useRef, useState } from "react";
import {
    ImageBackground,
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

const BG_IMAGES = {
    "home-bg": require("../../assets/images/home-bg.png"),
    "store_bg1": require("../../assets/images/store_bg1.png"),
    "store_bg2": require("../../assets/images/store_bg2.png"),
};

const HOME_MENU_ITEMS = [
    { label: "설정", icon: "settings-outline", screen: "Settings" },
    { label: "스토어", icon: "storefront-outline", screen: "Store" },
];

export default function HomeScreen({ navigation, appliedBg = "home-bg", hasUnread = false }) {
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const menuAnimations = useRef(
        HOME_MENU_ITEMS.map(() => new Animated.Value(0))
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

    return (
        <View style={styles.root}>
            <ImageBackground
                source={BG_IMAGES[appliedBg] ?? BG_IMAGES["home-bg"]}
                resizeMode="cover"
                style={styles.background}
            >
                {/* 상단 왼쪽: 날씨, 미세먼지 */}
                <View style={styles.topLeftArea}>
                    <GlassButton size={60}>
                        <WeatherIcon />
                    </GlassButton>

                    <GlassButton size={60}>
                        <AirIcon />
                    </GlassButton>
                </View>

                {/* 상단 오른쪽: 알림 */}
                <View style={styles.notificationArea}>
                    <GlassButton
                        size={65}
                        onPress={() => navigation.navigate("Notifications")}
                    >
                        <View>
                            <Ionicons name="notifications" size={44} color="#F4B63F" />
                            {hasUnread && <View style={styles.redDot} />}
                        </View>
                    </GlassButton>
                </View>

                {/* 식물 5개 */}
                <Image
                    source={require("../../assets/plants/rubber.png")}
                    style={styles.rubberPlant}
                    resizeMode="contain"
                />

                <Image
                    source={require("../../assets/plants/sansevieria.png")}
                    style={styles.sansevieriaPlant}
                    resizeMode="contain"
                />

                <Image
                    source={require("../../assets/plants/spaghetti.png")}
                    style={styles.spaghettiPlant}
                    resizeMode="contain"
                />

                <Image
                    source={require("../../assets/plants/pachira.png")}
                    style={styles.pachiraPlant}
                    resizeMode="contain"
                />

                <Image
                    source={require("../../assets/plants/myeongrani.png")}
                    style={styles.myeongraniPlant}
                    resizeMode="contain"
                />

                {/* 햄버거 메뉴 팝업 */}
                {menuVisible && (
                    <>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={closeMenu}
                        />
                        <View style={styles.menuPopup}>
                            {HOME_MENU_ITEMS.map((item, index) => {
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
                                                if (item.screen) navigation.navigate(item.screen);
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
                                                    <Ionicons
                                                        name={item.icon}
                                                        size={14}
                                                        color="#263326"
                                                        style={styles.menuItemIcon}
                                                    />
                                                    <Text style={styles.menuItemText}>{item.label}</Text>
                                                </LinearGradient>
                                            </BlurView>
                                        </TouchableOpacity>
                                    </Animated.View>
                                );
                            })}
                        </View>
                    </>
                )}

                {/* 좌측 하단: 햄버거 */}
                <View style={styles.menuArea}>
                    <GlassButton size={60} onPress={toggleMenu}>
                        <Ionicons
                            name={menuOpen ? "close" : "menu"}
                            size={36}
                            color="#344537"
                        />
                    </GlassButton>
                </View>

                {/* 우측 하단: 캘린더, 메모, 전체개체 */}
                <View style={styles.rightButtonArea}>
                    <GlassButton size={60}>
                        <Ionicons name="calendar" size={36} color="#23A7D3" />
                    </GlassButton>

                    <GlassButton size={60}>
                        <Ionicons name="create-outline" size={35} color="#85A5B1" />
                    </GlassButton>

                    <GlassButton
                        size={70}
                        onPress={() => navigation.navigate("Garden")}
                    >
                        <Text style={styles.allText}>all</Text>
                    </GlassButton>
                </View>
            </ImageBackground>
        </View>
    );
}

function GlassButton({ children, size = 62, onPress }) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[
                styles.glassTouch,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
            ]}
        >
            <BlurView
                intensity={32}
                tint="light"
                style={[
                    styles.glassBlur,
                    {
                        borderRadius: size / 2,
                    },
                ]}
            >
                <LinearGradient
                    colors={[
                        "rgba(255,255,255,0.72)",
                        "rgba(231,247,221,0.48)",
                        "rgba(205,232,196,0.34)",
                    ]}
                    start={{ x: 0.15, y: 0.05 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.glassGradient,
                        {
                            borderRadius: size / 2,
                        },
                    ]}
                >
                    <View style={styles.glassHighlight} />
                    {children}
                </LinearGradient>
            </BlurView>
        </TouchableOpacity>
    );
}

function WeatherIcon() {
    return (
        <View style={styles.weatherWrap}>
            <Ionicons name="cloud" size={43} color="#FFFFFF" />
            <View style={styles.wind1} />
            <View style={styles.wind2} />
            <View style={styles.wind3} />
        </View>
    );
}

function AirIcon() {
    return (
        <View style={styles.airCircle}>
            <View style={styles.airEyeLeft} />
            <View style={styles.airEyeRight} />
            <View style={styles.airMouth} />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#8BCB7B",
    },
    background: {
        flex: 1,
    },

    topLeftArea: {
        position: "absolute",
        top: 72,
        left: 20,
        flexDirection: "row",
        gap: 16,
        zIndex: 50,
    },
    notificationArea: {
        position: "absolute",
        top: 72,
        right: 20,
        zIndex: 50,
    },
    redDot: {
        position: "absolute",
        top: -5,
        right: -5,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "#FF3939",
    },

    rubberPlant: {
        position: "absolute",
        width: 150,
        height: 150,
        left: "9%",
        top: "39%",
        zIndex: 20,
    },
    sansevieriaPlant: {
        position: "absolute",
        width: 145,
        height: 165,
        left: "39%",
        top: "36%",
        zIndex: 20,
    },
    spaghettiPlant: {
        position: "absolute",
        width: 160,
        height: 160,
        right: "7%",
        top: "39%",
        zIndex: 20,
    },
    pachiraPlant: {
        position: "absolute",
        width: 175,
        height: 175,
        left: "19%",
        top: "63%",
        zIndex: 20,
    },
    myeongraniPlant: {
        position: "absolute",
        width: 180,
        height: 180,
        right: "20%",
        top: "61%",
        zIndex: 20,
    },

    menuArea: {
        position: "absolute",
        left: 20,
        bottom: 54,
        zIndex: 50,
    },
    rightButtonArea: {
        position: "absolute",
        right: 20,
        bottom: 46,
        alignItems: "center",
        gap: 16,
        zIndex: 50,
    },

    // 햄버거 메뉴 팝업
    menuPopup: {
        position: "absolute",
        left: 20,
        bottom: 130,
        zIndex: 80,
        alignItems: "flex-start",
    },
    menuItemWrapper: {
        marginBottom: 8,
    },
    menuItemTouch: {
        width: 126,
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
        flexDirection: "row",
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
    menuItemIcon: {
        marginRight: 5,
    },
    menuItemText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 13,
        color: "#263326",
        textShadowColor: "rgba(255,255,255,0.65)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 0,
    },

    glassTouch: {
        overflow: "hidden",
        shadowColor: "#335235",
        shadowOpacity: 0.2,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    glassBlur: {
        flex: 1,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.72)",
    },
    glassGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.4)",
    },
    glassHighlight: {
        position: "absolute",
        top: 9,
        left: 12,
        width: "38%",
        height: "20%",
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.58)",
    },

    weatherWrap: {
        width: 56,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
    },
    wind1: {
        position: "absolute",
        left: 9,
        bottom: 16,
        width: 34,
        height: 4,
        borderRadius: 4,
        backgroundColor: "#0FAEE5",
    },
    wind2: {
        position: "absolute",
        left: 17,
        bottom: 24,
        width: 28,
        height: 4,
        borderRadius: 4,
        backgroundColor: "#0FAEE5",
    },
    wind3: {
        position: "absolute",
        left: 25,
        bottom: 32,
        width: 18,
        height: 4,
        borderRadius: 4,
        backgroundColor: "#0FAEE5",
    },

    airCircle: {
        width: 43,
        height: 43,
        borderRadius: 22,
        borderWidth: 5,
        borderColor: "#42D620",
        alignItems: "center",
        justifyContent: "center",
    },
    airEyeLeft: {
        position: "absolute",
        top: 12,
        left: 11,
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: "#42D620",
    },
    airEyeRight: {
        position: "absolute",
        top: 12,
        right: 11,
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: "#42D620",
    },
    airMouth: {
        position: "absolute",
        bottom: 10,
        width: 18,
        height: 9,
        borderBottomWidth: 4,
        borderColor: "#42D620",
        borderRadius: 12,
    },

    allText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 28,
        color: "#315B3B",
        textTransform: "lowercase",
    },
});
