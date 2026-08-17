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
// 꾸미기(item_key 기반)로 바뀌는 배경은 개체탭(PlantDetailScreen) 것 — 홈은 날씨로만 바뀐다
import { BACKGROUND_IMAGES, HOME_BACKGROUND_KEY } from "../data/decor";

const WEATHER_ICONS = {
    "맑음": require("../../assets/icons/sunny_icon.png"),
    "흐림": require("../../assets/icons/cloudy_icon.png"),
    "비": require("../../assets/icons/rainy_icon.png"),
    "눈": require("../../assets/icons/snow_icon.png"),
};

// 날씨별 홈 배경 — API 응답 전이거나 모르는 상태값이면 기본 배경(맑음=home-bg)을 그대로 쓴다
const WEATHER_BACKGROUNDS = {
    "맑음": BACKGROUND_IMAGES[HOME_BACKGROUND_KEY],
    "흐림": require("../../assets/images/home-bg-cloudy.png"),
    "비": require("../../assets/images/home-bg-rain.png"),
    "눈": require("../../assets/images/home-bg-snow.png"),
};

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

/*
    들판을 돌아다니는 식물 5개.
    startFx / startFy 는 들판 영역 안에서의 첫 위치(가로/세로 비율) —
    이후에는 무작위 목표 지점을 뽑아 스스로 이동한다.
*/
const FIELD_PLANTS = [
    {
        key: "rubber",
        source: require("../../assets/plants/rubber.png"),
        width: 150,
        height: 150,
        startFx: 0.04,
        startFy: 0.06,
    },
    {
        key: "sansevieria",
        source: require("../../assets/plants/sansevieria.png"),
        width: 145,
        height: 165,
        startFx: 0.36,
        startFy: 0,
    },
    {
        key: "spaghetti",
        source: require("../../assets/plants/spaghetti.png"),
        width: 160,
        height: 160,
        startFx: 0.7,
        startFy: 0.06,
    },
    {
        key: "pachira",
        source: require("../../assets/plants/pachira.png"),
        width: 175,
        height: 175,
        startFx: 0.14,
        startFy: 0.55,
    },
    {
        key: "myeongrani",
        source: require("../../assets/plants/myeongrani.png"),
        width: 180,
        height: 180,
        startFx: 0.55,
        startFy: 0.5,
    },
];

/*
    한 번의 "통통" — 살짝 떠올라 앞으로 나아가고, 착지할 때 눌린다.
    5마리가 동시에 움직이면 쉽게 산만해져서, 한 번의 점프를 느리게 하고
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

const randomBetween = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function HomeScreen({
    navigation,
    hasUnread = false,
    urgentCount = 0,
}) {
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [environment, setEnvironment] = useState(null);
    const [fieldSize, setFieldSize] = useState({ width: 0, height: 0 });

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
    const homeBackgroundSource =
        WEATHER_BACKGROUNDS[environment?.weather_status] ?? BACKGROUND_IMAGES[HOME_BACKGROUND_KEY];

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
                source={homeBackgroundSource}
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
                    식물 5개 — 초록 들판 영역 안에서만 통통 뛰어다닌다.
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
                        FIELD_PLANTS.map((plant, index) => (
                            <WanderingPlant
                                key={plant.key}
                                source={plant.source}
                                width={plant.width}
                                height={plant.height}
                                startFx={plant.startFx}
                                startFy={plant.startFy}
                                field={fieldSize}
                                startDelay={index * 260}
                            />
                        ))}
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
function WanderingPlant({ source, width, height, field, startFx, startFy, startDelay }) {
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

        // 5개가 한 박자로 움직이지 않게 시작 시점을 넓게 흩뿌린다
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

    // transform 노드는 한 번만 만든다 — depth 변경으로 리렌더될 때 애니메이션이 끊기지 않게
    const transform = useMemo(
        () => [
            ...position.getTranslateTransform(),
            {
                translateY: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -HOP_HEIGHT],
                }),
            },
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
        <Animated.Image
            source={source}
            resizeMode="contain"
            style={[styles.fieldPlant, { width, height, zIndex: depth, transform }]}
        />
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
