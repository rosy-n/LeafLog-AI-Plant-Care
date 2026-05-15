import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    StatusBar,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Line, Polyline, Circle, Text as SvgText } from "react-native-svg";

import PlantImage from "../components/PlantImage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Mock Data ─────────────────────────────────────────────────────────────

const DAILY_DATASETS = [
    {
        label: "2025.05.15",
        temperature:  [18, 17, 16, 17, 20, 24, 27, 26, 23],
        airHumidity:  [65, 68, 72, 70, 58, 48, 42, 45, 52],
        soilHumidity: [55, 54, 54, 53, 52, 50, 48, 49, 50],
        dust: 18,
    },
    {
        label: "2025.05.14",
        temperature:  [17, 16, 15, 16, 19, 23, 25, 24, 22],
        airHumidity:  [62, 65, 70, 68, 60, 52, 46, 48, 54],
        soilHumidity: [57, 56, 55, 54, 53, 51, 50, 51, 52],
        dust: 22,
    },
    {
        label: "2025.05.13",
        temperature:  [19, 18, 17, 18, 22, 26, 28, 27, 24],
        airHumidity:  [60, 62, 68, 66, 55, 46, 40, 43, 50],
        soilHumidity: [53, 52, 52, 51, 50, 48, 47, 48, 49],
        dust: 15,
    },
];

const WEEKLY_DATASETS = [
    {
        label: "5.12 ~ 5.18",
        temperature:  [22, 24, 19, 21, 25, 23, 20],
        airHumidity:  [60, 55, 72, 65, 50, 58, 62],
        soilHumidity: [52, 50, 48, 55, 52, 48, 46],
        dust: 20,
    },
    {
        label: "5.5 ~ 5.11",
        temperature:  [20, 22, 23, 21, 18, 20, 22],
        airHumidity:  [58, 60, 55, 62, 70, 65, 58],
        soilHumidity: [50, 52, 54, 52, 58, 55, 53],
        dust: 25,
    },
    {
        label: "4.28 ~ 5.4",
        temperature:  [18, 19, 21, 20, 22, 24, 23],
        airHumidity:  [62, 65, 60, 58, 55, 52, 56],
        soilHumidity: [48, 50, 52, 55, 53, 50, 48],
        dust: 18,
    },
];

function genMonthly(seed) {
    return Array.from({ length: 30 }, (_, i) => ({
        temperature:  Math.round(18 + Math.sin((i + seed) * 0.4) * 5 + 4),
        airHumidity:  Math.round(55 + Math.cos((i + seed) * 0.3) * 12),
        soilHumidity: Math.round(50 + Math.sin((i + seed) * 0.2) * 8),
    }));
}

const MONTHLY_DATASETS = [
    { label: "2025.05", data: genMonthly(0), dust: 18 },
    { label: "2025.04", data: genMonthly(5), dust: 22 },
    { label: "2025.03", data: genMonthly(10), dust: 15 },
].map(({ label, data, dust }) => ({
    label,
    temperature:  data.map((d) => d.temperature),
    airHumidity:  data.map((d) => d.airHumidity),
    soilHumidity: data.map((d) => d.soilHumidity),
    dust,
}));

// ─── Chart Config ────────────────────────────────────────────────────────────

const CHART_CFG = {
    daily: {
        xLabels: ["0", "6", "12", "18", "24"],
        xLabelIndices: [0, 2, 4, 6, 8],
        dataCount: 9,
    },
    weekly: {
        xLabels: ["월", "화", "수", "목", "금", "토", "일"],
        xLabelIndices: [0, 1, 2, 3, 4, 5, 6],
        dataCount: 7,
    },
    monthly: {
        xLabels: ["1", "6", "15", "22", "30"],
        xLabelIndices: [0, 5, 14, 21, 29],
        dataCount: 30,
    },
};

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

const CHART_H = 210;
const PAD_L = 42;
const PAD_R = 38;
const PAD_T = 14;
const PAD_B = 28;
const PLOT_H = CHART_H - PAD_T - PAD_B;

const normTemp = (v) => PAD_T + PLOT_H * (1 - v / 40);
const normHum  = (v) => PAD_T + PLOT_H * (1 - v / 100);

function LineChart({ tempData, airData, soilData, periodKey }) {
    const chartWidth = SCREEN_WIDTH - 40;
    const plotWidth = chartWidth - PAD_L - PAD_R;
    const cfg = CHART_CFG[periodKey];
    const n = cfg.dataCount;

    const xOf = (i) => PAD_L + (i / (n - 1)) * plotWidth;

    const pts = (data, normFn) =>
        data.map((v, i) => `${xOf(i).toFixed(1)},${normFn(v).toFixed(1)}`).join(" ");

    const gridRows = [0, 25, 50, 75, 100];
    const tempYLabels = [40, 30, 20, 10, 0];

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
                        stroke="rgba(80,120,60,0.15)"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                    />
                );
            })}

            {/* Left y-axis: °C */}
            {tempYLabels.map((val, i) => (
                <SvgText
                    key={i}
                    x={PAD_L - 5}
                    y={normTemp(val) + 4}
                    textAnchor="end"
                    fontSize={9}
                    fill="#C05A3A"
                >
                    {val}
                </SvgText>
            ))}

            {/* Right y-axis: % */}
            {gridRows.map((pct, i) => (
                <SvgText
                    key={i}
                    x={chartWidth - PAD_R + 5}
                    y={normHum(pct) + 4}
                    textAnchor="start"
                    fontSize={9}
                    fill="#3A82B8"
                >
                    {pct}
                </SvgText>
            ))}

            {/* Axis line */}
            <Line
                x1={PAD_L} y1={PAD_T + PLOT_H}
                x2={chartWidth - PAD_R} y2={PAD_T + PLOT_H}
                stroke="rgba(80,120,60,0.25)"
                strokeWidth={1}
            />

            {/* Lines */}
            <Polyline
                points={pts(airData, normHum)}
                fill="none" stroke="#5BBFDE"
                strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round"
            />
            <Polyline
                points={pts(soilData, normHum)}
                fill="none" stroke="#6DB66A"
                strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round"
            />
            <Polyline
                points={pts(tempData, normTemp)}
                fill="none" stroke="#E87B4B"
                strokeWidth={2.5}
                strokeLinejoin="round" strokeLinecap="round"
            />

            {/* Dots at labeled positions */}
            {cfg.xLabelIndices.map((di) => (
                <React.Fragment key={di}>
                    <Circle cx={xOf(di)} cy={normTemp(tempData[di])} r={3.5} fill="#E87B4B" />
                    <Circle cx={xOf(di)} cy={normHum(airData[di])}  r={3}   fill="#5BBFDE" />
                    <Circle cx={xOf(di)} cy={normHum(soilData[di])} r={3}   fill="#6DB66A" />
                </React.Fragment>
            ))}

            {/* X-axis labels */}
            {cfg.xLabelIndices.map((di, li) => (
                <SvgText
                    key={li}
                    x={xOf(di)}
                    y={CHART_H - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#4A6040"
                >
                    {cfg.xLabels[li]}
                </SvgText>
            ))}
        </Svg>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, rating }) {
    return (
        <View style={styles.statCard}>
            <View style={styles.statIconWrap}>{icon}</View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
            <View style={styles.ratingBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#2E7020" />
                <Text style={styles.ratingText}>{rating}</Text>
            </View>
        </View>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(arr) {
    return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}

const PERIOD_KEYS = ["일", "주", "월"];
const PERIOD_MAP  = { "일": "daily", "주": "weekly", "월": "monthly" };

const CONDITIONS = [
    { emoji: "🥰", text: "따뜻해요", color: "#D94B3A", bg: "rgba(217,75,58,0.12)",  border: "rgba(217,75,58,0.28)"  },
    { emoji: "😊", text: "촉촉해요", color: "#3A8DC4", bg: "rgba(58,141,196,0.12)", border: "rgba(58,141,196,0.28)" },
    { emoji: "😄", text: "쾌적해요", color: "#C49A20", bg: "rgba(196,154,32,0.12)", border: "rgba(196,154,32,0.28)" },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SensorDataScreen({ navigation }) {
    const [period, setPeriod]     = useState("일");
    const [periodIdx, setPeriodIdx] = useState(0);

    const datasets =
        period === "일" ? DAILY_DATASETS :
        period === "주" ? WEEKLY_DATASETS :
        MONTHLY_DATASETS;

    const maxIdx = datasets.length - 1;
    const ds = datasets[periodIdx];

    const summaryTitle =
        period === "일" ? "오늘의 총평" :
        period === "주" ? "이번 주 총평" : "이번 달 총평";

    const avgLabel =
        period === "일" ? "오늘 평균" :
        period === "주" ? "이번 주 평균" : "이번 달 평균";

    const avgTemp = avg(ds.temperature);
    const avgAir  = avg(ds.airHumidity);
    const avgSoil = avg(ds.soilHumidity);

    const handlePeriodChange = (p) => { setPeriod(p); setPeriodIdx(0); };
    const handlePrev = () => { if (periodIdx < maxIdx) setPeriodIdx(periodIdx + 1); };
    const handleNext = () => { if (periodIdx > 0)      setPeriodIdx(periodIdx - 1); };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.headerButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={28} color="#2B3E25" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>센서 데이터</Text>
                    <View style={styles.headerButton} />
                </View>

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
                                onPress={() => handlePeriodChange(p)}
                                activeOpacity={0.75}
                            >
                                <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
                                    {p}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Period Navigator */}
                    <View style={styles.periodNav}>
                        <TouchableOpacity
                            onPress={handlePrev}
                            style={styles.navArrow}
                            activeOpacity={0.7}
                            disabled={periodIdx >= maxIdx}
                        >
                            <Ionicons
                                name="chevron-back"
                                size={22}
                                color={periodIdx >= maxIdx ? "#C0CDB8" : "#2B3E25"}
                            />
                        </TouchableOpacity>
                        <Text style={styles.periodLabel}>{ds.label}</Text>
                        <TouchableOpacity
                            onPress={handleNext}
                            style={styles.navArrow}
                            activeOpacity={0.7}
                            disabled={periodIdx <= 0}
                        >
                            <Ionicons
                                name="chevron-forward"
                                size={22}
                                color={periodIdx <= 0 ? "#C0CDB8" : "#2B3E25"}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Chart Card */}
                    <View style={styles.card}>
                        <BlurView intensity={22} tint="light" style={styles.cardBlur}>
                            <LinearGradient
                                colors={["rgba(255,255,255,0.75)", "rgba(218,240,205,0.50)"]}
                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                style={styles.cardGradient}
                            >
                                {/* Y-axis unit labels */}
                                <View style={styles.yAxisLabelRow}>
                                    <Text style={[styles.yAxisUnit, { color: "#C05A3A" }]}>°C</Text>
                                    <Text style={[styles.yAxisUnit, { color: "#3A82B8" }]}>%</Text>
                                </View>

                                <LineChart
                                    tempData={ds.temperature}
                                    airData={ds.airHumidity}
                                    soilData={ds.soilHumidity}
                                    periodKey={PERIOD_MAP[period]}
                                />

                                {/* Legend */}
                                <View style={styles.legend}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: "#E87B4B" }]} />
                                        <Text style={styles.legendText}>온도(°C)</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: "#5BBFDE" }]} />
                                        <Text style={styles.legendText}>공기습도(%)</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: "#6DB66A" }]} />
                                        <Text style={styles.legendText}>토양습도(%)</Text>
                                    </View>
                                </View>
                            </LinearGradient>
                        </BlurView>
                    </View>

                    {/* Summary Card */}
                    <View style={styles.card}>
                        <BlurView intensity={22} tint="light" style={styles.cardBlur}>
                            <LinearGradient
                                colors={["rgba(255,255,255,0.75)", "rgba(218,240,205,0.50)"]}
                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                style={styles.cardGradient}
                            >
                                <View style={styles.summaryHeader}>
                                    <PlantImage imageKey="spaghetti" width={48} height={48} />
                                    <Text style={styles.cardTitle}>{summaryTitle}</Text>
                                </View>
                                <View style={styles.conditionRow}>
                                    {CONDITIONS.map((c, i) => (
                                        <View
                                            key={i}
                                            style={[
                                                styles.conditionBox,
                                                { backgroundColor: c.bg, borderColor: c.border },
                                            ]}
                                        >
                                            <Text style={styles.conditionBoxEmoji}>{c.emoji}</Text>
                                            <Text style={[styles.conditionBoxText, { color: c.color }]}>
                                                {c.text}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </LinearGradient>
                        </BlurView>
                    </View>

                    {/* Stats Card */}
                    <View style={styles.card}>
                        <BlurView intensity={22} tint="light" style={styles.cardBlur}>
                            <LinearGradient
                                colors={["rgba(255,255,255,0.75)", "rgba(218,240,205,0.50)"]}
                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                style={styles.cardGradient}
                            >
                                <Text style={styles.cardTitle}>{avgLabel}</Text>
                                <View style={styles.statsGrid}>
                                    <View style={styles.statsRow}>
                                        <StatCard
                                            icon={<Ionicons name="thermometer" size={26} color="#E87B4B" />}
                                            label="평균 기온"
                                            value={`${avgTemp}°C`}
                                            rating="적정"
                                        />
                                        <StatCard
                                            icon={<Ionicons name="water" size={26} color="#5BBFDE" />}
                                            label="공기 습도"
                                            value={`${avgAir}%`}
                                            rating="적정"
                                        />
                                    </View>
                                    <View style={styles.statsRow}>
                                        <StatCard
                                            icon={<MaterialCommunityIcons name="water-percent" size={26} color="#6DB66A" />}
                                            label="토양 습도"
                                            value={`${avgSoil}%`}
                                            rating="적정"
                                        />
                                        <StatCard
                                            icon={<Ionicons name="cloud-outline" size={26} color="#8A9A82" />}
                                            label="미세먼지"
                                            value={`${ds.dust} μg/m³`}
                                            rating="적정"
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
        backgroundColor: "#FAFFF0",
    },
    safe: {
        flex: 1,
    },

    // Header
    header: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
    },
    headerButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontFamily: "NeoDunggeunmoPro-Regular",
        fontSize: 25,
        color: "#111111",
        includeFontPadding: false,
    },

    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
        gap: 14,
    },

    // Period Tabs
    periodTabRow: {
        flexDirection: "row",
        backgroundColor: "rgba(180,210,160,0.25)",
        borderRadius: 14,
        padding: 4,
        gap: 4,
    },
    periodTab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 11,
        alignItems: "center",
    },
    periodTabActive: {
        backgroundColor: "#FFFFFF",
        shadowColor: "#2D4A20",
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    periodTabText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 15,
        color: "#6A8A5A",
    },
    periodTabTextActive: {
        color: "#1F3A14",
    },

    // Period Navigator
    periodNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    navArrow: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
    },
    periodLabel: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 15,
        color: "#2B3E25",
        minWidth: 120,
        textAlign: "center",
    },

    // Cards
    card: {
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1.2,
        borderColor: "rgba(255,255,255,0.75)",
        shadowColor: "#2D4A20",
        shadowOpacity: 0.10,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    cardBlur: {
        borderRadius: 20,
        overflow: "hidden",
    },
    cardGradient: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 18,
        gap: 12,
    },
    cardTitle: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 14,
        color: "#2A4020",
    },

    // Y-axis unit row
    yAxisLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        marginBottom: -6,
    },
    yAxisUnit: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 10,
    },

    // Legend
    legend: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 16,
        marginTop: -4,
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    legendDot: {
        width: 9,
        height: 9,
        borderRadius: 99,
    },
    legendText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 11,
        color: "#4A6040",
    },

    // Summary
    summaryHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    conditionRow: {
        flexDirection: "row",
        gap: 8,
    },
    conditionBox: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 6,
        gap: 4,
    },
    conditionBoxEmoji: {
        fontSize: 14,
    },
    conditionBoxText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 11,
        color: "#333",
    },

    // Stats Grid
    statsGrid: {
        gap: 10,
    },
    statsRow: {
        flexDirection: "row",
        gap: 10,
    },
    statCard: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.60)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(200,230,185,0.6)",
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 4,
        alignItems: "flex-start",
    },
    statIconWrap: {
        marginBottom: 2,
    },
    statLabel: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 11,
        color: "#5A7A4A",
    },
    statValue: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 18,
        color: "#1F3A14",
    },
    ratingBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: "rgba(60,160,50,0.12)",
        borderRadius: 99,
        borderWidth: 1,
        borderColor: "rgba(60,160,50,0.30)",
    },
    ratingText: {
        fontFamily: "NeoDunggeunmo",
        fontSize: 11,
        color: "#2E7020",
    },
});