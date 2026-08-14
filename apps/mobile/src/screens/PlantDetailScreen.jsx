import React, { useCallback, useEffect, useRef, useState } from "react";
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
    Easing,
    Modal,
    PanResponder,
} from "react-native";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import ResourceCounter from "../components/ResourceCounter";
import HeartsRow from "../components/HeartsRow";
import PlantImage from "../components/PlantImage";
import LiquidGlassButton from "../components/LiquidGlassButton";
import PixelOutlineText from "../components/PixelOutlineText";
import PixelButton from "../components/PixelButton";
import PixelSpeechBubble from "../components/PixelSpeechBubble";
import { scheduleWateringReminder } from "../notifications";
import {
    getPlantCare,
    createCareRecord,
    updatePlant,
    getPersonas,
    personaChat,
    getPlantAffinity,
    petPlant,
} from "../api";
import { accessorySpriteBundle } from "../data/decor";
import DecorImage from "../components/DecorImage";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint, Glass, Paper, Pink } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { getPersonaGreeting } from "../../constants/persona-greetings";

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
let heartIdCounter = 0;

const PLANT_SIZE = 230;        // 개체탭 캐릭터 크기 (= 문지를 수 있는 영역)
const RUB_HEART_ICON = require("../../assets/icons/fullheart_icon.png");

/*
    캐릭터 문지르기 연출.
    손가락을 움직인 만큼만 하트가 나오게 해서(가만히 누르고 있으면 안 나온다)
    "문지르는" 동작으로 느껴지게 한다.
*/
const RUB_HEART_INTERVAL_MS = 130;  // 하트가 연달아 나오는 최소 간격
const RUB_MOVE_THRESHOLD = 14;      // 이만큼(px) 움직여야 다음 하트
const RUB_HEART_FLOAT_MS = 1100;    // 하트가 떠올라 사라지기까지
const RUB_HEART_RISE = 80;          // 떠오르는 높이(px)
const RUB_HEART_SIZE = 26;

/*
    물주기 연출 타이밍 — 진동을 물방울이 나타나는 리듬에 맞추려면
    낙하 애니메이션과 같은 값을 써야 하므로 상수로 뺐다.
*/
const DROP_COUNT = 8;          // 떨어뜨릴 물방울 개수
const DROP_INTERVAL_MS = 110;  // 물방울이 하나씩 생기는 간격
const DROP_FALL_MS = 1100;     // 낙하 애니메이션 길이

/*
    진동은 RN 내장 Vibration 이 아니라 expo-haptics 를 쓴다.
    iOS 의 Vibration 은 vibrateByPattern/cancel 이 미구현(에러 로그만)이고
    vibrate() 는 시스템 부저 한 번뿐이어서 방울 리듬을 표현할 수 없다.
    expo-haptics 는 Core Haptics(iOS)·Vibrator(Android)를 써서 두 플랫폼 모두
    가벼운 임팩트를 같은 코드로 낼 수 있다.
*/

// 캐릭터가 아직 말투 규칙을 못 지켰을 때(서버 502 등) 대화창에 그대로 보여줄 안전 문구
const CHAT_FALLBACK_REPLY = "음... 지금은 대답하기 어려워. 잠시 후 다시 말해줄래?";

export default function PlantDetailScreen({ navigation, route, decorations }) {
    const plant = route?.params?.plant;
    // 착용 중인 액세서리 — route 로 받은 식물 스냅샷이 아니라 App.js 의 맵에서 찾는다
    // (꾸미기 탭에서 바꾸고 돌아왔을 때 옛 값이 남지 않게).
    const decoration = decorations?.[String(plant?.id)] ?? null;
    const decorRemote = decoration?.spriteUrl ? { uri: decoration.spriteUrl } : null;
    const decorBundle = accessorySpriteBundle(decoration?.key);
    const hasDecor = Boolean(decorRemote || decorBundle);
    const plantName = plant?.name ?? "스파게티";
    const togetherDays = daysSince(plant?.createdAt);

    // 물 준 후 지난 일수 → 좌측 상단 ResourceCounter(💧 D+N)에 표시
    const [wateringDays, setWateringDays] = useState(null);

    // 영양제 준 후 지난 일수 → 좌측 상단 ResourceCounter(✚ D+N)에 표시
    const [nutrientDays, setNutrientDays] = useState(null);

    // 애정도 — 정원 목록에서 넘어온 값으로 먼저 그리고, 화면에 들어올 때 서버 값으로 갱신.
    // 물주기/영양제/분갈이 기록에서 서버가 계산한다 (app/affinity.py)
    const [affinity, setAffinity] = useState(() =>
        plant?.hearts != null
            ? {
                  score: plant.affinityScore ?? 0,
                  hearts: plant.hearts,
                  level: plant.affinityLevel ?? 0,
              }
            : null
    );
    // 방금 얻은 애정도 점수 — 하트 아래에 "+10" 으로 잠깐 떠오른다
    const [affinityGain, setAffinityGain] = useState(0);
    const gainAnim = useRef(new Animated.Value(0)).current;

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // 물주기 애니메이션 (식물 위로 떨어지는 물방울) + 진행 중 중복 탭 방지
    const [wateringDrops, setWateringDrops] = useState([]);
    const [isWatering, setIsWatering] = useState(false);
    // 물주기 확인 모달
    const [waterConfirmVisible, setWaterConfirmVisible] = useState(false);
    // 방울마다 예약해 둔 진동 타이머 — 물주기 도중 화면을 벗어나면 취소해야 한다
    const dropHapticTimers = useRef([]);

    const clearDropHaptics = () => {
        dropHapticTimers.current.forEach(clearTimeout);
        dropHapticTimers.current = [];
    };

    // 햅틱이 없는 기기(시뮬레이터·태블릿)에서는 조용히 무시된다
    const tapHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((e) =>
            console.warn("진동 실패:", e?.message),
        );
    };

    /*
        물방울이 하나씩 나타나는 리듬에 맞춰 톡톡.
        첫 진동은 타이머 없이 바로 실행한다 — 버튼을 누른 순간과 첫 물방울,
        첫 진동이 같이 오도록(예전엔 물방울이 식물에 닿는 시점까지 기다려 늦었다).
    */
    const startWateringHaptics = () => {
        clearDropHaptics();
        tapHaptic();
        for (let i = 1; i < DROP_COUNT; i++) {
            dropHapticTimers.current.push(
                setTimeout(tapHaptic, i * DROP_INTERVAL_MS),
            );
        }
    };

    // 물주기 도중 화면을 벗어나면 예약된 진동을 취소한다 (안 하면 뒤늦게 울린다)
    useEffect(() => clearDropHaptics, []);

    // ── 캐릭터 문지르기 ──────────────────────────────
    // 손가락을 따라 하트가 뜨고 그때마다 가볍게 진동한다. 애정도는 하루 한 번만 오른다.
    const [rubHearts, setRubHearts] = useState([]);
    const lastRubAt = useRef(0);
    const lastRubPos = useRef({ x: 0, y: 0 });
    // 하루 1회 판정은 서버가 하므로, 화면에 머무는 동안 요청은 한 번만 보낸다
    const petRequested = useRef(false);

    const spawnRubHeart = (x, y) => {
        lastRubAt.current = Date.now();
        lastRubPos.current = { x, y };

        const id = ++heartIdCounter;
        const animValue = new Animated.Value(0);
        const drift = (Math.random() - 0.5) * 44;   // 떠오르면서 좌우로 흩어진다
        const scale = 0.75 + Math.random() * 0.45;

        setRubHearts((prev) => [...prev, { id, animValue, x, y, drift, scale }]);
        Animated.timing(animValue, {
            toValue: 1,
            duration: RUB_HEART_FLOAT_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start(() => {
            setRubHearts((prev) => prev.filter((heart) => heart.id !== id));
        });

        // 문지르는 느낌이라 물주기(Light)보다 부드러운 임팩트를 쓴다
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch((e) =>
            console.warn("진동 실패:", e?.message),
        );
    };

    // 문지르기 보상 — 서버가 하루 1회만 준다 (이미 받았으면 0점으로 응답)
    const requestPetReward = async () => {
        const id = plant?.id;
        if (!id || petRequested.current) return;
        petRequested.current = true;
        try {
            const result = await petPlant(Number(id));
            setAffinity(result.affinity);
            showAffinityGain(result.affinity_awarded);
        } catch (e) {
            console.warn("문지르기 애정도 실패:", e?.message);
            petRequested.current = false; // 통신 실패면 다음 문지르기에서 다시 시도
        }
    };

    const rubResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (event) => {
                const { locationX, locationY } = event.nativeEvent;
                spawnRubHeart(locationX, locationY);
                requestPetReward();
            },
            onPanResponderMove: (event) => {
                const { locationX, locationY } = event.nativeEvent;
                if (Date.now() - lastRubAt.current < RUB_HEART_INTERVAL_MS) return;
                const moved = Math.hypot(
                    locationX - lastRubPos.current.x,
                    locationY - lastRubPos.current.y,
                );
                if (moved < RUB_MOVE_THRESHOLD) return;
                spawnRubHeart(locationX, locationY);
            },
        }),
    ).current;

    // 캐릭터 대화 모드 — 이 화면 위에서 말풍선/입력만 표시 (기록은 남기지 않음)
    const [chatMode, setChatMode] = useState(false);
    const [chatReply, setChatReply] = useState("");   // 캐릭터의 현재 대답
    const [chatInput, setChatInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [userBubble, setUserBubble] = useState(""); // 내가 방금 보낸 말 (대사창 위에 살짝 겹쳐 표시)

    // 페르소나(성격) — plant.persona가 아직 없으면(add-plant 단계에 선택 UI가 없어 null) 첫 대화 시도 시 선택 모달을 띄운다
    const [persona, setPersona] = useState(plant?.persona ?? null);
    const [personaOptions, setPersonaOptions] = useState([]);
    const [personaPickerVisible, setPersonaPickerVisible] = useState(false);

    // 개체 탭에 들어오는 순간 페르소나 기본대사 중 하나를 뽑아 고정 — 탭에 머무는 동안은 바뀌지 않는다
    const [idleGreeting] = useState(() => getPersonaGreeting(persona));

    // 서버는 대화 기록을 저장하지 않는다 — 클라이언트가 최근 5턴(최대 10개 메시지)만 매번 실어 보낸다
    const chatHistoryRef = useRef([]);

    useEffect(() => {
        getPersonas()
            .then(setPersonaOptions)
            .catch((e) => console.warn("페르소나 목록 로드 실패:", e?.message));
    }, []);

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

    // 영양제·분갈이 화면에서 기록을 남기고 돌아와도 하트가 맞도록 포커스마다 다시 읽는다
    useFocusEffect(
        useCallback(() => {
            const id = plant?.id;
            if (!id) return;
            let active = true;
            getPlantAffinity(Number(id))
                .then((status) => {
                    if (active) setAffinity(status);
                })
                .catch((e) => console.warn("애정도 조회 실패:", e?.message));
            return () => {
                active = false;
            };
        }, [plant?.id])
    );

    // 얻은 점수를 하트 밑에 띄웠다가 사라지게 (0 = 오늘 이미 채웠거나 만점 → 표시 안 함)
    const showAffinityGain = (awarded) => {
        if (!awarded || awarded <= 0) return;
        setAffinityGain(awarded);
        gainAnim.setValue(0);
        Animated.sequence([
            Animated.timing(gainAnim, {
                toValue: 1,
                duration: 360,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.delay(1000),   // 읽을 시간을 주고 사라진다
            Animated.timing(gainAnim, {
                toValue: 2,
                duration: 420,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished) setAffinityGain(0);
        });
    };

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
            duration: DROP_FALL_MS,
            useNativeDriver: true,
        }).start(() => {
            setWateringDrops((prev) => prev.filter((d) => d.id !== id));
        });
    };

    // 물주기 버튼: 확인 모달을 먼저 띄우고, 사용자가 확인해야 실제 물주기 처리
    const handleWaterPress = () => {
        if (isWatering) return;
        setWaterConfirmVisible(true);
    };

    // 확인 모달에서 "물주기" 선택 → 모달 닫고 실제 물주기 실행
    const confirmWater = () => {
        setWaterConfirmVisible(false);
        doWater();
    };

    // 실제 물주기: 물방울 애니메이션 + 진동 + WATERING 관리 기록 저장 → 💧 D+N 갱신
    const doWater = async () => {
        if (isWatering) return;
        setIsWatering(true);

        // 첫 물방울과 첫 진동을 같은 시점에 시작한다 (둘 다 지금 즉시)
        startWateringHaptics();
        spawnDrop();
        for (let i = 1; i < DROP_COUNT; i++) {
            setTimeout(spawnDrop, i * DROP_INTERVAL_MS);
        }

        const id = plant?.id;
        if (id) {
            try {
                // 저장 응답에 이번에 얻은 애정도와 갱신된 하트 수가 함께 온다
                const saved = await createCareRecord(Number(id), { care_type: "WATERING" });
                setAffinity(saved.affinity);
                showAffinityGain(saved.affinity_awarded);
                const care = await getPlantCare(Number(id));
                setWateringDays(care.days_since_watering);
                setNutrientDays(care.days_since_fertilizing);
                // 물을 주면 다음 예정일이 밀리므로 알림도 다시 예약한다
                scheduleWateringReminder(id, plantName, care.next_watering_date).catch(
                    (err) => console.warn("물주기 알림 예약 실패:", err?.message),
                );
            } catch (e) {
                console.warn("물주기 기록 실패:", e?.message);
            }
        }

        setTimeout(() => setIsWatering(false), 1200);
    };

    // 실제 대화 시작 — 로컬 기록 초기화 + 인사말(서버 호출 없이, 페르소나 기본대사 중 랜덤)로 시작
    // personaSlug를 받는 이유: choosePersona()에서 setPersona() 직후 호출하면 persona state가
    // 아직 갱신되지 않은 값(stale closure)이라 방금 고른 slug를 직접 넘겨받아야 한다
    const startChatSession = (personaSlug = persona) => {
        chatHistoryRef.current = [];
        setChatInput("");
        setUserBubble("");
        setChatReply(getPersonaGreeting(personaSlug));
        setChatMode(true);
    };

    // 대화 모드 진입 — 메뉴가 열려 있으면 닫고, 페르소나가 아직 없으면 선택부터 받는다
    const openChat = () => {
        if (menuOpen) closeMenu();
        if (!persona) {
            setPersonaPickerVisible(true);
            return;
        }
        startChatSession();
    };

    const closeChat = () => {
        setChatMode(false);
        setChatInput("");
        setUserBubble("");
    };

    // 페르소나 선택 — 식물에 저장한 뒤 바로 대화 시작
    const choosePersona = async (slug) => {
        const id = plant?.id;
        if (!id) return;
        try {
            await updatePlant(Number(id), { persona: slug });
            setPersona(slug);
            setPersonaPickerVisible(false);
            startChatSession(slug);
        } catch (e) {
            console.warn("페르소나 저장 실패:", e?.message);
        }
    };

    // 사용자 입력 전송 — 실제 persona-chat API 호출 (내 말은 대사창 위에 작은 말풍선으로 겹쳐 보여준다)
    const sendChat = async () => {
        const trimmed = chatInput.trim();
        const id = plant?.id;
        if (!trimmed || isSending || !id) return;

        setChatInput("");
        setUserBubble(trimmed);
        setIsSending(true);
        const historyBeforeSend = chatHistoryRef.current;

        try {
            const result = await personaChat(Number(id), trimmed, historyBeforeSend);
            chatHistoryRef.current = [
                ...historyBeforeSend,
                { role: "user", content: trimmed },
                { role: "assistant", content: result.reply },
            ].slice(-10);
            setChatReply(result.reply);
        } catch (e) {
            console.warn("persona-chat 호출 실패:", e?.message);
            setChatReply(CHAT_FALLBACK_REPLY);
        } finally {
            setIsSending(false);
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
                    {!chatMode && (
                        <View style={styles.resourceArea}>
                            <ResourceCounter wateringDays={wateringDays} nutrientDays={nutrientDays} />
                        </View>
                    )}

                    {!chatMode && (
                        <View style={styles.heartsArea}>
                            <HeartsRow count={affinity?.hearts ?? 0} size={25} />

                            {/* 물주기·문지르기로 오른 애정도 — 테두리 없이 핑크 글씨만 */}
                            {affinityGain > 0 && (
                                <Animated.Text
                                    pointerEvents="none"
                                    style={[
                                        styles.affinityGainText,
                                        {
                                            opacity: gainAnim.interpolate({
                                                inputRange: [0, 1, 2],
                                                outputRange: [0, 1, 0],
                                            }),
                                            transform: [
                                                {
                                                    translateY: gainAnim.interpolate({
                                                        inputRange: [0, 1, 2],
                                                        outputRange: [8, -4, -22],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    +{affinityGain}
                                </Animated.Text>
                            )}
                        </View>
                    )}

                    {!chatMode && (
                        <PixelSpeechBubble
                            style={styles.speechBubble}
                            textStyle={styles.speechText}
                            tailOffset={125}
                        >
                            {idleGreeting}
                        </PixelSpeechBubble>
                    )}

                    {!chatMode && (
                        <View style={styles.mainPlantArea}>
                            {/* 캐릭터 — 문지르면 하트가 뜨고 진동한다 (하루 한 번 애정도도 오른다) */}
                            <View
                                style={styles.plantTouchArea}
                                {...rubResponder.panHandlers}
                            >
                                {hasDecor ? (
                                    <DecorImage
                                        remote={decorRemote}
                                        fallback={decorBundle}
                                        style={styles.plantImage}
                                    />
                                ) : (
                                    <PlantImage
                                        uri={plant?.imageUri}
                                        imageKey={plant?.imageKey ?? "spaghetti"}
                                        width={PLANT_SIZE}
                                        height={PLANT_SIZE}
                                    />
                                )}

                                {/* 손가락이 지나간 자리에서 떠오르는 하트 */}
                                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                                    {rubHearts.map((heart) => (
                                        <Animated.Image
                                            key={heart.id}
                                            source={RUB_HEART_ICON}
                                            resizeMode="contain"
                                            style={[
                                                styles.rubHeart,
                                                {
                                                    left: heart.x - RUB_HEART_SIZE / 2,
                                                    top: heart.y - RUB_HEART_SIZE / 2,
                                                    opacity: heart.animValue.interpolate({
                                                        inputRange: [0, 0.15, 1],
                                                        outputRange: [0, 1, 0],
                                                    }),
                                                    transform: [
                                                        {
                                                            translateY: heart.animValue.interpolate({
                                                                inputRange: [0, 1],
                                                                outputRange: [0, -RUB_HEART_RISE],
                                                            }),
                                                        },
                                                        {
                                                            translateX: heart.animValue.interpolate({
                                                                inputRange: [0, 1],
                                                                outputRange: [0, heart.drift],
                                                            }),
                                                        },
                                                        {
                                                            scale: heart.animValue.interpolate({
                                                                inputRange: [0, 0.3, 1],
                                                                outputRange: [
                                                                    0.4,
                                                                    heart.scale,
                                                                    heart.scale * 0.85,
                                                                ],
                                                            }),
                                                        },
                                                    ],
                                                },
                                            ]}
                                        />
                                    ))}
                                </View>
                            </View>

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
                                <Image
                                    source={require("../../assets/icons/water_icon.png")}
                                    style={styles.dropImage}
                                    resizeMode="contain"
                                />
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
                            <Image
                                source={
                                    menuOpen
                                        ? require("../../assets/icons/close_icon.png")
                                        : require("../../assets/icons/hamburger_icon.png")
                                }
                                style={styles.buttonIcon}
                                resizeMode="contain"
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton
                            size={54}
                            onPress={() => navigation.navigate("Home")}
                        >
                            <Image
                                source={require("../../assets/icons/home_icon.png")}
                                style={styles.buttonIcon}
                                resizeMode="contain"
                            />
                        </LiquidGlassButton>
                    </View>
                    )}

                    {!chatMode && (
                    <View style={styles.rightButtons}>
                        <LiquidGlassButton
                            size={54}
                            onPress={() => navigation.navigate("ConsultationHistory")}
                        >
                            <Image
                                source={require("../../assets/icons/counsel_icon.png")}
                                style={styles.buttonIcon}
                                resizeMode="contain"
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={54} onPress={openChat}>
                            <Image
                                source={require("../../assets/icons/chat_icon.png")}
                                style={styles.buttonIcon}
                                resizeMode="contain"
                            />
                        </LiquidGlassButton>

                        <LiquidGlassButton size={68} onPress={handleWaterPress}>
                            <Image
                                source={require("../../assets/icons/watering_icon.png")}
                                style={styles.buttonIconLarge}
                                resizeMode="contain"
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
                            {/* 캐릭터 — 가운데, 상단 영역 (남는 공간을 채우며 중앙 정렬) */}
                            <View style={styles.chatCharacterArea}>
                                {hasDecor ? (
                                    <DecorImage
                                        remote={decorRemote}
                                        fallback={decorBundle}
                                        style={styles.chatCharacterImage}
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

                            {/* 내가 방금 보낸 말 — 대사창 위쪽에 살짝 겹쳐서(옛 NPC 게임의 대사 스택 느낌) */}
                            {!!userBubble && (
                                <View style={styles.userBubbleWrap}>
                                    <View style={styles.userBubble}>
                                        <Text style={styles.userBubbleText} numberOfLines={2}>
                                            {userBubble}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* 식물 대화창 — 첫 줄에 식물 이름(메인 초록·고정), 그 아래 대사만 갱신 */}
                            <View style={styles.chatReplyBubble}>
                                <Text style={styles.chatPlantName}>{plantName}</Text>
                                <Text style={styles.chatReplyText}>{isSending ? "···" : chatReply}</Text>
                            </View>

                            {/* 입력 영역 (입력창) */}
                            <View style={styles.chatInputArea}>
                                <View style={styles.chatInputBar}>
                                    <TouchableOpacity
                                        style={styles.chatCloseButton}
                                        onPress={closeChat}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="close" size={20} color={GreenTint.strong} />
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.chatInput}
                                        value={chatInput}
                                        onChangeText={setChatInput}
                                        placeholder={`${plantName}에게 말 걸어보세요`}
                                        placeholderTextColor={GreenTint.medium}
                                        multiline
                                        autoFocus
                                        textAlignVertical="center"
                                        onSubmitEditing={sendChat}
                                    />
                                    <TouchableOpacity
                                        style={[
                                            styles.chatSendButton,
                                            (!chatInput.trim() || isSending) && styles.chatSendButtonDisabled,
                                        ]}
                                        onPress={sendChat}
                                        activeOpacity={0.8}
                                        disabled={!chatInput.trim() || isSending}
                                    >
                                        <Ionicons name="arrow-up" size={20} color={Colors.white} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    )}

                    {/* ── 페르소나(성격) 선택 모달 — 대화 최초 진입 시, 아직 미선택인 경우만 ── */}
                    <Modal
                        visible={personaPickerVisible}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setPersonaPickerVisible(false)}
                    >
                        <View style={styles.confirmBackdrop}>
                            <View style={styles.personaCard}>
                                <Text style={styles.confirmTitle}>성격 선택</Text>
                                <Text style={styles.confirmMessage}>
                                    {plantName}의 성격을 골라주세요!
                                </Text>

                                <View style={styles.personaGrid}>
                                    {personaOptions.map((option) => (
                                        <PixelButton
                                            key={option.slug}
                                            label={option.label}
                                            color={Colors.primary}
                                            onPress={() => choosePersona(option.slug)}
                                            style={styles.personaButton}
                                            contentStyle={styles.personaButtonContent}
                                        />
                                    ))}
                                </View>
                            </View>
                        </View>
                    </Modal>

                    {/* ── 물주기 확인 모달 (앱 픽셀 말풍선 디자인) ── */}
                    <Modal
                        visible={waterConfirmVisible}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setWaterConfirmVisible(false)}
                    >
                        <View style={styles.confirmBackdrop}>
                            <View style={styles.confirmCard}>
                                <Image
                                    source={require("../../assets/icons/water_icon.png")}
                                    style={styles.confirmIcon}
                                    resizeMode="contain"
                                />
                                <Text style={styles.confirmTitle}>물주기</Text>
                                <Text style={styles.confirmMessage}>
                                    {plantName}에게 물을 줄까요?
                                </Text>

                                <View style={styles.confirmButtonRow}>
                                    <PixelButton
                                        label="취소"
                                        color={Colors.textGray}
                                        onPress={() => setWaterConfirmVisible(false)}
                                        style={styles.confirmButton}
                                    />
                                    <PixelButton
                                        label="물주기"
                                        color={Colors.primary}
                                        onPress={confirmWater}
                                        style={styles.confirmButton}
                                    />
                                </View>
                            </View>
                        </View>
                    </Modal>
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
        alignItems: "flex-end",
        zIndex: 10,
    },
    // 돌봄·문지르기로 얻은 애정도 — 하트 아래에서 핑크 글씨만 잠깐 떠오른다
    affinityGainText: {
        marginTop: Spacing.xxs,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        lineHeight: 28,
        color: Pink.rose,
        includeFontPadding: false,
    },

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
        fontSize: FontSizes.bodyLarge,
        color: Colors.textBlack,
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
    // 문지를 수 있는 영역 = 캐릭터 크기. 하트는 이 안의 손가락 좌표에 붙는다
    plantTouchArea: {
        width: PLANT_SIZE,
        height: PLANT_SIZE,
        alignItems: "center",
        justifyContent: "center",
    },
    plantImage: {
        width: PLANT_SIZE,
        height: PLANT_SIZE,
    },
    rubHeart: {
        position: "absolute",
        width: RUB_HEART_SIZE,
        height: RUB_HEART_SIZE,
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
    dropImage: {
        width: 34,
        height: 34,
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

    buttonIcon: {
        width: 30,
        height: 30,
    },
    buttonIconLarge: {
        width: 40,
        height: 40,
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
    // 캐릭터 영역 — 남는 공간을 채우되 캐릭터는 대화창 바로 위 가운데에 정렬
    chatCharacterArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-end",
        marginBottom: Spacing.xs,
    },
    chatCharacterImage: {
        width: 190,
        height: 190,
    },

    // 내 말풍선 — 대사창 위, 오른쪽 정렬. 아래로 겹쳐서(peeking) 이전 대사창 뒤에 살짝 걸린 느낌을 낸다
    userBubbleWrap: {
        marginHorizontal: 20,
        alignItems: "flex-end",
    },
    userBubble: {
        maxWidth: "78%",
        backgroundColor: Colors.primary,
        borderWidth: 3,
        borderColor: Colors.textBlack,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        marginBottom: -6, // 아래 chatReplyBubble(테두리 4px)에 살짝 걸치도록
    },
    userBubbleText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.white,
    },

    // 식물 대화창 — 캐릭터 아래, 입력창 바로 위
    chatReplyBubble: {
        marginHorizontal: 20,
        marginBottom: Spacing.md,
        backgroundColor: Colors.white,
        borderWidth: 4,
        borderColor: Colors.textBlack,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    // 대화창 첫 줄 — 식물 이름 (메인 초록, 대사가 바뀌어도 고정)
    chatPlantName: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.primary,
        marginBottom: Spacing.xs,
    },
    chatReplyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        lineHeight: 26,
        color: Colors.textBlack,
    },

    // 입력 영역 (flex 컬럼 하단)
    chatInputArea: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Platform.OS === "ios" ? Spacing.sm : Spacing.xs,
        gap: Spacing.md,
    },
    chatInputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: GreenTint.haze,
        paddingLeft: Spacing.xs,
        paddingRight: Spacing.xs,
        paddingVertical: Spacing.xs,
    },
    chatCloseButton: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        alignItems: "center",
        justifyContent: "center",
        marginRight: Spacing.xs,
        marginBottom: Spacing.xxs,
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

    // ── 물주기 확인 모달 (픽셀 말풍선 카드) ──────────────
    confirmBackdrop: {
        flex: 1,
        backgroundColor: Colors.scrim,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: Spacing.xl,
    },
    confirmCard: {
        width: "100%",
        maxWidth: 320,
        backgroundColor: Paper.cream,
        borderWidth: 3,
        borderColor: Colors.primary,
        opacity: 0.9,
        paddingVertical: Spacing.xxl,
        paddingHorizontal: Spacing.xl,
        alignItems: "center",
    },
    confirmIcon: {
        width: 48,
        height: 48,
        marginBottom: Spacing.md,
    },
    confirmTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.primary,
        marginBottom: Spacing.sm,
    },
    confirmMessage: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        lineHeight: 26,
        color: Colors.textBlack,
        textAlign: "center",
        marginBottom: Spacing.xl,
    },
    confirmButtonRow: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    confirmButton: {
        flex: 1,
    },

    // ── 페르소나 선택 모달 (2열 그리드) ──────────────
    personaCard: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: Paper.cream,
        borderWidth: 3,
        borderColor: Colors.primary,
        opacity: 0.9,
        paddingVertical: Spacing.xxl,
        paddingHorizontal: Spacing.xl,
        alignItems: "center",
    },
    personaGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        width: "100%",
        gap: Spacing.md,
    },
    personaButton: {
        flexBasis: "47%",
        marginBottom: Spacing.sm,
    },
    // "장난꾸러기형"처럼 긴 라벨이 좁은 47% 칸에서 "형"만 다음 줄로 밀리는 걸 막기 위해
    // 기본 PixelButton 좌우 패딩(Spacing.xl)보다 줄임
    personaButtonContent: {
        paddingHorizontal: Spacing.sm,
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