import React, { useRef, useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getPlant } from "../api";
import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint, Pink, Warm, Accent, Gauge } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";

const CARE_SECTIONS = [
    { key: "plantInfo", label: "식물정보" },
    { key: "watering", label: "물주기" },
    { key: "sunlight", label: "햇빛" },
    { key: "temperature", label: "온습도" },
    { key: "fertilizer", label: "영양제" },
    { key: "soil", label: "토양&분갈이" },
    { key: "toxicity", label: "독성" },
    { key: "feature", label: "특성" },
    { key: "pest", label: "문제와 해충" },
];

const NO_DATA = "아직 자료가 없어요";

// 특징(설명) 접기 — 접었을 때 보여줄 줄 수와, '더 보기' 를 붙일 글자 수 기준.
// 카드 폭에서 한 줄이 대략 22~25자라 3줄이면 70자 안팎이고, 그보다 넉넉히 잡아
// 실제로 잘리는 경우에만 버튼이 나오게 한다.
const DESCRIPTION_COLLAPSED_LINES = 3;
const DESCRIPTION_COLLAPSE_THRESHOLD = 100;


// 온·습도 막대의 표시 구간 (0~30°C, 0~100%)
const TEMP_AXIS_MAX = 30;
const HUMIDITY_AXIS_MAX = 100;

// 막대에서 [min, max] 구간이 차지할 left/width (%)
//
// 수치 라벨은 막대 안에 넣지 않는다 — 적정 온도는 21~25°C 처럼 폭이 좁은 경우가 많아
// (0~30°C 축에서 13%) 글자가 막대 밖으로 삐져나와 구간이 잘못 그려진 것처럼 보인다.
function rangeStyle(min, max, axisMax) {
    if (min == null && max == null) return null;
    const low = Math.max(0, Math.min(Number(min ?? max), axisMax));
    const high = Math.max(low, Math.min(Number(max ?? min), axisMax));
    const left = (low / axisMax) * 100;
    // 상·하한이 같은 종은 폭이 0이라 아예 안 보이므로 최소 3% 만 확보
    const width = Math.max(((high - low) / axisMax) * 100, 3);
    return { left: `${Math.min(left, 100 - width)}%`, width: `${width}%` };
}

/*
    축 위의 한 점이 놓일 left (%) — 겨울 최저 온도 표시선에 쓴다.

    겨울 최저는 적정 온도와 같은 온도 축의 값이라 같은 막대에 얹는다.
    자료(190종)를 보면 값이 5·7·10·13°C 네 가지뿐이고 모두 0~30°C 안에 들며,
    항상 적정 최저보다 3°C 이상 낮아서 구간과 겹치지 않는다.
*/
function markerStyle(value, axisMax) {
    if (value == null) return null;
    const at = Math.max(0, Math.min(Number(value), axisMax));
    return { left: `${(at / axisMax) * 100}%` };
}

// 광원 요구도 → 사람이 읽는 문장 (원문 라벨이 있으면 그걸 우선)
// 광도 단계 — 약한 쪽부터 강한 쪽 순서. 이모지도 같은 순서로 밝아진다.
//
// 농사로 원문 라벨은 "중간 광도(800~1,500 Lux),높은 광도(1,500~10,000 Lux)" 처럼
// 코드가 콤마로 이어져 그대로 보여주면 읽기 어렵다. 한 단계로 정리해 보여준다.
//
// 판정 기준은 최소 광량이다 — "얼마나 어두운 곳까지 견디는가" 가 두는 자리를 정하기 때문.
// 최대 광량은 212종 중 207종이 10,000 Lux 로 같아 구분에 쓸 수 없다.
const LIGHT_STEPS = {
    SHADE: { emoji: "☁️", title: "어두운 곳에서도 잘 자라요", place: "음지도 가능" },
    HALF: { emoji: "⛅", title: "밝은 간접광이 좋아요", place: "반양지" },
    SUN: { emoji: "☀️", title: "햇빛이 잘 드는 곳에 두세요", place: "양지" },
};

// 농사로 광도 코드 경계 (Lux) — 낮은 300~800 / 중간 800~1,500 / 높은 1,500~10,000
const LUX_LOW_MAX = 800;
const LUX_HIGH_MIN = 1500;

// 종의 광도 정보 → { emoji, title, place, caution }. 자료가 없으면 null
function describeLight(species) {
    const min = species.light_min_lux;
    const max = species.light_max_lux;

    let step = null;
    if (min == null) {
        // Lux 가 없으면 LOW/MEDIUM/HIGH 등급만으로 판단
        step = {
            LOW: LIGHT_STEPS.SHADE,
            MEDIUM: LIGHT_STEPS.HALF,
            HIGH: LIGHT_STEPS.SUN,
        }[species.light_level];
    } else if (min < LUX_LOW_MAX) {
        step = LIGHT_STEPS.SHADE;
    } else if (min < LUX_HIGH_MIN) {
        step = LIGHT_STEPS.HALF;
    } else {
        step = LIGHT_STEPS.SUN;
    }

    if (!step) return null;
    // 강한 빛을 못 견디는 종은 따로 알려준다 (상한이 높은 광도 구간에 못 미치는 경우)
    const caution =
        max != null && max <= LUX_HIGH_MIN ? "강한 직사광선은 피해주세요" : null;
    return { ...step, caution };
}

/*
    영양제 요구도 → 사람이 읽는 문장.

    농사로 원문(metadata.fertilizer_info)은 "요구도 + 주는 방법" 두 덩어리가
    붙어 있고, 표기가 고르지 않다:
      '비료를 보통 요구함'
      '보통 요구함'                                  ← '비료를' 이 빠진 표기
      '비료를 거의 요구하지않음 (2회/년, 4월, 7월)'
      '비료를 보통 요구함(수용성비료 2주에 한번 줌)'
    그대로 보여주면 문장이 중간에서 끊긴 것처럼 읽힌다. 요구도는 등급 표기로
    줄이고, 주는 방법만 아래 줄에 남긴다 — 같은 카드의 온·습도("적정 온도 21~25°C")
    처럼 값만 전달하는 어투로 맞춘다.

    등급을 못 알아보는 원문(예: '꽃이 진 후 시비')은 손대지 않고 그대로 보여준다 —
    농사로에는 자유 서술도 섞여 있어 억지로 등급에 끼우면 뜻이 바뀐다.

    괄호 안 '수용성비료 · 완효성비료' 같은 말은 비료 제품 종류라서 그대로 둔다.
*/
const FERTILIZER_STEPS = [
    { match: /(비료를\s*)?거의\s*요구하지\s*않음\.?/, title: "요구량 거의 없음" },
    { match: /(비료를\s*)?많이\s*요구함\.?/,           title: "요구량 많음" },
    { match: /(비료를\s*)?보통\s*요구함\.?/,           title: "요구량 보통" },
];

// 원문 → { title, detail }. 자료가 없으면 null
function describeFertilizer(raw) {
    const text = (raw ?? "").trim();
    if (!text) return null;

    const step = FERTILIZER_STEPS.find((item) => item.match.test(text));
    if (!step) return { title: text, detail: null };

    // 등급 표현을 떼고 남은 설명만 부가 정보로 — 앞쪽 구두점과 겉 괄호를 정리한다
    const detail = text
        .replace(step.match, "")
        .replace(/^[\s.,·]+/, "")
        .replace(/^\(([\s\S]*)\)$/, "$1")
        .trim();

    return { title: step.title, detail: detail || null };
}

// 독성 3상태 — null 은 자료 없음
function toxicityMark(flag) {
    if (flag === true) return { icon: "위험", color: Pink.soft };
    if (flag === false) return { icon: "안전", color: GreenTint.soft };
    return { icon: "미확인", color: Colors.separator };
}

// 콤마로 이어진 원문을 칩 목록으로
function toChips(raw) {
    if (!raw) return [];
    return raw
        .split(/[,·]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

// 권장 위치 — 농사로 원문은 장소마다 실내깊이 설명이 붙어 한 줄에 최대 114자가 된다.
//   '실내 어두운 곳 (실내깊이 500 이상cm),거실 내측 (실내깊이 300~500cm),거실 창측 (…)'
// 깊이 수치는 장소 이름과 사실상 1:1 대응이라 빼고 장소만 칩으로 보여준다.
function toPlacementChips(raw) {
    if (!raw) return [];
    return toChips(raw.replace(/\([^)]*\)/g, ""));
}

/*
    적정 구간 한 줄 —
    이름과 값을 한 행에 나란히 두고, 그 아래 축(0~최대) 위에 구간을 얹는다.
    수치를 막대 안에 넣지 않는 이유는 rangeStyle 주석 참고.
    자료가 없는 항목도 같은 행 모양을 유지해서 온도·습도 줄이 어긋나지 않게 한다.
*/
function RangeRow({ label, value, range, fillStyle, ticks, marker, markerLabel }) {
    return (
        <View>
            <View style={styles.rangeHeader}>
                <Text style={styles.rangeName}>{label}</Text>
                <Text style={styles.rangeValue}>{value}</Text>
            </View>

            {range ? (
                <>
                    <View style={styles.rangeBar}>
                        <View style={[fillStyle, range]} />
                        {marker ? <View style={[styles.rangeMarker, marker]} /> : null}
                    </View>

                    <View style={styles.rangeLabelRow}>
                        {ticks.map((tick) => (
                            <Text key={tick} style={styles.rangeLabel}>
                                {tick}
                            </Text>
                        ))}
                    </View>

                    {marker && markerLabel ? (
                        <View style={styles.markerLegend}>
                            <View style={styles.markerSwatch} />
                            <Text style={styles.markerLegendText}>{markerLabel}</Text>
                        </View>
                    ) : null}
                </>
            ) : null}
        </View>
    );
}

export default function CareInfoScreen({ navigation, route }) {
    const plantParam = route?.params?.plant;
    const plantId = plantParam?.id;

    const [species, setSpecies] = useState(null);
    const [plantName, setPlantName] = useState(plantParam?.name ?? "");
    const [loading, setLoading] = useState(Boolean(plantId));
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!plantId) {
            setLoading(false);
            return;
        }
        let cancelled = false;

        getPlant(Number(plantId))
            .then((detail) => {
                if (cancelled) return;
                setSpecies(detail.species ?? null);
                setPlantName(detail.nickname ?? "");
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [plantId]);

    return (
        <CareInfoView
            navigation={navigation}
            species={species}
            plantName={plantName}
            loading={loading}
            error={error}
        />
    );
}

function CareInfoView({ navigation, species, plantName, loading, error }) {
    const scrollRef = useRef(null);
    const tabScrollRef = useRef(null);
    const sectionY = useRef({});
    const tabPositions = useRef({});
    const activeKeyRef = useRef("plantInfo");
    const [activeKey, setActiveKey] = useState("plantInfo");
    const [descExpanded, setDescExpanded] = useState(false);

    const scrollToSection = (key) => {
        setActiveKey(key);
        activeKeyRef.current = key;

        const y = sectionY.current[key] ?? 0;
        scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });

        const x = tabPositions.current[key] ?? 0;
        tabScrollRef.current?.scrollTo({ x: Math.max(x - 16, 0), animated: true });
    };

    const saveSectionY = (key, event) => {
        sectionY.current[key] = event.nativeEvent.layout.y;
    };

    const saveTabPosition = (key, event) => {
        tabPositions.current[key] = event.nativeEvent.layout.x;
    };

    const handleScroll = useCallback((event) => {
        const scrollY = event.nativeEvent.contentOffset.y + 60;

        let newKey = CARE_SECTIONS[0].key;
        for (const { key } of CARE_SECTIONS) {
            if ((sectionY.current[key] ?? 0) <= scrollY) {
                newKey = key;
            }
        }

        if (activeKeyRef.current !== newKey) {
            activeKeyRef.current = newKey;
            setActiveKey(newKey);
            const x = tabPositions.current[newKey] ?? 0;
            tabScrollRef.current?.scrollTo({ x: Math.max(x - 16, 0), animated: true });
        }
    }, []);

    const tempRange = rangeStyle(species?.temp_min_c, species?.temp_max_c, TEMP_AXIS_MAX);
    const humidityRange = rangeStyle(
        species?.humidity_min_pct,
        species?.humidity_max_pct,
        HUMIDITY_AXIS_MAX,
    );
    // 겨울 최저는 적정 온도와 같은 축이라 온도 막대 위에 표시선으로 얹는다
    const winterMarker = markerStyle(species?.temp_min_winter_c, TEMP_AXIS_MAX);
    const pests = toChips(species?.bug_info);
    const flowerColors = toChips(species?.flower_color_names);
    const placements = toPlacementChips(species?.placement);
    const light = species ? describeLight(species) : null;
    const fertilizer = describeFertilizer(species?.fertilizer_info);
    // 접힘 상태에서 실제로 잘릴 때만 '더 보기' 를 붙인다.
    // 농사로 설명은 짧은 한 문장부터 1,000자 넘는 속 전체 소개까지 편차가 크다.
    const isLongDescription =
        (species?.description?.length ?? 0) > DESCRIPTION_COLLAPSE_THRESHOLD;

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
                <ScreenHeader title="돌보기 정보" onBack={() => navigation.goBack()} />
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !species) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
                <ScreenHeader title="돌보기 정보" onBack={() => navigation.goBack()} />
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>
                        {error
                            ? error
                            : `${plantName || "이 식물"}은 아직 종 정보가 연결되지 않았어요.\n프로필에서 식물종을 선택하면 돌보기 정보를 볼 수 있어요.`}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

            <ScreenHeader title="돌보기 정보" onBack={() => navigation.goBack()} />

            <View style={styles.container}>
                <View style={styles.tabWrapper}>
                    <ScrollView
                        ref={tabScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabContainer}
                    >
                        {CARE_SECTIONS.map((item) => {
                            const isActive = activeKey === item.key;
                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.tabChip, isActive && styles.tabChipActive]}
                                    activeOpacity={0.78}
                                    onPress={() => scrollToSection(item.key)}
                                    onLayout={(e) => saveTabPosition(item.key, e)}
                                >
                                    <Text style={[
                                        styles.tabText,
                                        isActive && styles.activeTabText,
                                    ]}>
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <ScrollView
                    ref={scrollRef}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.content}
                    onScroll={handleScroll}
                    scrollEventThrottle={100}
                >
                    {/* 식물정보 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("plantInfo", event)}
                    >
                        <Text style={styles.cardText}>
                            종명: {species.common_name_ko}
                            {species.scientific_name ? ` (${species.scientific_name})` : ""}
                        </Text>
                        {species.family_name ? (
                            <Text style={styles.cardText}>과: {species.family_name}</Text>
                        ) : null}
                        <Text style={styles.cardText}>
                            원산지: {species.origin_country || species.origin || NO_DATA}
                        </Text>
                        {species.size_raw ? (
                            <Text style={styles.cardText}>크기: {species.size_raw}</Text>
                        ) : null}
                        <Text
                            style={styles.cardText}
                            numberOfLines={
                                isLongDescription && !descExpanded
                                    ? DESCRIPTION_COLLAPSED_LINES
                                    : undefined
                            }
                        >
                            특징: {species.description || NO_DATA}
                        </Text>
                        {isLongDescription ? (
                            <TouchableOpacity
                                onPress={() => setDescExpanded((v) => !v)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.moreLink}>
                                    {descExpanded ? "접기" : "더 보기"}
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* 물주기 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("watering", event)}
                    >
                        <Text style={styles.cardTitle}>물주기</Text>

                        {/* 이 화면은 '종 정보' 를 보여준다. 개체별 물주기 주기 조정은 프로필에서 한다. */}
                        {species.watering_interval_days ? (
                            <View style={styles.infoRow}>
                                <View style={styles.circleBlue}>
                                    <Text style={styles.bigNumber}>
                                        {species.watering_interval_days}
                                    </Text>
                                </View>

                                <View style={[styles.textGroup, styles.flexText]}>
                                    <Text style={styles.mainInfo}>
                                        {species.watering_interval_days}일에 한 번
                                    </Text>
                                    {species.water_cycle_label ? (
                                        <Text style={styles.subInfo}>
                                            {species.water_cycle_label}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        ) : (
                            <Text style={styles.mainInfo}>{NO_DATA}</Text>
                        )}
                    </View>

                    {/* 햇빛 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("sunlight", event)}
                    >
                        <Text style={styles.cardTitle}>햇빛</Text>

                        <View style={styles.infoRow}>
                            <View style={styles.circlePeach}>
                                <Text style={styles.sunEmoji}>{light?.emoji ?? "❓"}</Text>
                            </View>

                            <View style={[styles.textGroup, styles.flexText]}>
                                <Text style={styles.mainInfo}>{light?.title ?? NO_DATA}</Text>
                                {light && species.light_min_lux != null ? (
                                    <Text style={styles.subInfo}>
                                        {light.place} · {species.light_min_lux.toLocaleString()}~
                                        {species.light_max_lux?.toLocaleString()} Lux
                                    </Text>
                                ) : null}
                                {light?.caution ? (
                                    <Text style={styles.subInfo}>{light.caution}</Text>
                                ) : null}
                            </View>
                        </View>
                    </View>

                    {/* 적정 온습도 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("temperature", event)}
                    >
                        <Text style={styles.cardTitle}>적정 온·습도</Text>

                        <View style={styles.rangeGroup}>
                            <RangeRow
                                label="온도"
                                value={
                                    tempRange
                                        ? `${Number(species.temp_min_c)}~${Number(species.temp_max_c)}°C`
                                        : NO_DATA
                                }
                                range={tempRange}
                                fillStyle={styles.rangeFillPink}
                                ticks={["0°C", "15°C", "30°C"]}
                                marker={winterMarker}
                                markerLabel={
                                    species.temp_min_winter_c != null
                                        ? `겨울 ${Number(species.temp_min_winter_c)}°C 이상`
                                        : null
                                }
                            />

                            <RangeRow
                                label="습도"
                                value={
                                    humidityRange
                                        ? `${Number(species.humidity_min_pct)}~${Number(species.humidity_max_pct)}%`
                                        : NO_DATA
                                }
                                range={humidityRange}
                                fillStyle={styles.rangeFillBlue}
                                ticks={["0%", "50%", "100%"]}
                            />
                        </View>

                        {/* 온도 막대가 없어 표시선을 얹을 곳이 없는 종만 글로 남긴다 */}
                        {!tempRange && species.temp_min_winter_c != null ? (
                            <View style={styles.rangeFootnote}>
                                <Text style={styles.rangeFootnoteText}>
                                    겨울 {Number(species.temp_min_winter_c)}°C 이상
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {/* 영양제 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("fertilizer", event)}
                    >
                        <Text style={styles.cardTitle}>영양제</Text>

                        {fertilizer ? (
                            <View style={styles.infoRow}>
                                <View style={styles.circleOrange}>
                                    <Text style={styles.sunEmoji}>🌱</Text>
                                </View>

                                <View style={[styles.textGroup, styles.flexText]}>
                                    <Text style={styles.mainInfo}>{fertilizer.title}</Text>
                                    {fertilizer.detail ? (
                                        <Text style={styles.subInfo}>{fertilizer.detail}</Text>
                                    ) : null}
                                </View>
                            </View>
                        ) : (
                            <Text style={styles.mainInfo}>{NO_DATA}</Text>
                        )}
                    </View>

                    {/* 토양 & 분갈이 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("soil", event)}
                    >
                        <Text style={styles.cardTitle}>토양 & 분갈이</Text>

                        <View style={styles.bulletRow}>
                            <View style={styles.circleYellow} />
                            <Text style={[styles.mainInfo, styles.flexText]}>
                                {species.soil_info || `토양: ${NO_DATA}`}
                            </Text>
                        </View>

                        {species.special_manage_info ? (
                            <View style={styles.bulletRow}>
                                <View style={styles.circleYellow} />
                                <Text style={[styles.mainInfo, styles.flexText]}>
                                    {species.special_manage_info}
                                </Text>
                            </View>
                        ) : null}

                        {placements.length > 0 ? (
                            <View style={styles.placementBlock}>
                                <Text style={styles.subLabel}>권장 위치</Text>
                                <View style={styles.chipContainer}>
                                    {placements.map((place) => (
                                        <View key={place} style={styles.chip}>
                                            <Text style={styles.chipText}>{place}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : null}
                    </View>

                    {/* 독성 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("toxicity", event)}
                    >
                        <Text style={styles.cardTitle}>독성</Text>

                        <View style={styles.toxicityRow}>
                            {[
                                {
                                    label: "인간",
                                    icon: require("../../assets/icons/toxicity-human.png"),
                                    // ASPCA 는 반려동물만 다루고 농사로 독성 텍스트는 사람 기준이 아니다.
                                    // 사람 독성만 따로 판정할 근거가 없어 미확인으로 둔다.
                                    flag: null,
                                },
                                {
                                    label: "강아지",
                                    icon: require("../../assets/icons/toxicity-dog.png"),
                                    flag: species.toxic_to_dogs,
                                },
                                {
                                    label: "고양이",
                                    icon: require("../../assets/icons/toxicity-cat.png"),
                                    flag: species.toxic_to_cats,
                                },
                            ].map(({ label, icon, flag }) => {
                                const mark = toxicityMark(flag);
                                return (
                                    <View key={label} style={styles.toxicityItem}>
                                        <Image
                                            source={icon}
                                            style={[
                                                styles.toxicityImage,
                                                flag !== true && styles.toxicityImageMuted,
                                            ]}
                                            resizeMode="contain"
                                        />
                                        <Text style={styles.toxicityLabel}>{label}</Text>
                                        <View
                                            style={[
                                                styles.toxicityBadge,
                                                { backgroundColor: mark.color },
                                            ]}
                                        >
                                            <Text style={styles.chipText}>{mark.icon}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {species.toxicity_info ? (
                            <Text style={[styles.cardText, styles.toxicityNote]}>
                                증상: {species.toxicity_info}
                            </Text>
                        ) : null}

                        {species.sources?.includes("ASPCA") ? (
                            <Text style={styles.sourceText}>
                                반려동물 독성 출처: ASPCA Animal Poison Control
                            </Text>
                        ) : null}
                    </View>

                    {/* 특성 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("feature", event)}
                    >
                        <Text style={styles.cardTitle}>특성</Text>

                        <View style={styles.bulletRow}>
                            <View style={styles.circlePink} />
                            <Text style={[styles.mainInfo, styles.flexText]}>
                                개화기: {species.flowering_period || NO_DATA}
                            </Text>
                        </View>

                        {flowerColors.length > 0 ? (
                            <View style={styles.bulletRow}>
                                <View style={styles.circlePink} />
                                <Text style={[styles.mainInfo, styles.flexText]}>
                                    꽃색: {flowerColors.join(", ")}
                                </Text>
                            </View>
                        ) : null}

                        {species.fruiting_period ? (
                            <View style={styles.bulletRow}>
                                <View style={styles.circlePink} />
                                <Text style={[styles.mainInfo, styles.flexText]}>
                                    결실기: {species.fruiting_period}
                                </Text>
                            </View>
                        ) : null}

                        {species.growth_rate ? (
                            <View style={styles.bulletRow}>
                                <View style={styles.circlePink} />
                                <Text style={[styles.mainInfo, styles.flexText]}>
                                    생장 속도: {species.growth_rate}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {/* 문제와 해충 */}
                    <View
                        style={[styles.card, styles.lastCard]}
                        onLayout={(event) => saveSectionY("pest", event)}
                    >
                        <Text style={styles.cardTitle}>문제와 해충</Text>

                        {pests.length > 0 ? (
                            <View style={styles.chipContainer}>
                                {pests.map((item) => (
                                    <View key={item} style={styles.chip}>
                                        <Text style={styles.chipText}>{item}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.mainInfo}>{NO_DATA}</Text>
                        )}

                        {species.sources?.length ? (
                            <Text style={styles.sourceText}>
                                자료 출처: {species.sources.join(", ")}
                            </Text>
                        ) : null}
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    container: {
        flex: 1,
        backgroundColor: Colors.background,
        paddingHorizontal: Spacing.xl,
    },

    /*
        섹션 이동 탭 (스크롤 스파이) —
        아래 카드들과 같은 어법으로 맞춘다: 흰 면 + 녹색 보더가 기본, 선택된 칸만
        메인 초록으로 꽉 채운다(ActionButton 과 같은 강조 방식). 반투명 글래스는
        연한 배경(#FAFFF0) 위에서 대비가 거의 없어 걷어냈다.

        좌우 음수 여백으로 컨테이너 거터를 상쇄해 화면 끝까지 이어지게 한다 —
        가로 스크롤이 여백에서 끊기면 목록이 거기서 끝난 것처럼 보인다.
        아래 실선이 스크롤되는 본문과 이 줄을 갈라 준다.
    */
    tabWrapper: {
        marginHorizontal: -Spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: GreenTint.line,
    },

    tabContainer: {
        gap: Spacing.sm,
        alignItems: "center",
        // 거터는 안쪽으로 옮겨 첫·마지막 칸이 화면 끝에 붙지 않게
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
    },

    tabChip: {
        height: 34,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1.5,
        borderColor: GreenTint.line,
        backgroundColor: Colors.white,
        alignItems: "center",
        justifyContent: "center",
    },

    tabChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },

    tabText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        includeFontPadding: false,
    },

    activeTabText: {
        color: Colors.white,
    },

    content: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xxxl,
    },

    card: {
        width: "100%",
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xl,
        marginBottom: Spacing.lg,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
    },

    lastCard: {
        marginBottom: 50,
    },

    cardTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.textBlack,
        marginBottom: Spacing.lg,
        includeFontPadding: false,
    },

    cardText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 22,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    infoRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    textGroup: {
        marginLeft: Spacing.xl,
        gap: Spacing.sm,
    },

    mainInfo: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    subInfo: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    circleBlue: {
        width: 58,
        height: 58,
        borderRadius: Radius.pill,
        backgroundColor: Colors.white,
        justifyContent: "center",
        alignItems: "center",
    },

    circlePeach: {
        width: 58,
        height: 58,
        borderRadius: Radius.pill,
        backgroundColor: Warm.peach,
        justifyContent: "center",
        alignItems: "center",
        marginRight: Spacing.xl,
    },

    circleOrange: {
        width: 58,
        height: 58,
        borderRadius: Radius.pill,
        backgroundColor: Warm.peach2,
        justifyContent: "center",
        alignItems: "center",
        marginRight: Spacing.xl,
    },

    bigNumber: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.screenTitle,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    sunEmoji: {
        fontSize: FontSizes.screenTitle,
    },

    // 온도·습도 두 줄 사이 간격만 여기서 — 마지막 줄에 죽은 여백이 남지 않게 gap 사용
    rangeGroup: {
        gap: Spacing.xl,
    },

    rangeHeader: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: Spacing.sm,
    },

    // 항목 이름은 값보다 한 단계 낮춰 — 읽는 순서가 값 → 이름이 되게
    rangeName: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        includeFontPadding: false,
    },

    rangeValue: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    // 축은 얇게 — 22px 짜리 굵은 막대는 구간 표시가 아니라 진행률처럼 읽힌다.
    // 바탕도 separator(#F0F0F0)에서 녹색 틴트로 바꿔 흰 카드 위에서 축이 보이게 했다.
    rangeBar: {
        width: "100%",
        height: 10,
        borderRadius: Radius.pill,
        backgroundColor: GreenTint.wash,
        overflow: "hidden",
        position: "relative",
    },

    rangeFillPink: {
        position: "absolute",
        top: 0,
        height: 10,
        borderRadius: Radius.pill,
        backgroundColor: Pink.soft,
    },

    rangeFillBlue: {
        position: "absolute",
        top: 0,
        height: 10,
        borderRadius: Radius.pill,
        backgroundColor: Accent.airBlue,
    },

    // 겨울 최저 표시선 — 구간(분홍)과 헷갈리지 않게 앱의 '차가움' 색을 쓴다
    rangeMarker: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 2,
        marginLeft: -1,
        backgroundColor: Gauge.coolDeep,
    },

    markerLegend: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },

    markerSwatch: {
        width: 2,
        height: 10,
        backgroundColor: Gauge.coolDeep,
    },

    markerLegendText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
        includeFontPadding: false,
    },

    rangeLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: Spacing.xs,
    },

    // 축 눈금은 값과 같은 무게로 두면 자료를 가린다 — 흐리게 깔아 둔다
    rangeLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        color: Colors.textFaint,
        includeFontPadding: false,
    },

    // 겨울 최저는 구간이 아니라 단서라서 선 아래 각주로 뺀다
    rangeFootnote: {
        marginTop: Spacing.xl,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: GreenTint.line,
    },

    rangeFootnoteText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        includeFontPadding: false,
    },

    bulletRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: Spacing.lg,
    },

    circleYellow: {
        width: 36,
        height: 36,
        borderRadius: Radius.xl,
        backgroundColor: Accent.cream,
        marginRight: Spacing.lg,
    },

    circlePink: {
        width: 36,
        height: 36,
        borderRadius: Radius.xl,
        backgroundColor: Pink.bg,
        marginRight: Spacing.lg,
    },

    toxicityRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },

    toxicityItem: {
        alignItems: "center",
    },

    toxicityImage: {
        width: 56,
        height: 56,
        marginBottom: Spacing.sm,
    },

    toxicityLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    chipContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.md,
    },

    chip: {
        backgroundColor: Colors.separator,
        borderRadius: Radius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },

    chipText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: Spacing.xl,
    },

    emptyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 22,
        color: Colors.textBlack,
        textAlign: "center",
        includeFontPadding: false,
    },

    // 원문 텍스트가 길어 줄바꿈이 필요한 자리
    flexText: {
        flex: 1,
        lineHeight: 22,
    },

    toxicityImageMuted: {
        opacity: 0.35,
    },

    toxicityBadge: {
        marginTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 2,
        borderRadius: Radius.lg,
    },

    toxicityNote: {
        marginTop: Spacing.lg,
    },

    placementBlock: {
        marginTop: Spacing.sm,
    },

    subLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        marginBottom: Spacing.md,
        includeFontPadding: false,
    },

    moreLink: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.primary,
        marginTop: Spacing.sm,
        includeFontPadding: false,
    },

    sourceText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        marginTop: Spacing.lg,
        includeFontPadding: false,
    },
});