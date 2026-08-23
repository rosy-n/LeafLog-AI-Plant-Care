import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ImageBackground,
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Animated,
    Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint, Accent, Glass } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { getCurrentEnvironment } from "../api";
// 홈 배경은 고정이다 — 꾸미기로 바뀌는 배경은 개체탭(PlantDetailScreen) 것이다
import { BACKGROUND_IMAGES, HOME_BACKGROUND_KEY } from "../data/decor";
// 캐릭터 이미지가 아직 S3에 없을 때의 번들 fallback (PlantImage 와 같은 출처)
import { plantImages } from "../data/plants";

const WEATHER_ICONS = {
    "맑음": require("../../assets/icons/sunny_icon.png"),
    "흐림": require("../../assets/icons/cloudy_icon.png"),
    "비": require("../../assets/icons/rainy_icon.png"),
    "눈": require("../../assets/icons/snow_icon.png"),
};

// 말풍선 안에 넣는 물방울 — 앱 전체가 쓰는 도트 물방울 아이콘
const WATER_DROP_ICON = require("../../assets/icons/water_icon.png");

const AIR_QUALITY_ICONS = {
    "좋음": require("../../assets/icons/air_good_icon.png"),
    "보통": require("../../assets/icons/air_moderate_icon.png"),
    "나쁨": require("../../assets/icons/air_bad_icon.png"),
    "매우나쁨": require("../../assets/icons/air_veryBad_icon.png"),
};

// 배경 이미지는 src/data/decor.js 가 단일 출처 (아래 FIELD_BOUNDS 의 키와 같다)

const HOME_MENU_ITEMS = [
    { label: "설정", icon: "settings-outline", screen: "Settings" },
];

/*
    배경마다 바닥(잔디/마룻바닥)이 시작하는 높이가 달라서 돌아다닐 영역도 따로 잡는다 —
    식물이 벽이나 하늘에 떠 있는 것처럼 보이지 않게 하기 위해.
*/
const FIELD_BOUNDS = {
    "home-bg": { top: "37%", bottom: "8%" },
    store_bg1: { top: "44%", bottom: "8%" },
    store_bg2: { top: "36%", bottom: "8%" },
};

// 들판에 동시에 세울 수 있는 개체 수 — 이보다 많으면 서로 겹쳐서 누가 누군지 알 수 없다
const MAX_FIELD_PLANTS = 7;

/*
    들판 자리 7개. 개체가 아니라 "자리"라서 어떤 식물이 뽑히든 같은 배치를 쓴다.
    startFx / startFy 는 들판 영역 안에서의 첫 위치(가로/세로 비율) —
    이후에는 무작위 목표 지점을 뽑아 스스로 이동한다.
    앞의 5자리는 예전 배치를 그대로 둬서, 개체가 5개 이하일 때 보이던 모습이 유지된다.
*/
const FIELD_SLOTS = [
    { width: 150, height: 150, startFx: 0.04, startFy: 0.06 },
    { width: 145, height: 165, startFx: 0.36, startFy: 0 },
    { width: 160, height: 160, startFx: 0.7,  startFy: 0.06 },
    { width: 175, height: 175, startFx: 0.14, startFy: 0.55 },
    { width: 180, height: 180, startFx: 0.55, startFy: 0.5 },
    { width: 150, height: 150, startFx: 0.82, startFy: 0.42 },
    { width: 150, height: 150, startFx: 0.34, startFy: 0.82 },
];

// 물 줄 때가 됐는가 — 정원탭 배지·알림(careNotices)과 같은 기준.
// 들판에 세울 개체를 고를 때와 말풍선을 띄울 때가 어긋나지 않게 한 곳에 둔다.
const needsWatering = (plant) =>
    plant.daysUntilWatering != null && plant.daysUntilWatering <= 0;

/*
    들판에 세울 개체를 고른다.

    물 줄 때가 된 개체가 먼저다 — 홈을 열었을 때 손이 필요한 식물이 눈에 들어와야 한다.
    남는 자리는 즐겨찾기로 채우고, 물 줄 개체가 없으면 즐겨찾기만 보인다.
    떠나보낸 개체(추모정원)는 들판에 세우지 않는다.
*/
function selectFieldPlants(plants) {
    const alive = plants.filter((plant) => !plant.memorial);

    const needsWater = alive
        .filter(needsWatering)
        // 더 오래 밀린 개체부터
        .sort((a, b) => a.daysUntilWatering - b.daysUntilWatering);

    const picked = needsWater.slice(0, MAX_FIELD_PLANTS);
    const pickedIds = new Set(picked.map((plant) => plant.id));

    if (picked.length < MAX_FIELD_PLANTS) {
        const favorites = alive
            .filter((plant) => plant.favorite && !pickedIds.has(plant.id))
            .sort((a, b) => Number(a.id) - Number(b.id));
        picked.push(...favorites.slice(0, MAX_FIELD_PLANTS - picked.length));
    }

    return picked;
}

/*
    한 번의 "통통" — 살짝 떠올라 앞으로 나아가고, 착지할 때 눌린다.
    여러 마리가 동시에 움직이면 쉽게 산만해져서, 한 번의 점프를 느리게 하고
    점프 사이·목표 도착 후에 충분히 쉬게 잡았다. 대부분의 순간에는
    한두 마리만 움직이고 나머지는 제자리에서 숨만 쉬는 상태가 된다.
*/
const HOP_RISE_MS = 300;   // 점프 상승
const HOP_FALL_MS = 260;   // 점프 하강
const HOP_LAND_MS = 200;   // 착지 눌림이 풀리는 시간
const HOP_HEIGHT = 12;     // 점프 높이(px)
const HOP_DISTANCE = 16;   // 한 번 뛸 때 나아가는 거리(px)
const HOP_GAP_MIN_MS = 320;  // 연속 점프 사이의 쉼
const HOP_GAP_MAX_MS = 900;
const REST_MIN_MS = 2200;  // 목표 지점 도착 후 쉬는 시간
const REST_MAX_MS = 5200;
// 한 번에 멀리 가지 않는다 — 들판을 횡단하듯 오래 뛰는 대신 근처를 어슬렁거린다
const TRIP_RANGE = 110;

/*
    물 줄 때가 된 개체 머리 위의 도트 말풍선 치수.

    DOT 한 칸이 도트 하나다 — 모든 치수를 이 배수로 잡아야 각진 모서리가 어긋나지 않는다.
    말풍선은 이미지 한 장이 아니라 사각형 View 를 쌓아서 만든다(WaterBubble 참고).
*/
const BUBBLE_DOT = 4;                                      // 도트 한 칸
const BUBBLE_SIZE = BUBBLE_DOT * 10;                       // 몸통 10칸 정사각 = 40
const BUBBLE_DROP = BUBBLE_DOT * 6;                        // 안에 들어가는 물방울 자리
const BUBBLE_CAP_INSET = BUBBLE_DOT * 2;                   // 위/아래 뚜껑이 들어간 깊이
const BUBBLE_TAIL_LEFT = BUBBLE_SIZE / 2 - BUBBLE_DOT * 2; // 꼬리를 몸통 가운데 아래에
const BUBBLE_TAIL_H = BUBBLE_DOT * 3;                      // 꼬리 3칸
const BUBBLE_H = BUBBLE_SIZE + BUBBLE_TAIL_H;

/*
    몸통 옆면의 도트 띠 — [들여쓴 칸 수, 띠의 칸 수].
    위 뚜껑 1칸 + 옆면 8칸 + 아래 뚜껑 1칸 = 10칸.
    들여쓰기가 1→0 한 단만 풀려서 모서리가 두 칸짜리 계단이 된다 —
    각진 사각형보다는 둥글고, 원형까지는 가지 않는 중간 정도.

    들여쓰기는 한 칸씩만 줄여야 한다 — 두 칸을 건너뛰면 위 띠의 외곽선이
    아래 띠의 흰 속을 덮지 못해 모서리에 구멍이 뚫린다(잔디가 비친다).
*/
const BUBBLE_BANDS = [
    { inset: 1, dots: 1 },
    { inset: 0, dots: 6 },
    { inset: 1, dots: 1 },
];

// 띠의 위치·크기는 렌더마다 계산하지 않고 도트 격자에서 미리 잡아 둔다
const BUBBLE_WALLS = (() => {
    const walls = [];
    let dot = 1; // 0번 칸은 위 뚜껑 자리
    for (const band of BUBBLE_BANDS) {
        walls.push({
            top: dot * BUBBLE_DOT,
            left: band.inset * BUBBLE_DOT,
            width: BUBBLE_SIZE - band.inset * BUBBLE_DOT * 2,
            height: band.dots * BUBBLE_DOT,
        });
        dot += band.dots;
    }
    return walls;
})();
// 꼬리 끝이 캐릭터 상자 안으로 이만큼 들어간다 — 도트 그림의 위쪽 투명 여백(12~18%)을
// 고려한 값이라, 잎에 닿지 않으면서도 머리에서 떠 보이지 않는다
const BUBBLE_OVERLAP = 12;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function HomeScreen({
    navigation,
    plants = [],
    hasUnread = false,
    urgentCount = 0,
}) {
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [environment, setEnvironment] = useState(null);
    const [fieldSize, setFieldSize] = useState({ width: 0, height: 0 });

    const fieldPlants = useMemo(() => selectFieldPlants(plants), [plants]);

    const menuAnimations = useRef(
        HOME_MENU_ITEMS.map(() => new Animated.Value(0))
    ).current;

    useEffect(() => {
        let cancelled = false;
        // 위치가 아직 설정되지 않았으면 서버가 400을 준다 — 이 경우 기본 아이콘을 그대로 둔다
        // (위치 설정은 회원가입/설정 화면에서 처리, 홈에서는 조용히 실패한다).
        getCurrentEnvironment()
            .then((result) => {
                if (!cancelled) setEnvironment(result);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    // environment가 아직 없으면(로딩 중이거나 위치 미설정 등으로 실패) 기본 아이콘을
    // 보여주지 않는다 — "흐림"이 실제 날씨처럼 오해될 수 있어서, 값이 있을 때만 표시.
    const weatherIconSource = environment
        ? WEATHER_ICONS[environment.weather_status] ?? WEATHER_ICONS["흐림"]
        : null;
    const airQualityIconSource = environment
        ? AIR_QUALITY_ICONS[environment.air_quality_status] ?? AIR_QUALITY_ICONS["보통"]
        : null;

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
                source={BACKGROUND_IMAGES[HOME_BACKGROUND_KEY]}
                resizeMode="cover"
                style={styles.background}
            >
                {/* 상단 왼쪽: 날씨, 미세먼지 — 탭하면 데이터 화면으로 이동 */}
                <View style={styles.topLeftArea}>
                    <GlassButton size={60} onPress={() => navigation.navigate("SensorData")}>
                        {weatherIconSource && (
                            <Image
                                source={weatherIconSource}
                                style={styles.weatherIcon}
                                resizeMode="contain"
                            />
                        )}
                    </GlassButton>

                    <GlassButton size={60} onPress={() => navigation.navigate("SensorData")}>
                        {airQualityIconSource && (
                            <Image
                                source={airQualityIconSource}
                                style={styles.weatherIcon}
                                resizeMode="contain"
                            />
                        )}
                    </GlassButton>
                </View>

                {/* 상단 오른쪽: 알림 */}
                <View style={styles.notificationArea}>
                    <GlassButton
                        size={65}
                        onPress={() => navigation.navigate("Notifications")}
                    >
                        <View>
                            <Image
                                source={require("../../assets/icons/notification_icon.png")}
                                style={styles.notificationIcon}
                                resizeMode="contain"
                            />
                            {hasUnread && <View style={styles.redDot} />}
                        </View>
                    </GlassButton>

                    {/*
                        밀린 물주기 요약 — 정원까지 들어가지 않아도 보이게.
                        빨간 점만으로는 몇 개가 밀렸는지 알 수 없다.
                    */}
                    {urgentCount > 0 ? (
                        <TouchableOpacity
                            style={styles.careSummary}
                            onPress={() => navigation.navigate("Notifications")}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.careSummaryText}>
                                물 줄 식물 {urgentCount}개
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/*
                    선택된 개체(최대 7개) — 초록 들판 영역 안에서만 통통 뛰어다닌다.
                    영역 크기를 알아야 이동 범위를 정할 수 있어서 onLayout 이후에 렌더한다.
                    pointerEvents="none": 메뉴 열림 상태에서 들판을 탭하면 메뉴가 닫히도록
                    터치를 아래 오버레이로 통과시킨다.
                */}
                <View
                    style={[
                        styles.field,
                        FIELD_BOUNDS[HOME_BACKGROUND_KEY],
                    ]}
                    pointerEvents="none"
                    onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;
                        setFieldSize((prev) =>
                            prev.width === width && prev.height === height
                                ? prev
                                : { width, height }
                        );
                    }}
                >
                    {fieldSize.width > 0 &&
                        fieldPlants.map((plant, index) => {
                            const slot = FIELD_SLOTS[index];
                            return (
                                <WanderingPlant
                                    key={plant.id}
                                    // 캐릭터 이미지 해석은 PlantImage 와 같은 규칙 —
                                    // S3 URL 이 있으면 원격, 없으면 번들 fallback
                                    source={
                                        plant.imageUri
                                            ? { uri: plant.imageUri }
                                            : plantImages[plant.imageKey ?? "spaghetti"]
                                    }
                                    width={slot.width}
                                    height={slot.height}
                                    startFx={slot.startFx}
                                    startFy={slot.startFy}
                                    field={fieldSize}
                                    startDelay={index * 260}
                                    needsWater={needsWatering(plant)}
                                />
                            );
                        })}
                </View>

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
                                                        Glass.frost72,
                                                        Glass.mist,
                                                        Glass.mistSoft,
                                                    ]}
                                                    start={{ x: 0.12, y: 0.05 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={styles.menuItemGlass}
                                                >
                                                    <View style={styles.menuItemHighlight} />
                                                    <Ionicons
                                                        name={item.icon}
                                                        size={14}
                                                        color={Colors.textBlack}
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
                        <Image
                            source={
                                menuOpen
                                    ? require("../../assets/icons/close_icon.png")
                                    : require("../../assets/icons/hamburger_icon.png")
                            }
                            style={styles.menuIcon}
                            resizeMode="contain"
                        />
                    </GlassButton>
                </View>

                {/* 우측 하단: 캘린더, 메모, 전체개체 */}
                <View style={styles.rightButtonArea}>
                    <GlassButton size={60} onPress={() => navigation.navigate("Calendar")}>
                        <Image
                            source={require("../../assets/icons/calendar_icon.png")}
                            style={styles.calendarIcon}
                            resizeMode="contain"
                        />
                    </GlassButton>

                    <GlassButton size={60}>
                        <Image
                            source={require("../../assets/icons/diary_icon.png")}
                            style={styles.diaryIcon}
                            resizeMode="contain"
                        />
                    </GlassButton>

                    <GlassButton
                        size={70}
                        onPress={() => navigation.navigate("Garden")}
                    >
                        <Image
                            source={require("../../assets/icons/all_icon.png")}
                            style={styles.allIcon}
                            resizeMode="contain"
                        />
                    </GlassButton>
                </View>
            </ImageBackground>
        </View>
    );
}

/*
    들판 안을 스스로 돌아다니는 식물 한 개체.

    걷기(등속 이동)가 아니라 "짧은 점프의 반복"으로 이동한다 —
    한 번의 점프마다 목표 지점 방향으로 HOP_DISTANCE 만큼만 나아가고,
    도착하면 잠깐 쉬었다가 새 목표 지점을 뽑는다.
    모든 애니메이션은 네이티브 드라이버로 돌린다.
*/
function WanderingPlant({
    source,
    width,
    height,
    field,
    startFx,
    startFy,
    startDelay,
    needsWater = false,
}) {
    // 이미지가 들판 밖으로 새지 않도록 크기만큼 뺀 이동 가능 범위
    const maxX = Math.max(0, field.width - width);
    const maxY = Math.max(0, field.height - height);

    // 화면 회전 등으로 들판 크기가 바뀌어도 목표 지점이 범위를 벗어나지 않게 최신 값을 참조한다
    const boundsRef = useRef({ maxX, maxY });
    boundsRef.current = { maxX, maxY };

    const startRef = useRef(null);
    if (startRef.current === null) {
        startRef.current = {
            x: clamp(startFx * field.width, 0, maxX),
            y: clamp(startFy * field.height, 0, maxY),
        };
    }

    const position = useRef(new Animated.ValueXY(startRef.current)).current;
    const lift = useRef(new Animated.Value(0)).current;    // 0=땅, 1=점프 정점
    const squash = useRef(new Animated.Value(1)).current;  // 도트 캐릭터 특유의 눌림/늘어남
    const facing = useRef(new Animated.Value(1)).current;  // 1=오른쪽, -1=왼쪽(좌우 반전)
    const breath = useRef(new Animated.Value(0)).current;  // 서 있을 때의 미세한 숨쉬기

    // 현재 좌표는 JS에서 따로 들고 있는다 — Animated.Value 내부값을 읽지 않기 위해
    const spot = useRef({ ...startRef.current }).current;

    // 아래쪽(=앞) 개체가 위에 그려지도록 y로 그리는 순서를 정한다
    const [depth, setDepth] = useState(Math.round(startRef.current.y));
    const depthRef = useRef(startRef.current.y);

    useEffect(() => {
        let cancelled = false;
        let timer = null;
        let running = null;
        let facingValue = 1;
        const target = { x: spot.x, y: spot.y };
        let arrived = true; // 시작하자마자 첫 목표를 뽑는다

        // 다음 목표는 지금 자리 근처에서 뽑는다 (들판을 가로지르지 않게)
        const pickTarget = () => {
            const bounds = boundsRef.current;
            target.x = clamp(spot.x + randomBetween(-TRIP_RANGE, TRIP_RANGE), 0, bounds.maxX);
            target.y = clamp(spot.y + randomBetween(-TRIP_RANGE, TRIP_RANGE), 0, bounds.maxY);
            arrived = false;
        };

        const hop = () => {
            if (cancelled) return;
            if (arrived) pickTarget();

            const dx = target.x - spot.x;
            const dy = target.y - spot.y;
            const distance = Math.hypot(dx, dy);

            // 목표 도착 — 잠깐 쉬고 다시 출발
            if (distance < 2) {
                arrived = true;
                timer = setTimeout(hop, randomBetween(REST_MIN_MS, REST_MAX_MS));
                return;
            }

            const step = Math.min(HOP_DISTANCE, distance);
            const nextX = spot.x + (dx / distance) * step;
            const nextY = spot.y + (dy / distance) * step;

            // 가는 방향을 보게 좌우 반전 (미세한 x 변화로는 뒤집지 않는다)
            if (Math.abs(dx) > 2) {
                const nextFacing = dx < 0 ? -1 : 1;
                if (nextFacing !== facingValue) {
                    facingValue = nextFacing;
                    facing.setValue(nextFacing);
                }
            }

            running = Animated.parallel([
                Animated.timing(position, {
                    toValue: { x: nextX, y: nextY },
                    duration: HOP_RISE_MS + HOP_FALL_MS,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.timing(lift, {
                        toValue: 1,
                        duration: HOP_RISE_MS,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(lift, {
                        toValue: 0,
                        duration: HOP_FALL_MS,
                        easing: Easing.in(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(squash, {
                        toValue: 1.04,
                        duration: HOP_RISE_MS,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(squash, {
                        toValue: 0.96,
                        duration: HOP_FALL_MS,
                        easing: Easing.in(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(squash, {
                        toValue: 1,
                        duration: HOP_LAND_MS,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]),
            ]);

            running.start(({ finished }) => {
                if (cancelled || !finished) return;
                spot.x = nextX;
                spot.y = nextY;
                // 그리는 순서는 눈에 보일 만큼 움직였을 때만 갱신한다(불필요한 리렌더 방지)
                if (Math.abs(nextY - depthRef.current) > 8) {
                    depthRef.current = nextY;
                    setDepth(Math.round(nextY));
                }
                // 다음 점프까지 한 박자 쉰다 — 연달아 뛰면 종종거리는 느낌이 난다
                timer = setTimeout(hop, randomBetween(HOP_GAP_MIN_MS, HOP_GAP_MAX_MS));
            });
        };

        // 개체들이 한 박자로 움직이지 않게 시작 시점을 넓게 흩뿌린다
        timer = setTimeout(hop, startDelay + randomBetween(0, 1600));

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            if (running) running.stop();
        };
    }, []);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(breath, {
                    toValue: 1,
                    duration: 1700,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(breath, {
                    toValue: 0,
                    duration: 1700,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    /*
        transform 노드는 한 번만 만든다 — depth 변경으로 리렌더될 때 애니메이션이 끊기지 않게.

        이동·점프는 바깥(개체 전체)에, 방향 전환과 눌림은 이미지에만 얹는다.
        한 덩어리로 두면 말풍선까지 좌우로 뒤집히고 착지할 때 함께 찌그러진다.
    */
    const moveTransform = useMemo(
        () => [
            ...position.getTranslateTransform(),
            {
                translateY: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -HOP_HEIGHT],
                }),
            },
        ],
        []
    );

    const bodyTransform = useMemo(
        () => [
            { scaleX: facing },
            { scaleY: squash },
            {
                scaleY: breath.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02],
                }),
            },
        ],
        []
    );

    return (
        <Animated.View
            style={[
                styles.fieldPlant,
                { width, height, zIndex: depth, transform: moveTransform },
            ]}
        >
            {needsWater && (
                // 캐릭터 상자 가운데 위 — 도트 그림은 상자 안에서 가로 중앙에 놓인다
                <WaterBubble left={(width - BUBBLE_SIZE) / 2} />
            )}
            <Animated.Image
                source={source}
                resizeMode="contain"
                style={{ width, height, transform: bodyTransform }}
            />
        </Animated.View>
    );
}

/*
    도트 말풍선 — "물 주세요".

    이미지 한 장이 아니라 사각형 View 를 도트 격자에 쌓아 만든다.
    잔디가 비쳐야 하니 모서리를 배경색 사각형으로 덮을 수 없어서, 외곽선을
    가로 띠로 나눠 그린다 — 각 띠의 좌우 보더가 옆면 외곽선이 되고, 띠마다
    한 칸씩 들여써서(BUBBLE_BANDS) 모서리가 계단처럼 깎인다.
    위/아래 뚜껑이 그 띠들의 천장과 바닥을 막고, 아래 뚜껑만 꼬리가 붙는
    두 칸을 비워서 말풍선 속과 꼬리 속이 이어지게 한다.
*/
function WaterBubble({ left }) {
    return (
        <View style={[styles.bubble, { left }]} pointerEvents="none">
            {/* 옆면 띠 — 좌우 외곽선 + 흰 속 */}
            {BUBBLE_WALLS.map((wall, index) => (
                <View key={index} style={[styles.bubbleWall, wall]} />
            ))}

            {/* 위 뚜껑 */}
            <View style={styles.bubbleCapTop} />
            {/* 아래 뚜껑 — 꼬리가 붙는 두 칸을 비워 둔 좌·우 토막 */}
            <View style={styles.bubbleCapBottomLeft} />
            <View style={styles.bubbleCapBottomRight} />
            {/* 비워 둔 칸을 흰색으로 이어 준다 — 없으면 몸통과 꼬리 사이로 잔디가 비친다 */}
            <View style={styles.bubbleMouth} />

            {/* 꼬리 3칸 — 한 칸씩 좁아지며 왼쪽 아래를 가리킨다 */}
            <View style={styles.bubbleTailTop} />
            <View style={styles.bubbleTailMid} />
            <View style={styles.bubbleTailTip} />

            <Image
                source={WATER_DROP_ICON}
                style={styles.bubbleDrop}
                resizeMode="contain"
            />
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
                        Glass.frost72,
                        Glass.mist,
                        Glass.mistSoft,
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

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: GreenTint.line,
    },
    background: {
        flex: 1,
    },

    topLeftArea: {
        position: "absolute",
        top: 72,
        left: 20,
        flexDirection: "row",
        gap: Spacing.lg,
        zIndex: 50,
    },
    notificationArea: {
        position: "absolute",
        top: 72,
        right: 20,
        zIndex: 50,
    },

    // 밀린 물주기 요약 (알림 버튼 아래)
    careSummary: {
        marginTop: Spacing.sm,
        alignSelf: "flex-end",
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Glass.frost72,
        borderWidth: 1,
        borderColor: Glass.frost45,
    },
    careSummaryText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    notificationIcon: {
        width: 44,
        height: 44,
    },
    redDot: {
        position: "absolute",
        top: -5,
        right: -5,
        width: 22,
        height: 22,
        borderRadius: Radius.md,
        backgroundColor: Accent.alert,
    },

    // 식물이 돌아다닐 수 있는 영역 — 위/아래 경계는 배경별로 FIELD_BOUNDS 에서 얹는다
    field: {
        position: "absolute",
        left: 8,
        right: 8,
        zIndex: 20,
    },
    fieldPlant: {
        position: "absolute",
        left: 0,
        top: 0,
    },

    /*
        도트 말풍선. 모든 조각은 말풍선 상자 기준의 절대 위치 —
        한 칸(BUBBLE_DOT) 격자에 맞춰야 모서리와 꼬리의 단이 어긋나지 않는다.
    */
    bubble: {
        position: "absolute",
        top: -(BUBBLE_H - BUBBLE_OVERLAP),
        width: BUBBLE_SIZE,
        height: BUBBLE_H,
    },
    // 위치·크기는 BUBBLE_WALLS 가 도트 격자에서 계산해 얹는다
    bubbleWall: {
        position: "absolute",
        backgroundColor: Colors.white,
        borderLeftWidth: BUBBLE_DOT,
        borderRightWidth: BUBBLE_DOT,
        borderColor: Colors.textBlack,
    },
    bubbleDrop: {
        position: "absolute",
        top: (BUBBLE_SIZE - BUBBLE_DROP) / 2,
        left: (BUBBLE_SIZE - BUBBLE_DROP) / 2,
        width: BUBBLE_DROP,
        height: BUBBLE_DROP,
    },
    bubbleCapTop: {
        position: "absolute",
        top: 0,
        left: BUBBLE_CAP_INSET,
        width: BUBBLE_SIZE - BUBBLE_CAP_INSET * 2,
        height: BUBBLE_DOT,
        backgroundColor: Colors.textBlack,
    },
    bubbleCapBottomLeft: {
        position: "absolute",
        top: BUBBLE_SIZE - BUBBLE_DOT,
        left: BUBBLE_CAP_INSET,
        width: BUBBLE_TAIL_LEFT + BUBBLE_DOT - BUBBLE_CAP_INSET,
        height: BUBBLE_DOT,
        backgroundColor: Colors.textBlack,
    },
    bubbleCapBottomRight: {
        position: "absolute",
        top: BUBBLE_SIZE - BUBBLE_DOT,
        left: BUBBLE_TAIL_LEFT + BUBBLE_DOT * 3,
        width: BUBBLE_SIZE - BUBBLE_CAP_INSET - BUBBLE_TAIL_LEFT - BUBBLE_DOT * 3,
        height: BUBBLE_DOT,
        backgroundColor: Colors.textBlack,
    },
    bubbleMouth: {
        position: "absolute",
        top: BUBBLE_SIZE - BUBBLE_DOT,
        left: BUBBLE_TAIL_LEFT + BUBBLE_DOT,
        width: BUBBLE_DOT * 2,
        height: BUBBLE_DOT,
        backgroundColor: Colors.white,
    },
    bubbleTailTop: {
        position: "absolute",
        top: BUBBLE_SIZE,
        left: BUBBLE_TAIL_LEFT,
        width: BUBBLE_DOT * 4,
        height: BUBBLE_DOT,
        backgroundColor: Colors.white,
        borderLeftWidth: BUBBLE_DOT,
        borderRightWidth: BUBBLE_DOT,
        borderColor: Colors.textBlack,
    },
    bubbleTailMid: {
        position: "absolute",
        top: BUBBLE_SIZE + BUBBLE_DOT,
        left: BUBBLE_TAIL_LEFT,
        width: BUBBLE_DOT * 3,
        height: BUBBLE_DOT,
        backgroundColor: Colors.white,
        borderLeftWidth: BUBBLE_DOT,
        borderRightWidth: BUBBLE_DOT,
        borderColor: Colors.textBlack,
    },
    bubbleTailTip: {
        position: "absolute",
        top: BUBBLE_SIZE + BUBBLE_DOT * 2,
        left: BUBBLE_TAIL_LEFT,
        width: BUBBLE_DOT * 2,
        height: BUBBLE_DOT,
        backgroundColor: Colors.textBlack,
    },

    menuArea: {
        position: "absolute",
        left: 20,
        bottom: 54,
        zIndex: 50,
    },
    menuIcon: {
        width: 36,
        height: 36,
    },
    calendarIcon: {
        width: 36,
        height: 36,
    },
    diaryIcon: {
        width: 35,
        height: 35,
    },
    rightButtonArea: {
        position: "absolute",
        right: 20,
        bottom: 46,
        alignItems: "center",
        gap: Spacing.lg,
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
        marginBottom: Spacing.sm,
    },
    menuItemTouch: {
        width: 126,
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
        flexDirection: "row",
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
    menuItemIcon: {
        marginRight: Spacing.xs,
    },
    menuItemText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        textShadowColor: Glass.frost60,
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 0,
    },

    glassTouch: {
        overflow: "hidden",
        shadowColor: GreenTint.deep,
        shadowOpacity: 0.2,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    glassBlur: {
        flex: 1,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: Glass.frost72,
    },
    glassGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: Glass.frost45,
    },
    glassHighlight: {
        position: "absolute",
        top: 9,
        left: 12,
        width: "38%",
        height: "20%",
        borderRadius: Radius.pill,
        backgroundColor: Glass.frost60,
    },

    weatherIcon: {
        width: 40,
        height: 40,
    },


    allIcon: {
        width: 42,
        height: 42,
    },
});
