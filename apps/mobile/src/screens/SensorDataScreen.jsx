import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    StatusBar,
    ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Line, Polyline, Circle, Text as SvgText } from "react-native-svg";

import PlantImage from "../components/PlantImage";
import { getEnvironmentHistory, getPlant, getUserSettings } from "../api";
import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint, Gauge, GaugeTint, Glass } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PERIOD_KEYS = ["일", "주", "월"];
// "일"은 그때그때 기상청 실황을 재구성, "주"/"월"은 누적 기록 기반(추후 ASOS로 교체 예정)
const PERIOD_QUERY = { "일": "day", "주": "week", "월": "month" };

// 총평 카드에 쓸 판정 태그 — 기온/습도/[나중에 토양습도]가 이 식물종의 적정
// 범위(species.temp_min_c 등)를 벗어나는 지표마다 하나씩, 최대 3개까지 동시에
// 보여준다. classifyComfortTags() 참고.
const COMFORT_TAGS = {
    cold: { emoji: "🥶", text: "추워요", color: Gauge.coolDeep, bg: GaugeTint.coolFaint, border: GaugeTint.coolSoft },
    warm: { emoji: "🥰", text: "따뜻해요", color: Gauge.hot, bg: GaugeTint.hotFaint, border: GaugeTint.hotSoft },
    dry: { emoji: "🍂", text: "건조해요", color: Gauge.warmDeep, bg: GaugeTint.hotFaint, border: GaugeTint.hotSoft },
    humid: { emoji: "😊", text: "촉촉해요", color: Gauge.coolText, bg: GaugeTint.coolFaint, border: GaugeTint.coolSoft },
    comfortable: { emoji: "😄", text: "쾌적해요", color: Gauge.gold, bg: GaugeTint.goldFaint, border: GaugeTint.goldSoft },
};

// 기온·습도 각각 독립적으로 판정해서, 둘 다 범위를 벗어나면 태그 2개를 함께
// 반환한다(예: 추워요 + 건조해요). 어느 것도 범위를 벗어나지 않으면 "쾌적해요"
// 하나만. 종 정보가 없거나(min/max 미설정) 실측치가 없으면 null.
function classifyComfortTags(avgTemp, avgHumidity, plantDetail) {
    if (avgTemp == null && avgHumidity == null) return null;
    const tempMin = plantDetail?.temp_min_c;
    const tempMax = plantDetail?.temp_max_c;
    const humidityMin = plantDetail?.humidity_min_pct;
    const humidityMax = plantDetail?.humidity_max_pct;

    const tags = [];
    if (avgTemp != null) {
        if (tempMin != null && avgTemp < tempMin) tags.push(COMFORT_TAGS.cold);
        else if (tempMax != null && avgTemp > tempMax) tags.push(COMFORT_TAGS.warm);
    }
    if (avgHumidity != null) {
        if (humidityMin != null && avgHumidity < humidityMin) tags.push(COMFORT_TAGS.dry);
        else if (humidityMax != null && avgHumidity > humidityMax) tags.push(COMFORT_TAGS.humid);
    }
    // TODO: 토양습도 센서 연동되면 여기에 세 번째 판정 추가 (최대 3개까지 지원됨)

    if (tags.length === 0) tags.push(COMFORT_TAGS.comfortable);
    return tags;
}

// 스탯 카드 아래 "적정/낮음/높음" 배지 — 종 적정 범위 정보가 없으면 null(배지 숨김)
function rateValue(value, min, max) {
    if (value == null) return null;
    if (min == null && max == null) return null;
    if (min != null && value < min) return "낮음";
    if (max != null && value > max) return "높음";
    return "적정";
}

// ─── Chart ──────────────────────────────────────────────────────────────────

const CHART_H = 210;
const PAD_L = 42;
const PAD_R = 38;
const PAD_T = 14;
const PAD_B = 28;
const PLOT_H = CHART_H - PAD_T - PAD_B;

const normTemp = (v) => PAD_T + PLOT_H * (1 - v / 40);
const normHum  = (v) => PAD_T + PLOT_H * (1 - v / 100);

// n개 포인트 중 라벨을 표시할 인덱스를 최대 maxLabels개, 균등 간격으로 고른다 —
// 실데이터는 daily/weekly/monthly마다 개수가 고정돼 있지 않아서(스냅샷 저장 주기에 따라
// 달라짐) 미리 정해둔 그리드 대신 매번 계산한다.
function pickLabelIndices(n, maxLabels = 5) {
    if (n <= 1) return n === 1 ? [0] : [];
    const count = Math.min(maxLabels, n);
    if (count <= 1) return [0];
    return Array.from(new Set(
        Array.from({ length: count }, (_, i) => Math.round((i * (n - 1)) / (count - 1)))
    ));
}

function formatAxisLabel(isoString, periodKey) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    if (periodKey === "daily") return `${String(d.getHours()).padStart(2, "0")}시`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function LineChart({ tempData, humidityData, timestamps, periodKey }) {
    const chartWidth = SCREEN_WIDTH - 40;
    const plotWidth = chartWidth - PAD_L - PAD_R;
    const n = tempData.length;

    const xOf = (i) => (n <= 1 ? PAD_L + plotWidth / 2 : PAD_L + (i / (n - 1)) * plotWidth);
    const pts = (data, normFn) =>
        data.map((v, i) => `${xOf(i).toFixed(1)},${normFn(v).toFixed(1)}`).join(" ");

    const gridRows = [0, 25, 50, 75, 100];
    const tempYLabels = [40, 30, 20, 10, 0];
    const labelIdx = pickLabelIndices(n);

    return (
        <Svg width={chartWidth} height={CHART_H}>
            {/* Grid */}
            {gridRows.map((pct, i) => {
                const y = normHum(pct);
                return (
                    <Line
                        key={i}
                        x1={PAD_L} y1={y}
                        x2={chartWidth - PAD_R} y2={y}
                        stroke={GreenTint.soft}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                    />
                );
            })}

            {/* Left y-axis: °C */}
            {tempYLabels.map((val, i) => (
                <SvgText key={i} x={PAD_L - 5} y={normTemp(val) + 4} textAnchor="end" fontSize={9} fill={Gauge.warmDeep}>
                    {val}
                </SvgText>
            ))}

            {/* Right y-axis: % */}
            {gridRows.map((pct, i) => (
                <SvgText key={i} x={chartWidth - PAD_R + 5} y={normHum(pct) + 4} textAnchor="start" fontSize={9} fill={Gauge.coolDeep}>
                    {pct}
                </SvgText>
            ))}

            {/* Axis line */}
            <Line x1={PAD_L} y1={PAD_T + PLOT_H} x2={chartWidth - PAD_R} y2={PAD_T + PLOT_H} stroke={GreenTint.line} strokeWidth={1} />

            {/* Lines */}
            <Polyline points={pts(humidityData, normHum)} fill="none" stroke={Gauge.cool} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <Polyline points={pts(tempData, normTemp)} fill="none" stroke={Gauge.warm} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

            {/* Dots + x labels at labeled positions */}
            {labelIdx.map((di) => (
                <React.Fragment key={di}>
                    <Circle cx={xOf(di)} cy={normTemp(tempData[di])} r={3.5} fill={Gauge.warm} />
                    <Circle cx={xOf(di)} cy={normHum(humidityData[di])} r={3} fill={Gauge.cool} />
                    <SvgText x={xOf(di)} y={CHART_H - 4} textAnchor="middle" fontSize={10} fill={GreenTint.deep}>
                        {formatAxisLabel(timestamps[di], periodKey)}
                    </SvgText>
                </React.Fragment>
            ))}
        </Svg>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, rating, valueSize }) {
    const valueStyle = valueSize === "placeholder" ? styles.statValuePlaceholder : null;
    return (
        <View style={styles.statCard}>
            <View style={styles.statIconWrap}>{icon}</View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, valueStyle]}>{value}</Text>
            {rating && (
                <View style={styles.ratingBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={GreenTint.deep} />
                    <Text style={styles.ratingText}>{rating}</Text>
                </View>
            )}
        </View>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(values) {
    if (values.length === 0) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

// 미세먼지(PM10) 등급 기준 — 에어코리아/기상청이 공통으로 쓰는 구간
// (좋음 0~30, 보통 31~80, 나쁨 81~150, 매우나쁨 151~)
function classifyPm10(value) {
    if (value == null) return null;
    if (value <= 30) return "좋음";
    if (value <= 80) return "보통";
    if (value <= 150) return "나쁨";
    return "매우나쁨";
}

const PERIOD_MAP = { "일": "daily", "주": "weekly", "월": "monthly" };

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SensorDataScreen({ navigation, route }) {
    const plant = route?.params?.plant;
    const [period, setPeriod] = useState("일");
    const [history, setHistory] = useState(null);
    const [plantDetail, setPlantDetail] = useState(null);
    const [locationName, setLocationName] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 종별 적정 범위(temp_min_c 등)는 기간이 바뀌어도 그대로라 period와 무관하게 한 번만 불러온다.
    useEffect(() => {
        if (!plant?.id) return;
        getPlant(plant.id)
            .then(setPlantDetail)
            .catch(() => {});
    }, [plant?.id]);

    useEffect(() => {
        getUserSettings()
            .then((result) => setLocationName(result.default_location))
            .catch(() => {});
    }, []);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);

        getEnvironmentHistory(PERIOD_QUERY[period])
            .then((historyResult) => {
                if (cancelled) return;
                setHistory(historyResult);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "데이터를 불러오지 못했어요.");
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [period]);

    const weatherPoints = history?.weather_points ?? [];
    const airQualityPoints = history?.air_quality_points ?? [];

    // 아두이노 토양습도 센서가 연결된 식물이라면 weather_points에 soil_humidity_pct가
    // 실려올 예정 — 아직 없으므로 지금은 기온/습도 2개 선만 그린다.
    const tempData = weatherPoints.map((p) => p.temperature_c ?? 0);
    const humidityData = weatherPoints.map((p) => p.humidity_pct ?? 0);
    const timestamps = weatherPoints.map((p) => p.observed_at);

    const avgTempStr = avg(tempData);
    const avgHumidityStr = avg(humidityData);
    const avgTemp = avgTempStr !== null ? Number(avgTempStr) : null;
    const avgHumidity = avgHumidityStr !== null ? Number(avgHumidityStr) : null;
    const avgPm10 = avg(airQualityPoints.map((p) => p.pm10).filter((v) => v != null));

    const summaryTitle = period === "일" ? `${plant?.name ?? "식물"}의 하루 총평` : period === "주" ? `${plant?.name ?? "식물"}의 주 총평` : `${plant?.name ?? "식물"}의 월 총평`;
    const avgLabel = period === "일" ? "오늘 평균" : period === "주" ? "이번 주 평균" : "이번 달 평균";

    const comfortTags = classifyComfortTags(avgTemp, avgHumidity, plantDetail);
    const comfortTagsWrap = comfortTags && comfortTags.length === 3;
    const tempRating = rateValue(avgTemp, plantDetail?.temp_min_c, plantDetail?.temp_max_c);
    const humidityRating = rateValue(avgHumidity, plantDetail?.humidity_min_pct, plantDetail?.humidity_max_pct);

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>

                {/* Header */}
                <ScreenHeader title="센서 데이터" onBack={() => navigation.goBack()} />

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Period Tabs */}
                    <View style={styles.periodTabRow}>
                        {PERIOD_KEYS.map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.periodTab, period === p && styles.periodTabActive]}
                                onPress={() => setPeriod(p)}
                                activeOpacity={0.75}
                            >
                                <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
                                    {p}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {locationName && (
                        <Text style={styles.locationLabel}>{locationName} 기준</Text>
                    )}

                    {/* Chart Card */}
                    <View style={styles.card}>
                        <BlurView intensity={22} tint="light" style={styles.cardBlur}>
                            <LinearGradient
                                colors={[Glass.frost72, Glass.mist]}
                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                style={styles.cardGradient}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={Colors.primary} style={styles.chartLoading} />
                                ) : error ? (
                                    <Text style={styles.emptyText}>{error}</Text>
                                ) : tempData.length === 0 ? (
                                    <Text style={styles.emptyText}>
                                        {period === "일"
                                            ? "아직 오늘 관측된 데이터가 없어요."
                                            : "아직 쌓인 기록이 없어요.\n앱을 계속 사용하면 데이터가 채워져요!"}
                                    </Text>
                                ) : (
                                    <>
                                        {/* Y-axis unit labels */}
                                        <View style={styles.yAxisLabelRow}>
                                            <Text style={[styles.yAxisUnit, { color: Gauge.warmDeep }]}>°C</Text>
                                            <Text style={[styles.yAxisUnit, { color: Gauge.coolDeep }]}>%</Text>
                                        </View>

                                        <LineChart
                                            tempData={tempData}
                                            humidityData={humidityData}
                                            timestamps={timestamps}
                                            periodKey={PERIOD_MAP[period]}
                                        />

                                        {/* Legend */}
                                        <View style={styles.legend}>
                                            <View style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: Gauge.warm }]} />
                                                <Text style={styles.legendText}>기온(°C)</Text>
                                            </View>
                                            <View style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: Gauge.cool }]} />
                                                <Text style={styles.legendText}>습도(%)</Text>
                                            </View>
                                        </View>
                                    </>
                                )}
                            </LinearGradient>
                        </BlurView>
                    </View>

                    {/* Summary Card */}
                    <View style={styles.card}>
                        <BlurView intensity={22} tint="light" style={styles.cardBlur}>
                            <LinearGradient
                                colors={[Glass.frost72, Glass.mist]}
                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                style={styles.cardGradient}
                            >
                                <View style={styles.summaryHeader}>
                                    <PlantImage uri={plant?.imageUri} imageKey={plant?.imageKey ?? "spaghetti"} width={48} height={48} />
                                    <Text style={[styles.cardTitle, styles.summaryTitleText]}>{summaryTitle}</Text>
                                    {comfortTags && !comfortTagsWrap && comfortTags.map((tag, idx) => (
                                        <View
                                            key={idx}
                                            style={[styles.conditionBoxInline, { backgroundColor: tag.bg, borderColor: tag.border }]}
                                        >
                                            <Text style={styles.conditionBoxEmoji}>{tag.emoji}</Text>
                                            <Text style={[styles.conditionBoxText, { color: tag.color }]}>{tag.text}</Text>
                                        </View>
                                    ))}
                                </View>
                                {/* 태그가 3개(최대치)면 헤더 옆이 아니라 아래 별도 행에 나열 */}
                                {comfortTagsWrap && (
                                    <View style={styles.conditionRowWrap}>
                                        {comfortTags.map((tag, idx) => (
                                            <View
                                                key={idx}
                                                style={[styles.conditionBoxInline, { backgroundColor: tag.bg, borderColor: tag.border }]}
                                            >
                                                <Text style={styles.conditionBoxEmoji}>{tag.emoji}</Text>
                                                <Text style={[styles.conditionBoxText, { color: tag.color }]}>{tag.text}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                {!comfortTags && (
                                    <Text style={styles.emptyText}>
                                        {plant?.id
                                            ? "아직 데이터가 부족해서 판정할 수 없어요."
                                            : "식물 상세에서 들어오면 총평을 볼 수 있어요."}
                                    </Text>
                                )}
                            </LinearGradient>
                        </BlurView>
                    </View>

                    {/* Stats Card */}
                    <View style={styles.card}>
                        <BlurView intensity={22} tint="light" style={styles.cardBlur}>
                            <LinearGradient
                                colors={[Glass.frost72, Glass.mist]}
                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                style={styles.cardGradient}
                            >
                                <Text style={styles.cardTitle}>{avgLabel}</Text>
                                <View style={styles.statsGrid}>
                                    <View style={styles.statsRow}>
                                        <StatCard
                                            icon={<Ionicons name="thermometer" size={26} color={Gauge.warm} />}
                                            label="평균 기온"
                                            value={avgTemp !== null ? `${avgTemp}°C` : "-"}
                                            rating={tempRating}
                                        />
                                        <StatCard
                                            icon={<Ionicons name="water" size={26} color={Gauge.cool} />}
                                            label="평균 습도"
                                            value={avgHumidity !== null ? `${avgHumidity}%` : "-"}
                                            rating={humidityRating}
                                        />
                                    </View>
                                    <View style={styles.statsRow}>
                                        <StatCard
                                            icon={<Ionicons name="cloud-outline" size={26} color={GreenTint.medium} />}
                                            label="평균 대기질"
                                            value={
                                                avgPm10 !== null ? (
                                                    <>
                                                        {`${avgPm10} `}
                                                        <Text style={styles.statValueUnit}>{"μg/m³ "}</Text>
                                                        <Text style={styles.statValueParen}>{`(${classifyPm10(Number(avgPm10))})`}</Text>
                                                    </>
                                                ) : (
                                                    "-"
                                                )
                                            }
                                        />
                                        <StatCard
                                            icon={<MaterialCommunityIcons name="water-percent" size={26} color={GreenTint.medium} />}
                                            label="평균 토양습도"
                                            value="아직 센서가 없어요"
                                            valueSize="placeholder"
                                        />
                                    </View>
                                </View>
                            </LinearGradient>
                        </BlurView>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    safe: {
        flex: 1,
    },

    scrollContent: {
        ...screenContent,
        paddingBottom: Spacing.xxxl,
    },

    // Period Tabs
    periodTabRow: {
        flexDirection: "row",
        backgroundColor: GreenTint.faint,
        borderRadius: Radius.lg,
        padding: Spacing.xs,
        gap: Spacing.xs,
    },
    periodTab: {
        flex: 1,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        alignItems: "center",
    },
    periodTabActive: {
        backgroundColor: Colors.white,
        shadowColor: GreenTint.deep,
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    periodTabText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: GreenTint.strong,
    },
    periodTabTextActive: {
        color: Colors.primary,
    },

    locationLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
        textAlign: "center",
    },

    // Cards
    card: {
        borderRadius: Radius.xl,
        overflow: "hidden",
        borderWidth: 1.2,
        borderColor: Glass.frost72,
        shadowColor: GreenTint.deep,
        shadowOpacity: 0.10,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    cardBlur: {
        borderRadius: Radius.xl,
        overflow: "hidden",
    },
    cardGradient: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xl,
        gap: Spacing.md,
    },
    cardTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.primary,
    },

    chartLoading: {
        paddingVertical: Spacing.huge,
    },
    emptyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
        textAlign: "center",
        paddingVertical: Spacing.xl,
    },

    // Y-axis unit row
    yAxisLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: Spacing.xs,
        marginBottom: -6,
    },
    yAxisUnit: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
    },

    // Legend
    legend: {
        flexDirection: "row",
        justifyContent: "center",
        gap: Spacing.lg,
        marginTop: -4,
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
    },
    legendDot: {
        width: 9,
        height: 9,
        borderRadius: Radius.pill,
    },
    legendText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.deep,
    },

    // Summary
    summaryHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },
    // 제목이 남는 폭을 다 차지해서, 총평 태그가 자연스럽게 오른쪽 끝에 붙는다
    summaryTitleText: {
        flex: 1,
    },
    // 총평 헤더 한 줄에 같이 들어가는 압축된 버전 — flex:1로 늘어나지 않고 내용만큼만.
    // marginRight로 카드 오른쪽 테두리에 바짝 붙지 않게 여백을 둔다.
    conditionBoxInline: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: Radius.lg,
        borderWidth: 1,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        marginRight: Spacing.xs,
        gap: Spacing.xs,
    },
    // 태그가 3개(최대치)라 헤더 옆에 다 못 넣을 때, 헤더 아래 별도 행에 나열
    conditionRowWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.xs,
        marginTop: Spacing.sm,
    },
    conditionBoxEmoji: {
        fontSize: FontSizes.body,
    },
    conditionBoxText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textBlack,
    },

    // Stats Grid
    statsGrid: {
        gap: Spacing.md,
    },
    statsRow: {
        flexDirection: "row",
        gap: Spacing.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: Glass.frost60,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: GreenTint.soft,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.xs,
        alignItems: "flex-start",
    },
    statIconWrap: {
        marginBottom: Spacing.xxs,
    },
    statLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
    },
    statValue: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.primary,
    },
    // 평균 대기질의 "μg/m³" 단위 표기만 살짝 작게 — 색은 statValue 상속, 숫자보다
    // 한 단계 작은 크기(subtitle 18 -> bodyLarge 16)
    statValueUnit: {
        fontSize: FontSizes.bodyLarge,
    },
    // 평균 대기질의 "(좋음)" 같은 괄호 등급 표기만 눈에 띄게 작게 — 색은 statValue 상속,
    // 크기만 확 줄임(subtitle 18 -> small 12). bodyLarge(16)은 차이가 2px뿐이라
    // 눈에 잘 안 띄어서 더 줄임.
    statValueParen: {
        fontSize: FontSizes.small,
    },
    // 평균 토양습도처럼 숫자 대신 안내 문구가 들어갈 때 — 문장이 길어서 확실히 작게
    statValuePlaceholder: {
        fontSize: FontSizes.small,
        color: GreenTint.strong,
    },
    ratingBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
        marginTop: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        backgroundColor: GreenTint.faint,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: GreenTint.line,
    },
    ratingText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.deep,
    },
});
