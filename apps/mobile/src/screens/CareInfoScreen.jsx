import React, { useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
} from "react-native";

const FONT = "NeoDunggeunmoPro-Regular";

const CARE_SECTIONS = [
    { key: "plantInfo", label: "식물정보" },
    { key: "watering", label: "물주기" },
    { key: "sunlight", label: "햇빛" },
    { key: "temperature", label: "온습도" },
    { key: "fertilizer", label: "비료주기" },
    { key: "soil", label: "토양&분갈이" },
    { key: "toxicity", label: "독성" },
    { key: "feature", label: "특성" },
    { key: "pest", label: "문제와 해충" },
];

export default function CareInfoScreen({ navigation }) {
    const scrollRef = useRef(null);
    const sectionY = useRef({});
    const [activeKey, setActiveKey] = useState("plantInfo");

    const scrollToSection = (key) => {
        setActiveKey(key);

        const y = sectionY.current[key] ?? 0;

        scrollRef.current?.scrollTo({
            y: Math.max(y - 16, 0),
            animated: true,
        });
    };

    const saveSectionY = (key, event) => {
        sectionY.current[key] = event.nativeEvent.layout.y;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />

            <View style={styles.container}>
                {/* 상단 제목 / 뒤로가기 버튼 */}
                <View style={styles.header}>
                    <TouchableOpacity
                        activeOpacity={0.75}
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backText}>‹</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>돌보기 정보</Text>

                    <View style={styles.headerSpacer} />
                </View>

                {/* 가로 스크롤 바로가기 버튼 */}
                <View style={styles.tabWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabContainer}
                    >
                        {CARE_SECTIONS.map((item) => (
                            <TouchableOpacity
                                key={item.key}
                                style={[
                                    styles.tabButton,
                                    activeKey === item.key && styles.activeTabButton,
                                ]}
                                activeOpacity={0.8}
                                onPress={() => scrollToSection(item.key)}
                            >
                                <Text style={styles.tabText}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* 내용 영역 */}
                <ScrollView
                    ref={scrollRef}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.content}
                >
                    {/* 식물정보 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("plantInfo", event)}
                    >
                        <Text style={styles.cardText}>
                            종명: 스파티필룸 (Spathiphyllum spp.)
                        </Text>
                        <Text style={styles.cardText}>
                            자생지: 열대 중앙아메리카와 동남아시아의 습한 숲 바닥.
                        </Text>
                        <Text style={styles.cardText}>
                            특징: 광택 있는 짙은 녹색 잎과 흰 불염포가 돋보이는 상록 여러해살이 관엽식물입니다.
                        </Text>
                    </View>

                    {/* 물주기 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("watering", event)}
                    >
                        <Text style={styles.cardTitle}>물주기</Text>

                        <View style={styles.infoRow}>
                            <View style={styles.circleBlue}>
                                <Text style={styles.bigNumber}>5</Text>
                            </View>

                            <View style={styles.textGroup}>
                                <Text style={styles.mainInfo}>5일에 한 번</Text>
                                <Text style={styles.subInfo}>겉흙이 마르면 흠뻑 주기</Text>
                            </View>
                        </View>
                    </View>

                    {/* 햇빛 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("sunlight", event)}
                    >
                        <Text style={styles.cardTitle}>햇빛</Text>

                        <View style={styles.infoRow}>
                            <View style={styles.circlePeach}>
                                <Text style={styles.sunEmoji}>🌥️</Text>
                            </View>

                            <Text style={styles.mainInfo}>밝은 간접광 선호</Text>
                        </View>
                    </View>

                    {/* 적정 온습도 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("temperature", event)}
                    >
                        <Text style={styles.cardTitle}>적정 온·습도</Text>

                        <View style={styles.rangeBlock}>
                            <View style={styles.rangeBar}>
                                <View
                                    style={[
                                        styles.rangeFillPink,
                                        { left: "60%", width: "28%" },
                                    ]}
                                >
                                    <Text style={styles.rangeText}>18~27°C</Text>
                                </View>
                            </View>

                            <View style={styles.rangeLabelRow}>
                                <Text style={styles.rangeLabel}>0°C</Text>
                                <Text style={styles.rangeLabel}>15°C</Text>
                                <Text style={styles.rangeLabel}>30°C</Text>
                            </View>
                        </View>

                        <View style={styles.rangeBlock}>
                            <View style={styles.rangeBar}>
                                <View
                                    style={[
                                        styles.rangeFillBlue,
                                        { left: "36%", width: "28%" },
                                    ]}
                                >
                                    <Text style={styles.rangeText}>40~60%</Text>
                                </View>
                            </View>

                            <View style={styles.rangeLabelRow}>
                                <Text style={styles.rangeLabel}>0%</Text>
                                <Text style={styles.rangeLabel}>50%</Text>
                                <Text style={styles.rangeLabel}>100%</Text>
                            </View>
                        </View>
                    </View>

                    {/* 비료 주기 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("fertilizer", event)}
                    >
                        <Text style={styles.cardTitle}>비료 주기</Text>

                        <View style={styles.infoRow}>
                            <View style={styles.circleOrange}>
                                <Text style={styles.bigNumber}>1</Text>
                            </View>

                            <Text style={styles.mainInfo}>월 1회</Text>
                        </View>
                    </View>

                    {/* 토양 & 분갈이 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("soil", event)}
                    >
                        <Text style={styles.cardTitle}>토양 & 분갈이</Text>

                        <View style={styles.bulletRow}>
                            <View style={styles.circleYellow} />
                            <Text style={styles.mainInfo}>
                                유기물 있는 배수성 좋은 배양토
                            </Text>
                        </View>

                        <View style={styles.bulletRow}>
                            <View style={styles.circleYellow} />
                            <Text style={styles.mainInfo}>매년 봄</Text>
                        </View>
                    </View>

                    {/* 독성 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("toxicity", event)}
                    >
                        <Text style={styles.cardTitle}>독성</Text>

                        <View style={styles.toxicityRow}>
                            <View style={styles.toxicityItem}>
                                <Image
                                    source={require("../../assets/icons/toxicity-human.png")}
                                    style={styles.toxicityImage}
                                    resizeMode="contain"
                                />
                                <Text style={styles.toxicityLabel}>인간</Text>
                            </View>

                            <View style={styles.toxicityItem}>
                                <Image
                                    source={require("../../assets/icons/toxicity-dog.png")}
                                    style={styles.toxicityImage}
                                    resizeMode="contain"
                                />
                                <Text style={styles.toxicityLabel}>강아지</Text>
                            </View>

                            <View style={styles.toxicityItem}>
                                <Image
                                    source={require("../../assets/icons/toxicity-cat.png")}
                                    style={styles.toxicityImage}
                                    resizeMode="contain"
                                />
                                <Text style={styles.toxicityLabel}>고양이</Text>
                            </View>
                        </View>
                    </View>

                    {/* 특성 */}
                    <View
                        style={styles.card}
                        onLayout={(event) => saveSectionY("feature", event)}
                    >
                        <Text style={styles.cardTitle}>특성</Text>

                        <View style={styles.bulletRow}>
                            <View style={styles.circlePink} />
                            <Text style={styles.mainInfo}>봄~여름</Text>
                        </View>

                        <View style={styles.bulletRow}>
                            <View style={styles.circlePink} />
                            <Text style={styles.mainInfo}>하얀색, 녹색 꽃</Text>
                        </View>
                    </View>

                    {/* 문제와 해충 */}
                    <View
                        style={[styles.card, styles.lastCard]}
                        onLayout={(event) => saveSectionY("pest", event)}
                    >
                        <Text style={styles.cardTitle}>문제와 해충</Text>

                        <View style={styles.chipContainer}>
                            {[
                                "뿌리 썩음",
                                "잎끝 갈변",
                                "노란 잎",
                                "파리 벌레",
                                "응애 벌레",
                                "뿌리파리",
                            ].map((item) => (
                                <View key={item} style={styles.chip}>
                                    <Text style={styles.chipText}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#FAFFF0",
    },

    container: {
        flex: 1,
        backgroundColor: "#FAFFF0",
        paddingHorizontal: 24,
    },

    header: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    backButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 0,
    },

    backText: {
        fontFamily: FONT,
        fontSize: 42,
        color: "#1F5D01",
        lineHeight: 42,
        includeFontPadding: false,
    },

    title: {
        fontFamily: FONT,
        fontSize: 27,
        color: "#111111",
        includeFontPadding: false,
        marginTop: 0,
    },

    headerSpacer: {
        width: 44,
        height: 44,
    },

    tabWrapper: {
        height: 48,
        marginTop: 6,
    },

    tabContainer: {
        gap: 9,
        alignItems: "center",
        paddingRight: 6,
    },

    tabButton: {
        height: 32,
        paddingHorizontal: 13,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: "#1F5D01",
        backgroundColor: "#D7EDC5",
        justifyContent: "center",
        alignItems: "center",
    },

    activeTabButton: {
        backgroundColor: "#C6E4B2",
    },

    tabText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#111111",
        includeFontPadding: false,
    },

    content: {
        paddingTop: 12,
        paddingBottom: 50,
    },

    card: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        paddingHorizontal: 28,
        paddingVertical: 26,
        marginBottom: 22,
        borderWidth: 1.5,
        borderColor: "#E0EBCD",
    },

    lastCard: {
        marginBottom: 80,
    },

    cardTitle: {
        fontFamily: FONT,
        fontSize: 22,
        color: "#111111",
        marginBottom: 24,
        includeFontPadding: false,
    },

    cardText: {
        fontFamily: FONT,
        fontSize: 16,
        lineHeight: 30,
        color: "#111111",
        includeFontPadding: false,
    },

    infoRow: {
        flexDirection: "row",
        alignItems: "center",
    },

    textGroup: {
        marginLeft: 24,
        gap: 12,
    },

    mainInfo: {
        fontFamily: FONT,
        fontSize: 16,
        color: "#111111",
        includeFontPadding: false,
    },

    subInfo: {
        fontFamily: FONT,
        fontSize: 16,
        color: "#111111",
        includeFontPadding: false,
    },

    circleBlue: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "#EAF3FF",
        justifyContent: "center",
        alignItems: "center",
    },

    circlePeach: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "#FFEBD9",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 24,
    },

    circleOrange: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "#FFE7D2",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 24,
    },

    bigNumber: {
        fontFamily: FONT,
        fontSize: 40,
        color: "#000000",
        includeFontPadding: false,
    },

    sunEmoji: {
        fontSize: 34,
    },

    rangeBlock: {
        marginTop: 10,
        marginBottom: 30,
    },

    rangeBar: {
        width: "100%",
        height: 28,
        borderRadius: 20,
        backgroundColor: "#E7E7E7",
        overflow: "hidden",
        position: "relative",
    },

    rangeFillPink: {
        position: "absolute",
        top: 0,
        height: 28,
        borderRadius: 20,
        backgroundColor: "#F29AA2",
        justifyContent: "center",
        alignItems: "center",
    },

    rangeFillBlue: {
        position: "absolute",
        top: 0,
        height: 28,
        borderRadius: 20,
        backgroundColor: "#9EBEF1",
        justifyContent: "center",
        alignItems: "center",
    },

    rangeText: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#111111",
        includeFontPadding: false,
    },

    rangeLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },

    rangeLabel: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#111111",
        includeFontPadding: false,
    },

    bulletRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 22,
    },

    circleYellow: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#FFF1BE",
        marginRight: 22,
    },

    circlePink: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "#FFE5F5",
        marginRight: 22,
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
        width: 72,
        height: 72,
        marginBottom: 10,
    },

    toxicityLabel: {
        fontFamily: FONT,
        fontSize: 16,
        color: "#111111",
        includeFontPadding: false,
    },

    chipContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },

    chip: {
        backgroundColor: "#EFEFEF",
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 10,
    },

    chipText: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#111111",
        includeFontPadding: false,
    },
});