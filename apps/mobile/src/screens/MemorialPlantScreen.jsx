import React, { useRef, useState } from "react";
import {
    Alert,
    ImageBackground,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Modal,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { updatePlant } from "../api";
import { accessorySpriteBundle } from "../data/decor";
import HeartsRow from "../components/HeartsRow";
import PlantImage from "../components/PlantImage";
import { getPlantExpressionSource } from "../data/characterExpressions";
import LiquidGlassButton from "../components/LiquidGlassButton";
import PixelOutlineText from "../components/PixelOutlineText";
import PixelButton from "../components/PixelButton";
import PixelSpeechBubble from "../components/PixelSpeechBubble";
import GlassMenuItem from "../components/GlassMenuItem";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint, Paper, Pink, Accent } from "../../constants/colors";
import { Spacing } from "../../constants/spacing";

const MENU_ITEMS = [
    { label: "프로필", screen: "Profile" },
    { label: "식물 꾸미기", screen: "PlantDecorate" },
    { label: "돌보기 정보", screen: "CareInfo" },
    { label: "센서 데이터", screen: "SensorData" },
    { label: "분갈이", screen: "Repotting" },
    { label: "영양제", screen: "Nutrient" },
];

// 등록일 기준 함께한 일수 (중앙 D+N) — PlantDetailScreen 과 같은 계산
function daysSince(iso) {
    if (!iso) return 0;
    const created = new Date(iso).getTime();
    if (Number.isNaN(created)) return 0;
    return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

let heartIdCounter = 0;

export default function MemorialPlantScreen({ navigation, route, decorations, reloadPlants }) {
    const plant = route?.params?.plant;
    // 착용 중인 액세서리 — App.js 의 맵에서 찾는다 (PlantDetailScreen 과 같은 방식)
    const accessory = decorations?.[String(plant?.id)]?.accessory ?? null;
    const decorRemote = accessory?.spriteUrl ? { uri: accessory.spriteUrl } : null;
    const decorBundle = accessorySpriteBundle(accessory?.key);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [graveModalVisible, setGraveModalVisible] = useState(false);
    const [floatingHearts, setFloatingHearts] = useState([]);

    const plantName = plant?.name ?? "-";
    const togetherDays = daysSince(plant?.createdAt);

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

    /*
        다시 함께하기 — 상태를 ALIVE 로 되돌려 정원의 일반 정렬에 다시 나오게 하고
        살아있는 개체의 개체탭으로 옮긴다. 상태를 바꾸지 않고 화면만 옮기면
        정원에서는 여전히 추모정원에만 남는다.
    */
    const handleRevive = async () => {
        const id = plant?.id;
        try {
            if (id) await updatePlant(Number(id), { status: "ALIVE" });
            reloadPlants?.();
            setGraveModalVisible(false);
            navigation.replace("PlantDetail", {
                plant: { ...plant, status: "ALIVE", memorial: false },
            });
        } catch (e) {
            Alert.alert("이동 실패", e?.message ?? "다시 시도해주세요.");
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
                    {/* 함께한 동안 쌓인 애정도 — 떠난 개체라 더 이상 오르지 않는다 */}
                    <View style={styles.heartsArea}>
                        <HeartsRow count={plant?.hearts ?? 0} size={25} />
                    </View>

                    {/* 살아있는 개체탭과 같은 도트 말풍선 (PixelSpeechBubble) */}
                    <PixelSpeechBubble
                        style={styles.speechBubble}
                        textStyle={styles.speechText}
                        contentStyle={styles.speechContent}
                        tailOffset={125}
                        wrapWords
                    >
                        보고 싶어...
                    </PixelSpeechBubble>

                    {/* Plant — same structure as PlantDetailScreen, no overlay */}
                    <View style={styles.mainPlantArea}>
                        <PlantImage
                            uri={plant?.imageUri}
                            imageKey={plant?.imageKey ?? "spaghetti"}
                            expressionSource={
                                plant?.characterFaceRemoved ? getPlantExpressionSource(plant) : null
                            }
                            expressionBounds={plant?.characterFaceBounds}
                            effectRemote={decorRemote}
                            effectFallback={decorBundle}
                            width={230}
                            height={230}
                        />

                        <View style={styles.plantLabelGroup}>
                            <PixelOutlineText style={styles.plantName} strokeWidth={2}>
                                {plantName}
                            </PixelOutlineText>
                            <PixelOutlineText style={styles.dayText} strokeWidth={2}>
                                D+{togetherDays}
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
                                                navigation.navigate(item.screen, { plant });
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

            {/* ── 다시 함께하기 확인 모달 (앱 픽셀 확인창 디자인) ── */}
            <Modal
                visible={graveModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setGraveModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.confirmBackdrop}
                    activeOpacity={1}
                    onPress={() => setGraveModalVisible(false)}
                >
                    {/* 카드 안쪽 탭이 바깥 닫기로 새지 않게 한 겹 감싼다 */}
                    <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.confirmCardTouch}>
                        <View style={styles.confirmCard}>
                            {/* 아이콘 자리에 그 개체를 세운다 — 누구를 되돌리는지 한눈에 */}
                            <PlantImage
                                uri={plant?.imageUri}
                                imageKey={plant?.imageKey ?? "spaghetti"}
                                expressionSource={
                                    plant?.characterFaceRemoved ? getPlantExpressionSource(plant) : null
                                }
                                expressionBounds={plant?.characterFaceBounds}
                                width={60}
                                height={60}
                                style={styles.confirmPlant}
                            />

                            <Text style={styles.confirmTitle}>다시 함께하기</Text>
                            <Text style={styles.confirmMessage}>
                                {plantName}을(를) 추억공간에서{"\n"}다시 정원으로 옮길까요?
                            </Text>

                            <View style={styles.confirmButtonRow}>
                                <PixelButton
                                    label="계속 추억하기"
                                    color={Colors.textGray}
                                    onPress={() => setGraveModalVisible(false)}
                                    contentStyle={styles.confirmButtonContent}
                                    style={styles.confirmButton}
                                />
                                <PixelButton
                                    label="다시 함께하기"
                                    color={Colors.primary}
                                    onPress={handleRevive}
                                    contentStyle={styles.confirmButtonContent}
                                    style={styles.confirmButton}
                                />
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

    // 개체탭(PlantDetailScreen)의 말풍선과 같은 자리·같은 크기
    speechBubble: {
        position: "absolute",
        top: 265,
        left: "50%",
        marginLeft: -125, // width(250)의 절반 → 화면(=식물) 가로 중앙 정렬
        width: 250,
        height: 70,
        zIndex: 20,
    },
    speechText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 18,
        color: Colors.textBlack,
    },
    speechContent: {
        paddingHorizontal: Spacing.lg,
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

    /*
        ── 다시 함께하기 확인 모달 ──────────────────────────
        PlantDetailScreen 의 물주기 확인창과 같은 뼈대(크림 카드 + 3px 각진
        테두리 + 픽셀 버튼)를 쓴다. 색만 추모 화면의 mauve 로 바꿔
        같은 앱의 확인창이면서 이 화면의 결을 잃지 않게 했다.
    */
    confirmBackdrop: {
        flex: 1,
        backgroundColor: Colors.scrim,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: Spacing.xl,
    },
    confirmCardTouch: {
        width: "100%",
        maxWidth: 320,
    },
    confirmCard: {
        width: "100%",
        backgroundColor: Paper.cream,
        borderWidth: 3,
        borderColor: Accent.mauve,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        alignItems: "center",
    },
    confirmPlant: {
        marginBottom: Spacing.xs,
    },
    /*
        도트 폰트는 글자 위아래로 빈 줄 상자가 넓게 잡힌다.
        lineHeight 를 글자 크기에 맞춰 조이고 includeFontPadding 을 꺼야
        marginBottom 을 줄인 만큼 실제로 붙는다.
    */
    confirmTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        lineHeight: 26,
        includeFontPadding: false,
        color: Accent.mauve,
        marginBottom: Spacing.xs,
    },
    confirmMessage: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        lineHeight: 22,
        includeFontPadding: false,
        color: Colors.textBlack,
        textAlign: "center",
        marginBottom: Spacing.lg,
    },
    confirmButtonRow: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    confirmButton: {
        flex: 1,
    },
    /*
        좌우: "계속 추억하기"가 좁은 칸에서 줄바꿈되지 않게 기본값보다 줄인다.
        상하: 버튼 두 줄만으로 카드가 길어지지 않게 한 단계 낮춘다.
    */
    confirmButtonContent: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
});
