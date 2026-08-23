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
    PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
    원근 — 들판 위쪽(멀리)으로 간 개체는 작게, 아래쪽(가까이)은 크게 보인다.
    바닥면을 비스듬히 내려다보는 배경이라 크기가 같으면 위쪽 개체가 붕 떠 보인다.

    배율은 개체의 발끝이 들판 안에서 얼마나 아래에 있는지로 정한다 —
    상자 크기가 자리마다 달라도(150~180) 같은 높이에 선 개체는 같은 배율이 된다.
*/
const PERSPECTIVE_FAR = 0.74;    // 가장 멀리(띠 위쪽)에서의 배율. 가장 가까이는 1
const PLANT_FEET_RATIO = 0.846;  // 도트 그림에서 발끝이 오는 높이 비율 (에셋 5종 실측)
/*
    배율을 매기는 "발끝 띠" — 들판 높이 대비 비율.

    상자가 150~180px 이라 개체가 들판 맨 위에 서도 발끝은 들판의 1/3 지점쯤에 온다.
    그래서 들판 전체(0~1)에 배율을 펼치면 실제로 쓰이는 구간이 좁아 원근이 거의
    보이지 않는다. 발끝이 실제로 갈 수 있는 범위에 맞춰 띠를 좁게 잡는다.
    띠는 모든 개체가 같은 값을 쓰므로 "같은 높이 = 같은 배율" 은 그대로 유지된다.
*/
const PERSPECTIVE_BAND_TOP = 0.26;
const PERSPECTIVE_BAND_BOTTOM = 0.96;

/*
    길게 눌러 개체를 들어올린다.
    들고 있는 동안은 어슬렁거리기를 멈추고 손가락을 따라오며,
    하단 중앙 돋보기의 렌즈에 놓으면 그 개체의 개체탭으로 넘어간다.
*/
const HOLD_DELAY_MS = 300;    // 이만큼 누르고 있으면 들어올린다
const HOLD_CANCEL_MOVE = 12;  // 들어올리기 전에 이만큼 움직이면 취소(스치듯 지나간 터치)
const HOLD_LIFT = 26;         // 들려 있을 때 떠오르는 높이(px)
const HOLD_SCALE = 1.1;       // 들려 있을 때 커지는 배율
const HOLD_Z = 9999;          // 들고 있는 개체는 다른 개체·돋보기보다 앞에 그린다
const HOLD_RESUME_MS = 900;   // 놓은 뒤 다시 어슬렁거리기 시작할 때까지
const PLANT_SHADOW_H = 10;    // 들려 있을 때 발밑에 남는 그림자 높이

/*
    하단 중앙의 돋보기 — 개체를 놓는 자리.

    도트 아이콘 안에서 렌즈 구멍이 가운데가 아니라 왼쪽 위로 치우쳐 있어서
    (손잡이가 오른쪽 아래로 뻗는다) 판정 좌표를 아이콘 실측값으로 잡는다:
    1254px 캔버스에서 구멍 중심이 (0.447, 0.392), 반지름이 0.243.
    구멍이 투명해서 캐릭터를 겹치면 렌즈 안에 비쳐 보인다.
*/
const MAGNIFIER_ICON = require("../../assets/icons/magnifier_icon.png");
const MAG_SIZE = 168;
const MAG_BOTTOM = 4;                     // 들판 아래 경계에서 띄우는 높이
const MAG_LENS_X = MAG_SIZE * 0.447;
const MAG_LENS_Y = MAG_SIZE * 0.392;
const MAG_LENS_R = MAG_SIZE * 0.243;
// 구멍보다 넉넉하게 받는다 — 캐릭터가 크고 손가락으로 정확히 겨냥하기는 어렵다
const MAG_HIT_R = MAG_LENS_R + 30;
const MAG_Z = 2000;                       // 다른 개체(zIndex = 들판 안 y좌표)보다 앞에

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

    // 길게 눌러 들어올린 개체 — 이때만 하단 중앙에 돋보기가 나타난다
    const [heldPlantId, setHeldPlantId] = useState(null);
    // 들고 있는 개체가 렌즈에 닿았는지 (돋보기를 키워 놓아도 되는 순간을 알린다)
    const [overLens, setOverLens] = useState(false);

    /*
        렌즈 판정 좌표. 돋보기를 들판 안에 놓기 때문에 개체 좌표와 같은 좌표계에서
        바로 계산된다 — 화면 좌표로 옮겨 재는 과정(measure)이 필요 없다.
    */
    const lens = useMemo(() => {
        if (fieldSize.width === 0) return null;
        return {
            x: (fieldSize.width - MAG_SIZE) / 2 + MAG_LENS_X,
            y: fieldSize.height - MAG_BOTTOM - MAG_SIZE + MAG_LENS_Y,
        };
    }, [fieldSize]);

    // 드래그 중에는 리렌더를 거치지 않고 최신 값을 봐야 한다
    const lensRef = useRef(lens);
    lensRef.current = lens;

    const isInLens = (center) => {
        const target = lensRef.current;
        if (!target) return false;
        return Math.hypot(center.x - target.x, center.y - target.y) <= MAG_HIT_R;
    };

    const handlePickUp = (plant) => (center) => {
        setHeldPlantId(plant.id);
        setOverLens(isInLens(center));
    };

    // 손가락이 움직일 때마다 불리지만, 값이 그대로면 setState 가 리렌더를 만들지 않는다
    const handleDragMove = (center) => setOverLens(isInLens(center));

    // 렌즈에 놓았으면 true — 개체는 집어올린 자리로 돌아간다(WanderingPlant 가 처리)
    const handleDrop = (plant) => (center) => {
        setHeldPlantId(null);
        setOverLens(false);
        if (!isInLens(center)) return false;
        navigation.navigate("PlantDetail", { plant });
        return true;
    };

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

                    pointerEvents: 메뉴가 열려 있으면 "none" — 들판을 탭하면 터치가 아래
                    오버레이로 통과해 메뉴가 닫힌다. 닫혀 있으면 "box-none" 으로 바꿔서
                    들판 자체는 터치를 받지 않고 개체만 길게 눌러 옮길 수 있게 한다.
                */}
                <View
                    style={[
                        styles.field,
                        FIELD_BOUNDS[HOME_BACKGROUND_KEY],
                    ]}
                    pointerEvents={menuOpen ? "none" : "box-none"}
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
                                    onPickUp={handlePickUp(plant)}
                                    onDragMove={handleDragMove}
                                    onDrop={handleDrop(plant)}
                                />
                            );
                        })}

                    {/*
                        개체를 들고 있는 동안에만 나타나는 돋보기 — 렌즈에 놓으면 개체탭으로.
                        들고 있는 개체가 목록에서 사라진 경우(목록 갱신)에도 같이 사라지게
                        들판에 남아 있는지 함께 확인한다 — 그러지 않으면 놓을 일이 없어
                        돋보기만 남는다.
                    */}
                    {fieldPlants.some((plant) => plant.id === heldPlantId) && (
                        <MagnifierDropTarget active={overLens} />
                    )}
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
    onPickUp,
    onDragMove,
    onDrop,
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
    const hold = useRef(new Animated.Value(0)).current;    // 0=땅, 1=손에 들려 공중에 떠 있음

    // 현재 좌표는 JS에서 따로 들고 있는다 — Animated.Value 내부값을 읽지 않기 위해
    const spot = useRef({ ...startRef.current }).current;

    // 아래쪽(=앞) 개체가 위에 그려지도록 y로 그리는 순서를 정한다
    const [depth, setDepth] = useState(Math.round(startRef.current.y));
    const depthRef = useRef(startRef.current.y);

    /*
        들려 있는 상태 — 제스처 핸들러(ref)와 그리기(state) 양쪽에서 봐야 해서 둘 다 둔다.
        어슬렁거리기의 타이머·진행 중인 점프도 들어올리는 순간 끊어야 해서 ref 로 들고 있다.
    */
    const [held, setHeld] = useState(false);
    const heldRef = useRef(false);
    const holdTimerRef = useRef(null);   // 길게 누르기 판정 타이머
    const timerRef = useRef(null);       // 다음 점프까지의 대기
    const animRef = useRef(null);        // 진행 중인 점프
    const resumeWander = useRef(null);   // 어슬렁거리기 재시작 (아래 effect 안에서 채운다)
    const dragBase = useRef({ x: 0, y: 0 });    // 끌기 시작한 자리
    const pickUpSpot = useRef({ x: 0, y: 0 });  // 집어올린 자리 (개체탭으로 넘어가면 여기로 돌린다)

    // 렌즈 판정은 개체의 중심으로 한다 — 손가락이 어디를 잡았든 캐릭터가 렌즈에 오면 된다
    const centerOf = (at) => ({ x: at.x + width / 2, y: at.y + height / 2 });

    useEffect(() => {
        let cancelled = false;
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
            // 들려 있는 동안은 멈춘다 — 놓을 때 resumeWander 로 다시 시작한다
            if (cancelled || heldRef.current) return;
            if (arrived) pickTarget();

            const dx = target.x - spot.x;
            const dy = target.y - spot.y;
            const distance = Math.hypot(dx, dy);

            // 목표 도착 — 잠깐 쉬고 다시 출발
            if (distance < 2) {
                arrived = true;
                timerRef.current = setTimeout(hop, randomBetween(REST_MIN_MS, REST_MAX_MS));
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

            animRef.current = Animated.parallel([
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

            animRef.current.start(({ finished }) => {
                // 들어올려서 중간에 끊은 경우도 finished=false 로 들어온다
                if (cancelled || !finished) return;
                spot.x = nextX;
                spot.y = nextY;
                // 그리는 순서는 눈에 보일 만큼 움직였을 때만 갱신한다(불필요한 리렌더 방지)
                if (Math.abs(nextY - depthRef.current) > 8) {
                    depthRef.current = nextY;
                    setDepth(Math.round(nextY));
                }
                // 다음 점프까지 한 박자 쉰다 — 연달아 뛰면 종종거리는 느낌이 난다
                timerRef.current = setTimeout(hop, randomBetween(HOP_GAP_MIN_MS, HOP_GAP_MAX_MS));
            });
        };

        /*
            놓은 뒤 다시 어슬렁거리기 시작한다.
            목표 지점을 새로 뽑게 해서(arrived) 옮겨 놓은 자리에서 바로 예전 목표로
            멀리 떠나지 않게 한다.
        */
        resumeWander.current = (delay) => {
            arrived = true;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(hop, delay);
        };

        // 개체들이 한 박자로 움직이지 않게 시작 시점을 넓게 흩뿌린다
        timerRef.current = setTimeout(hop, startDelay + randomBetween(0, 1600));

        return () => {
            cancelled = true;
            resumeWander.current = null;
            if (timerRef.current) clearTimeout(timerRef.current);
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            if (animRef.current) animRef.current.stop();
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
        길게 눌러 들어올린다.

        점프 도중이었으면 애니메이션을 끊고 마지막으로 착지한 자리(spot)로 맞춘다 —
        Animated 값 내부를 읽지 않고 JS 가 들고 있는 좌표를 기준으로 삼기 위해서다.
        한 번의 점프는 16px 이라 이 정도 어긋남은 눈에 띄지 않는다.
    */
    const beginHold = () => {
        holdTimerRef.current = null;
        heldRef.current = true;
        setHeld(true);

        if (timerRef.current) clearTimeout(timerRef.current);
        if (animRef.current) animRef.current.stop();
        position.setValue({ x: spot.x, y: spot.y });
        lift.setValue(0);
        squash.setValue(1);

        dragBase.current = { x: spot.x, y: spot.y };
        pickUpSpot.current = { x: spot.x, y: spot.y };

        Animated.spring(hold, {
            toValue: 1,
            tension: 140,
            friction: 9,
            useNativeDriver: true,
        }).start();
        // 길게 누른 게 먹혔다는 걸 손으로 알려준다 (개체탭의 물주기와 같은 방식)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPickUp?.(centerOf(spot));
    };

    const dragTo = (dx, dy) => {
        const bounds = boundsRef.current;
        const nextX = clamp(dragBase.current.x + dx, 0, bounds.maxX);
        const nextY = clamp(dragBase.current.y + dy, 0, bounds.maxY);

        spot.x = nextX;
        spot.y = nextY;
        position.setValue({ x: nextX, y: nextY });
        /*
            그리는 순서(depth)는 놓을 때 한 번만 반영한다 —
            끌고 있는 동안은 어차피 맨 앞(HOLD_Z)이라 지금 바꿔도 보이지 않고,
            state 를 건드리면 손가락이 움직이는 내내 리렌더가 된다.
        */
        depthRef.current = nextY;
        onDragMove?.(centerOf(spot));
    };

    const endHold = () => {
        // 길게 누르기 전에 손을 뗐으면 아무 일도 없었던 것으로 (짧은 탭)
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        if (!heldRef.current) return;

        heldRef.current = false;
        setHeld(false);
        Animated.spring(hold, {
            toValue: 0,
            tension: 150,
            friction: 11,
            useNativeDriver: true,
        }).start();

        // 렌즈에 놓았으면 부모가 개체탭으로 넘긴다 — 그때는 집어올린 자리로 돌려놓는다
        // (돌아왔을 때 개체들이 돋보기 앞에 몰려 있지 않게)
        if (onDrop?.(centerOf(spot))) {
            spot.x = pickUpSpot.current.x;
            spot.y = pickUpSpot.current.y;
            Animated.timing(position, {
                toValue: { ...pickUpSpot.current },
                duration: 240,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start();
        }

        // 끌고 있는 동안 미뤄 둔 그리는 순서를 여기서 한 번 맞춘다
        depthRef.current = spot.y;
        setDepth(Math.round(spot.y));
        resumeWander.current?.(HOLD_RESUME_MS);
    };

    /*
        PanResponder 는 첫 렌더의 클로저를 그대로 들고 있으므로,
        핸들러는 매 렌더 갱신되는 ref 를 거쳐 부른다 (자리 크기·부모 콜백이 바뀔 수 있다).
    */
    const gesture = useRef({});
    gesture.current = {
        beginHold,
        endHold,
        move: (gestureState) => {
            if (!heldRef.current) {
                // 들어올리기 전에 움직였으면 길게 누르기를 취소한다
                if (
                    holdTimerRef.current &&
                    Math.hypot(gestureState.dx, gestureState.dy) > HOLD_CANCEL_MOVE
                ) {
                    clearTimeout(holdTimerRef.current);
                    holdTimerRef.current = null;
                }
                return;
            }
            dragTo(gestureState.dx, gestureState.dy);
        },
    };

    const responder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            // 들고 있는 동안에는 다른 곳에 터치를 넘기지 않는다
            onPanResponderTerminationRequest: () => !heldRef.current,
            onPanResponderGrant: () => {
                holdTimerRef.current = setTimeout(
                    () => gesture.current.beginHold(),
                    HOLD_DELAY_MS
                );
            },
            onPanResponderMove: (_event, gestureState) => gesture.current.move(gestureState),
            onPanResponderRelease: () => gesture.current.endHold(),
            onPanResponderTerminate: () => gesture.current.endHold(),
        })
    ).current;

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

    /*
        원근 배율 — 들판 안 발끝 높이(position.y + 발끝 오프셋)로 정한다.

        scale 은 상자 중심을 기준으로 걸리기 때문에 작아지면 발끝이 위로 떠오른다.
        그만큼 translateY 로 되밀어 발끝을 땅에 붙여 둔다 (translate 를 배율보다
        앞에 두어야 배율의 영향을 받지 않는다).

        자리 크기나 들판 높이가 바뀔 때만 다시 만든다 — 리렌더마다 새로 만들면
        네이티브 애니메이션 노드가 매번 갈린다.
    */
    const perspective = useMemo(() => {
        // position.y 는 상자 위쪽이라, 발끝 띠를 상자 좌표로 옮겨서 입력 범위로 쓴다
        const feet = height * PLANT_FEET_RATIO;
        const alongField = {
            inputRange: [
                PERSPECTIVE_BAND_TOP * field.height - feet,
                Math.max(
                    PERSPECTIVE_BAND_TOP * field.height - feet + 1,
                    PERSPECTIVE_BAND_BOTTOM * field.height - feet
                ),
            ],
            extrapolate: "clamp",
        };
        return {
            scale: position.y.interpolate({
                ...alongField,
                outputRange: [PERSPECTIVE_FAR, 1],
            }),
            keepFeetOnGround: position.y.interpolate({
                ...alongField,
                outputRange: [(1 - PERSPECTIVE_FAR) * (PLANT_FEET_RATIO - 0.5) * height, 0],
            }),
        };
    }, [height, field.height]);

    // 들어올림·원근은 캐릭터와 말풍선을 함께 — 말풍선만 남으면 머리에서 떨어져 보인다
    const bodyLayerTransform = useMemo(
        () => [
            { translateY: perspective.keepFeetOnGround },
            {
                translateY: hold.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -HOLD_LIFT],
                }),
            },
            {
                scale: hold.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, HOLD_SCALE],
                }),
            },
            { scale: perspective.scale },
        ],
        [perspective]
    );

    return (
        <Animated.View
            style={[
                styles.fieldPlant,
                {
                    width,
                    height,
                    zIndex: held ? HOLD_Z : depth,
                    transform: moveTransform,
                },
            ]}
            {...responder.panHandlers}
        >
            {/*
                발밑 그림자 — 들려 있는 동안만 보인다. 떠오르는 몸통과 달리 바닥에
                남아 있어야 "떠 있다"로 읽힌다(그래서 몸통 레이어 밖에 둔다).
                상자 중심이 발끝 지점에 오도록 잡아서, 원근 배율을 걸어도 제자리에 있다.
            */}
            <Animated.View
                style={[
                    styles.plantShadow,
                    {
                        width: width * 0.3,
                        left: width * 0.35,
                        top: height * PLANT_FEET_RATIO - PLANT_SHADOW_H / 2,
                        opacity: hold.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.85],
                        }),
                        transform: [
                            {
                                scaleX: hold.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.7, 1],
                                }),
                            },
                            { scale: perspective.scale },
                        ],
                    },
                ]}
                pointerEvents="none"
            />

            <Animated.View style={{ transform: bodyLayerTransform }} pointerEvents="none">
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
        </Animated.View>
    );
}

/*
    하단 중앙의 돋보기 — 개체를 들고 있는 동안에만 나타나는 "놓는 자리".

    렌즈 구멍이 투명한 도트 아이콘이라 캐릭터를 겹치면 렌즈 안에 비쳐 보인다.
    active(렌즈에 닿음)면 아이콘만 살짝 커진다 — 상자째 키우면 렌즈 중심이 움직여
    판정 좌표(MAG_LENS_*)와 어긋난다.
*/
function MagnifierDropTarget({ active }) {
    const appear = useRef(new Animated.Value(0)).current;
    const focus = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(appear, {
            toValue: 1,
            tension: 130,
            friction: 9,
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        Animated.timing(focus, {
            toValue: active ? 1 : 0,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [active]);

    return (
        <Animated.View
            style={[
                styles.magnifier,
                {
                    opacity: appear,
                    transform: [
                        {
                            translateY: appear.interpolate({
                                inputRange: [0, 1],
                                outputRange: [18, 0],
                            }),
                        },
                    ],
                },
            ]}
            pointerEvents="none"
        >
            <View style={styles.magnifierHint}>
                <Text style={styles.magnifierHintText}>
                    {active ? "놓으면 자세히 보기" : "여기에 놓아 자세히 보기"}
                </Text>
            </View>
            <Animated.Image
                source={MAGNIFIER_ICON}
                resizeMode="contain"
                style={[
                    styles.magnifierIcon,
                    {
                        transform: [
                            {
                                scale: focus.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.14],
                                }),
                            },
                        ],
                    },
                ]}
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
    // 들려 있는 개체의 발밑 그림자 (위치·크기는 개체 상자 크기에서 얹는다)
    plantShadow: {
        position: "absolute",
        height: PLANT_SHADOW_H,
        borderRadius: Radius.pill,
        backgroundColor: Colors.scrim,
    },

    // 하단 중앙 돋보기 — 들판 안에 두어서 렌즈 판정과 그려지는 자리가 어긋나지 않는다
    magnifier: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: MAG_BOTTOM,
        alignItems: "center",
        zIndex: MAG_Z,
    },
    magnifierIcon: {
        width: MAG_SIZE,
        height: MAG_SIZE,
    },
    magnifierHint: {
        marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Glass.frost72,
        borderWidth: 1,
        borderColor: Glass.frost45,
    },
    magnifierHintText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textBlack,
        includeFontPadding: false,
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
