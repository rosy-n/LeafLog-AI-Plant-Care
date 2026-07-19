import React, { useEffect, useRef, useState } from "react";
import {
    ImageBackground,
    Image,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import ResourceCounter from "../components/ResourceCounter";
import ScreenHeader from "../components/ScreenHeader";
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

// TODO: Qwen 연동 전 임시 페르소나 응답 (식물이 1인칭으로 말하는 톤, 2~3문장)
const PLANT_REPLIES = [
    "헤헤, 그렇게 말해주니 잎이 반짝이는 것 같아! 오늘따라 기분이 참 좋아. 너도 좋은 하루 보내고 있어?",
    "오늘은 햇빛을 듬뿍 받아서 아주 든든해. 창가에 두니까 잎마다 힘이 나는 기분이야. 이대로만 지내면 무럭무럭 자랄 것 같아!",
    "조금 목이 마른 것 같기도 해. 그래도 아직은 견딜 만하니까 너무 걱정하지는 마. 흙이 바싹 마르면 그때 물 한 잔 부탁할게!",
    "너랑 이야기하니까 하루가 훨씬 즐거워졌어. 이렇게 말 걸어줘서 정말 고마워. 앞으로도 자주 놀러 와 줄 거지?",
    "요즘 나 조금씩 자라고 있는 거 느껴져? 새 잎이 돋을 생각에 벌써 설레. 천천히 지켜봐 주면 멋지게 클게!",
    "음... 아직 말솜씨가 서툴러서 미안해. 그래도 네 마음은 잎끝까지 다 전해지고 있어. 곧 더 근사하게 대답할 수 있을 거야!",
];

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

    // 캐릭터 대화 모드 — 이 화면 위에서 말풍선/입력만 표시 (기록은 남기지 않음)
    const [chatMode, setChatMode] = useState(false);
    const [chatReply, setChatReply] = useState("");   // 캐릭터의 현재 대답
    const [lastUserMsg, setLastUserMsg] = useState(""); // 사용자의 마지막 입력
    const [chatInput, setChatInput] = useState("");
    const replyIndexRef = useRef(0);

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

    // 대화 모드 진입 — 메뉴가 열려 있으면 닫고 인사말로 시작
    const openChat = () => {
        if (menuOpen) closeMenu();
        setLastUserMsg("");
        setChatInput("");
        setChatReply(`안녕! 나 ${plantName}야. 오늘도 만나서 반가워 🌿 뭐든 편하게 말 걸어줘!`);
        setChatMode(true);
    };

    const closeChat = () => {
        setChatMode(false);
        setChatInput("");
    };

    // 사용자 입력 전송 — 마지막 입력만 표시하고 캐릭터 대답을 갱신 (기록은 저장 안 함)
    // TODO: Qwen API 호출로 교체
    const sendChat = () => {
        const trimmed = chatInput.trim();
        if (!trimmed) return;
        setLastUserMsg(trimmed);
        setChatInput("");
        setTimeout(() => {
            const reply = PLANT_REPLIES[replyIndexRef.current % PLANT_REPLIES.length];
            replyIndexRef.current += 1;
            setChatReply(reply);
        }, 450);
    };

    return (
        <View style={styles.root}>
            <ImageBackground
                source={require("../../assets/images/detail-bg.png")}
                resizeMode="cover"
                style={styles.background}
            >
                <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
                    {!chatMode && (
                        <View style={styles.resourceArea}>
                            <ResourceCounter wateringDays={wateringDays} nutrientDays={nutrientDays} />
                        </View>
                    )}

                    {!chatMode && (
                        <View style={styles.heartsArea}>
                            <HeartsRow count={5} size={25} />
                        </View>
                    )}

                    {!chatMode && (
                        <View style={styles.speechBubble}>
                            <Text style={styles.speechText}>안녕! 좋은 아침이야</Text>
                            <View style={styles.tailBorder} />
                            <View style={styles.tailInner} />
                        </View>
                    )}

                    {!chatMode && (
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
                    )}

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

                    {!chatMode && (
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
                    )}

                    {!chatMode && (
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

                        <LiquidGlassButton size={54} onPress={openChat}>
                            <Ionicons name="happy-outline" size={30} color={Leaf.olive} />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={68} onPress={handleWaterPress}>
                            <MaterialCommunityIcons
                                name="watering-can-outline"
                                size={40}
                                color={Accent.brownDeep}
                            />
                        </LiquidGlassButton>
                    </View>
                    )}

                    {/* ── 캐릭터 대화 모드 오버레이 (flex 세로 배치로 키보드에 반응) ── */}
                    {chatMode && (
                        <KeyboardAvoidingView
                            style={styles.chatOverlay}
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                        >
                            {/* 상단 헤더 — 뒤로가기 + 식물 이름 */}
                            <ScreenHeader title={plantName} onBack={closeChat} />

                            {/* 캐릭터 대답 말풍선 (2~3문장 · 자동 높이) */}
                            <View style={styles.chatReplyBubble}>
                                <Text style={styles.chatReplyText}>{chatReply}</Text>
                                <View style={styles.chatTailBorder} />
                                <View style={styles.chatTailInner} />
                            </View>

                            {/* 캐릭터 — 처음부터 상단 고정 위치. 키보드가 올라와도 움직이지 않음 */}
                            <View style={styles.chatCharacterArea}>
                                {appliedItem ? (
                                    <Image
                                        source={appliedItem.plantImage}
                                        style={styles.chatCharacterImage}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <PlantImage
                                        uri={plant?.imageUri}
                                        imageKey={plant?.imageKey ?? "spaghetti"}
                                        width={190}
                                        height={190}
                                    />
                                )}
                            </View>

                            {/* 남는 공간 — 키보드가 올라오면 이 영역만 줄어들어 캐릭터는 고정 */}
                            <View style={styles.chatSpacer} />

                            {/* 입력 영역 (사용자의 마지막 입력 + 입력창) */}
                            <View style={styles.chatInputArea}>
                                {lastUserMsg ? (
                                    <View style={styles.userMsgRow}>
                                        <View style={styles.userMsgBubble}>
                                            <Text style={styles.userMsgText}>{lastUserMsg}</Text>
                                        </View>
                                    </View>
                                ) : null}

                                <View style={styles.chatInputBar}>
                                    <TextInput
                                        style={styles.chatInput}
                                        value={chatInput}
                                        onChangeText={setChatInput}
                                        placeholder={`${plantName}에게 말 걸어보세요`}
                                        placeholderTextColor={GreenTint.medium}
                                        multiline
                                        textAlignVertical="center"
                                        onSubmitEditing={sendChat}
                                    />
                                    <TouchableOpacity
                                        style={[styles.chatSendButton, !chatInput.trim() && styles.chatSendButtonDisabled]}
                                        onPress={sendChat}
                                        activeOpacity={0.8}
                                        disabled={!chatInput.trim()}
                                    >
                                        <Ionicons name="arrow-up" size={20} color={Colors.white} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    )}
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

    // ── 캐릭터 대화 모드 ──────────────────────────────
    // 전체 오버레이 — 세로 flex 배치 (말풍선 → 캐릭터 → 입력). 키보드에 반응해 재배치
    chatOverlay: {
        flex: 1,
        zIndex: 50,
    },
    // 캐릭터 대답 말풍선 (2~3문장, 자동 높이)
    chatReplyBubble: {
        marginTop: Spacing.lg,
        marginHorizontal: 20,
        backgroundColor: Colors.white,
        borderWidth: 4,
        borderColor: Colors.textBlack,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },

    // 캐릭터 영역 — 상단 고정 위치 (말풍선 아래). 키보드와 무관하게 그대로
    chatCharacterArea: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: Spacing.section,
    },
    chatCharacterImage: {
        width: 190,
        height: 190,
    },
    // 캐릭터와 입력 사이 여백 — 키보드가 올라오면 이 영역만 줄어듦
    chatSpacer: {
        flex: 1,
    },
    chatReplyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        lineHeight: 26,
        color: Colors.textBlack,
    },
    chatTailBorder: {
        position: "absolute",
        bottom: -22,
        left: "50%",
        marginLeft: -15,
        width: 31,
        height: 31,
        backgroundColor: Colors.textBlack,
        transform: [{ rotate: "45deg" }],
    },
    chatTailInner: {
        position: "absolute",
        bottom: -14,
        left: "50%",
        marginLeft: -10,
        width: 20,
        height: 20,
        backgroundColor: Colors.white,
        transform: [{ rotate: "45deg" }],
    },

    // 입력 영역 (flex 컬럼 하단)
    chatInputArea: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Platform.OS === "ios" ? 24 : 16,
        gap: Spacing.md,
    },
    userMsgRow: {
        alignItems: "flex-end",
        marginBottom: Spacing.xs,
    },
    userMsgBubble: {
        maxWidth: "80%",
        backgroundColor: Colors.primary,
        borderRadius: Radius.xl,
        borderTopRightRadius: Radius.xs,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    userMsgText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        lineHeight: 24,
        color: Colors.white,
        includeFontPadding: false,
    },
    chatInputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: GreenTint.haze,
        paddingLeft: Spacing.lg,
        paddingRight: Spacing.xs,
        paddingVertical: Spacing.xs,
    },
    chatInput: {
        flex: 1,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: GreenTint.deep,
        minHeight: 34,
        maxHeight: 90,
        paddingVertical: Spacing.sm,
        includeFontPadding: false,
    },
    chatSendButton: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: Spacing.sm,
        marginBottom: Spacing.xxs,
    },
    chatSendButtonDisabled: {
        backgroundColor: GreenTint.line,
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