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
import { getCurrentEnvironment, getEnvironmentHistory } from "../api";
import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint, Gauge, GaugeTint, Glass } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PERIOD_KEYS = ["일", "주", "월"];
const PERIOD_DAYS = { "일": 1, "주": 7, "월": 30 };

// 날씨/대기질 상태 → 총평 카드에 쓸 이모지·문구 (환경 오케스트레이션의 분류 문자열과 정확히 일치해야 함)
const WEATHER_COMMENTS = {
    "맑음": { emoji: "☀️", text: "맑아요", color: Gauge.gold, bg: GaugeTint.goldFaint, border: GaugeTint.goldSoft },
    "흐림": { emoji: "☁️", text: "흐려요", color: Gauge.coolText, bg: GaugeTint.coolFaint, border: GaugeTint.coolSoft },
    "비": { emoji: "🌧️", text: "비가 와요", color: Gauge.coolDeep, bg: GaugeTint.coolFaint, border: GaugeTint.coolSoft },
    "눈": { emoji: "❄️", text: "눈이 와요", color: Gauge.coolDeep, bg: GaugeTint.coolFaint, border: GaugeTint.coolSoft },
};

const AIR_QUALITY_COMMENTS = {
    "좋음": { emoji: "😄", text: "공기 좋아요", color: GreenTint.deep, bg: GreenTint.faint, border: GreenTint.soft },
    "보통": { emoji: "🙂", text: "공기 보통이에요", color: Gauge.gold, bg: GaugeTint.goldFaint, border: GaugeTint.goldSoft },
    "나쁨": { emoji: "😷", text: "공기가 나빠요", color: Gauge.warmDeep, bg: GaugeTint.hotFaint, border: GaugeTint.hotSoft },
    "매우나쁨": { emoji: "😫", text: "공기가 매우 나빠요", color: Gauge.hot, bg: GaugeTint.hotFaint, border: GaugeTint.hotSoft },
};

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

function StatCard({ icon, label, value }) {
    return (
        <View style={styles.statCard}>
            <View style={styles.statIconWrap}>{icon}</View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(values) {
    if (values.length === 0) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

const PERIOD_MAP = { "일": "daily", "주": "weekly", "월": "monthly" };

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SensorDataScreen({ navigation, route }) {
    const plant = route?.params?.plant;
    const [period, setPeriod] = useState("일");
    const [history, setHistory] = useState(null);
    const [current, setCurrent] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);

        Promise.all([
            getEnvironmentHistory(PERIOD_DAYS[period]),
            // 오늘의 총평은 현재 스냅샷 기준 — 위치 미설정(400) 등으로 실패해도
            // 히스토리 차트 자체는 계속 보여준다.
            getCurrentEnvironment().catch(() => null),
        ])
            .then(([historyResult, currentResult]) => {
                if (cancelled) return;
                setHistory(historyResult);
                setCurrent(currentResult);
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

    const tempData = weatherPoints.map((p) => p.temperature_c ?? 0);
    const humidityData = weatherPoints.map((p) => p.humidity_pct ?? 0);
    const timestamps = weatherPoints.map((p) => p.observed_at);

    const avgTemp = avg(tempData);
    const avgHumidity = avg(humidityData);
    const avgPm10 = avg(airQualityPoints.map((p) => p.pm10).filter((v) => v != null));
    const avgPm25 = avg(airQualityPoints.map((p) => p.pm25).filter((v) => v != null));

    const summaryTitle = period === "일" ? "오늘의 총평" : period === "주" ? "이번 주 총평" : "이번 달 총평";
    const avgLabel = period === "일" ? "오늘 평균" : period === "주" ? "이번 주 평균" : "이번 달 평균";

    const weatherComment = current ? WEATHER_COMMENTS[current.weather_status] : null;
    const airQualityComment = current ? AIR_QUALITY_COMMENTS[current.air_quality_status] : null;

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

                    {current?.location_name && (
                        <Text style={styles.locationLabel}>{current.location_name} 기준</Text>
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
                                        아직 쌓인 기록이 없어요.{"\n"}앱을 계속 사용하면 데이터가 채워져요!
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
                                    <Text style={styles.cardTitle}>{summaryTitle}</Text>
                                </View>
                                {weatherComment || airQualityComment ? (
                                    <View style={styles.conditionRow}>
                                        {[weatherComment, airQualityComment].filter(Boolean).map((c, i) => (
                                            <View
                                                key={i}
                                                style={[styles.conditionBox, { backgroundColor: c.bg, borderColor: c.border }]}
                                            >
                                                <Text style={styles.conditionBoxEmoji}>{c.emoji}</Text>
                                                <Text style={[styles.conditionBoxText, { color: c.color }]}>{c.text}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.emptyText}>위치를 설정하면 오늘의 날씨를 볼 수 있어요.</Text>
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
                                        />
                                        <StatCard
                                            icon={<Ionicons name="water" size={26} color={Gauge.cool} />}
                                            label="평균 습도"
                                            value={avgHumidity !== null ? `${avgHumidity}%` : "-"}
                                        />
                                    </View>
                                    <View style={styles.statsRow}>
                                        <StatCard
                                            icon={<Ionicons name="cloud-outline" size={26} color={GreenTint.medium} />}
                                            label="미세먼지(PM10)"
                                            value={avgPm10 !== null ? `${avgPm10} μg/m³` : "-"}
                                        />
                                        <StatCard
                                            icon={<MaterialCommunityIcons name="weather-hazy" size={26} color={GreenTint.medium} />}
                                            label="초미세먼지(PM2.5)"
                                            value={avgPm25 !== null ? `${avgPm25} μg/m³` : "-"}
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
    conditionRow: {
        flexDirection: "row",
        gap: Spacing.sm,
    },
    conditionBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Radius.lg,
        borderWidth: 1,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        gap: Spacing.xs,
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
});
