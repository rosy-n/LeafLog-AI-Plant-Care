import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StatusBar,
    Alert,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint, Soil, Shadow } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";

const SOIL_COLORS = [GreenTint.line, Soil.sand, Soil.peat, Soil.clay, Soil.water];

type SoilEntry = { type: string; ratio: string };

type RepottingRecord = {
    id: string;
    date: string;
    potSize: string;
    soilMix: SoilEntry[];
    memo: string;
};

type ScreenView = "list" | "form" | "detail";

const MOCK_RECORDS: RepottingRecord[] = [
    {
        id: "1",
        date: "2025.03.15",
        potSize: "12cm (4호)",
        soilMix: [
            { type: "배양토", ratio: "70" },
            { type: "펄라이트", ratio: "30" },
        ],
        memo: "봄 분갈이. 뿌리가 화분 밖으로 많이 나와 있어 한 치수 큰 화분으로 옮겼음. 새 흙으로 완전 교체.",
    },
    {
        id: "2",
        date: "2024.09.02",
        potSize: "10cm (3호)",
        soilMix: [
            { type: "배양토", ratio: "60" },
            { type: "펄라이트", ratio: "20" },
            { type: "마사토", ratio: "20" },
        ],
        memo: "여름 이후 첫 분갈이. 성장이 빠르게 진행됨.",
    },
];

function RecordHeader({
    title,
    onBack,
}: {
    title: string;
    onBack: () => void;
}) {
    return (
        <ScreenHeader title={title} onBack={onBack} />
    );
}

export default function RepottingScreen({ navigation }: { navigation: any }) {
    const [view, setView] = useState<ScreenView>("list");
    const [records, setRecords] = useState<RepottingRecord[]>(MOCK_RECORDS);
    const [selectedRecord, setSelectedRecord] = useState<RepottingRecord | null>(null);
    const [showCharacterModal, setShowCharacterModal] = useState(false);

    const [potSize, setPotSize] = useState("");
    const [soilMix, setSoilMix] = useState<SoilEntry[]>([{ type: "", ratio: "" }]);
    const [memo, setMemo] = useState("");

    const resetForm = () => {
        setPotSize("");
        setSoilMix([{ type: "", ratio: "" }]);
        setMemo("");
    };

    const addSoilEntry = () =>
        setSoilMix([...soilMix, { type: "", ratio: "" }]);

    const removeSoilEntry = (index: number) =>
        setSoilMix(soilMix.filter((_, i) => i !== index));

    const updateSoilEntry = (
        index: number,
        field: keyof SoilEntry,
        value: string
    ) => {
        const next = [...soilMix];
        next[index] = { ...next[index], [field]: value };
        setSoilMix(next);
    };

    const saveRecord = () => {
        const now = new Date();
        const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
        const newRecord: RepottingRecord = {
            id: Date.now().toString(),
            date: dateStr,
            potSize,
            soilMix: soilMix.filter((e) => e.type.trim()),
            memo,
        };
        setRecords([newRecord, ...records]);
        resetForm();
        setShowCharacterModal(true);
    };

    const handleCharacterChoice = () => {
        setShowCharacterModal(false);
        setView("list");
    };

    const deleteRecord = (id: string) => {
        setRecords((prev) => prev.filter((r) => r.id !== id));
    };

    // ─── List View ────────────────────────────────────────────────────────────
    if (view === "list") {
        return (
            <View style={styles.root}>
                <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
                <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                    <RecordHeader
                        title="분갈이"
                        onBack={() => navigation.goBack()}
                    />
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <TouchableOpacity
                            style={styles.newRecordButton}
                            activeOpacity={0.82}
                            onPress={() => setView("form")}
                        >
                            <Ionicons name="add-circle-outline" size={22} color={GreenTint.deep} />
                            <Text style={styles.newRecordText}>새 분갈이 기록 작성</Text>
                        </TouchableOpacity>

                        {records.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>분갈이 기록이 없습니다</Text>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.sectionLabel}>이전 기록</Text>
                                {records.map((record) => (
                                    <View key={record.id} style={styles.recordCard}>
                                        <TouchableOpacity
                                            style={styles.recordMainTouch}
                                            activeOpacity={0.82}
                                            onPress={() => {
                                                setSelectedRecord(record);
                                                setView("detail");
                                            }}
                                        >
                                            <View style={styles.recordIconWrap}>
                                                <Ionicons name="leaf-outline" size={22} color={GreenTint.strong} />
                                            </View>
                                            <View style={styles.recordBody}>
                                                <Text style={styles.recordDate}>{record.date}</Text>
                                                <View style={styles.chip}>
                                                    <Text style={styles.chipText}>
                                                        🪴 {record.potSize || "—"}
                                                    </Text>
                                                </View>
                                                <View style={styles.chipRow}>
                                                    {record.soilMix.slice(0, 3).map((s, i) => (
                                                        <View key={i} style={[styles.chip, styles.soilChip]}>
                                                            <Text style={styles.chipText}>
                                                                {s.type} {s.ratio}%
                                                            </Text>
                                                        </View>
                                                    ))}
                                                    {record.soilMix.length > 3 && (
                                                        <View style={styles.chip}>
                                                            <Text style={styles.chipText}>
                                                                +{record.soilMix.length - 3}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            activeOpacity={0.7}
                                            onPress={() =>
                                                Alert.alert(
                                                    "기록 삭제",
                                                    "이 분갈이 기록을 삭제할까요?",
                                                    [
                                                        { text: "취소", style: "cancel" },
                                                        {
                                                            text: "삭제",
                                                            style: "destructive",
                                                            onPress: () => deleteRecord(record.id),
                                                        },
                                                    ]
                                                )
                                            }
                                        >
                                            <Ionicons name="trash-outline" size={19} color={Colors.remove} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    // ─── Detail View ──────────────────────────────────────────────────────────
    if (view === "detail" && selectedRecord) {
        const totalRatio = selectedRecord.soilMix.reduce(
            (sum, s) => sum + (parseInt(s.ratio) || 0),
            0
        );

        return (
            <View style={styles.root}>
                <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
                <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                    <RecordHeader
                        title={selectedRecord.date}
                        onBack={() => setView("list")}
                    />
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* 화분 크기 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="resize-outline" size={18} color={GreenTint.strong} />
                                <Text style={styles.cardTitle}>화분 크기</Text>
                            </View>
                            <Text style={styles.cardValueLarge}>
                                {selectedRecord.potSize || "—"}
                            </Text>
                        </View>

                        {/* 흙 구성 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="earth-outline" size={18} color={GreenTint.strong} />
                                <Text style={styles.cardTitle}>흙 구성</Text>
                            </View>
                            {/* 비율 막대 */}
                            <View style={styles.soilBar}>
                                {selectedRecord.soilMix.map((s, i) => {
                                    const flex =
                                        totalRatio > 0
                                            ? (parseInt(s.ratio) || 0) / totalRatio
                                            : 1 / selectedRecord.soilMix.length;
                                    return (
                                        <View
                                            key={i}
                                            style={[
                                                styles.soilBarSegment,
                                                {
                                                    flex: Math.max(flex, 0.01),
                                                    backgroundColor:
                                                        SOIL_COLORS[i % SOIL_COLORS.length],
                                                },
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                            {selectedRecord.soilMix.map((s, i) => (
                                <View key={i} style={styles.soilDetailRow}>
                                    <View
                                        style={[
                                            styles.soilDot,
                                            { backgroundColor: SOIL_COLORS[i % SOIL_COLORS.length] },
                                        ]}
                                    />
                                    <Text style={styles.soilDetailType}>{s.type}</Text>
                                    <Text style={styles.soilDetailRatio}>{s.ratio}%</Text>
                                </View>
                            ))}
                        </View>

                        {/* 메모 */}
                        {selectedRecord.memo ? (
                            <View style={styles.card}>
                                <View style={styles.cardTitleRow}>
                                    <Ionicons
                                        name="document-text-outline"
                                        size={18}
                                        color={GreenTint.strong}
                                    />
                                    <Text style={styles.cardTitle}>메모</Text>
                                </View>
                                <Text style={styles.memoReadText}>{selectedRecord.memo}</Text>
                            </View>
                        ) : null}

                        {/* 사진 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="images-outline" size={18} color={GreenTint.strong} />
                                <Text style={styles.cardTitle}>사진</Text>
                            </View>
                            <Text style={styles.emptySubText}>첨부된 사진이 없습니다</Text>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    // ─── Form View ────────────────────────────────────────────────────────────
    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                <RecordHeader
                    title="새 분갈이 기록"
                    onBack={() => {
                        resetForm();
                        setView("list");
                    }}
                />

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* 화분 크기 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="resize-outline" size={18} color={GreenTint.strong} />
                                <Text style={styles.cardTitle}>화분 크기</Text>
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="예: 12cm, 4호"
                                placeholderTextColor={Colors.textFaint}
                                value={potSize}
                                onChangeText={setPotSize}
                            />
                        </View>

                        {/* 흙 정보 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="earth-outline" size={18} color={GreenTint.strong} />
                                <Text style={styles.cardTitle}>흙 정보</Text>
                            </View>
                            {soilMix.map((entry, index) => (
                                <View key={index} style={styles.soilInputRow}>
                                    <View
                                        style={[
                                            styles.soilDot,
                                            {
                                                backgroundColor:
                                                    SOIL_COLORS[index % SOIL_COLORS.length],
                                            },
                                        ]}
                                    />
                                    <TextInput
                                        style={[styles.textInput, styles.soilTypeInput]}
                                        placeholder="흙 종류"
                                        placeholderTextColor={Colors.textFaint}
                                        value={entry.type}
                                        onChangeText={(v) => updateSoilEntry(index, "type", v)}
                                    />
                                    <TextInput
                                        style={[styles.textInput, styles.soilRatioInput]}
                                        placeholder="0"
                                        placeholderTextColor={Colors.textFaint}
                                        value={entry.ratio}
                                        onChangeText={(v) =>
                                            updateSoilEntry(
                                                index,
                                                "ratio",
                                                v.replace(/[^0-9]/g, "")
                                            )
                                        }
                                        keyboardType="number-pad"
                                        maxLength={3}
                                    />
                                    <Text style={styles.percentSign}>%</Text>
                                    {soilMix.length > 1 && (
                                        <TouchableOpacity
                                            onPress={() => removeSoilEntry(index)}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons
                                                name="remove-circle-outline"
                                                size={22}
                                                color={Colors.remove}
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            <TouchableOpacity
                                style={styles.addSoilButton}
                                onPress={addSoilEntry}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="add" size={16} color={GreenTint.deep} />
                                <Text style={styles.addSoilText}>흙 종류 추가</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 메모 / 기록 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons
                                    name="document-text-outline"
                                    size={18}
                                    color={GreenTint.strong}
                                />
                                <Text style={styles.cardTitle}>메모 / 기록</Text>
                            </View>
                            <TextInput
                                style={[styles.textInput, styles.memoInput]}
                                placeholder="분갈이 중 특이사항, 식물 상태 등을 기록하세요"
                                placeholderTextColor={Colors.textFaint}
                                value={memo}
                                onChangeText={setMemo}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        {/* 사진 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="images-outline" size={18} color={GreenTint.strong} />
                                <Text style={styles.cardTitle}>사진</Text>
                            </View>
                            <TouchableOpacity style={styles.photoButton} activeOpacity={0.75}>
                                <Ionicons name="camera-outline" size={28} color={GreenTint.line} />
                                <Text style={styles.photoButtonText}>사진 추가</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.saveButton}
                            activeOpacity={0.82}
                            onPress={saveRecord}
                        >
                            <Text style={styles.saveButtonText}>저장하기</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* 캐릭터 업데이트 모달 */}
                <Modal
                    visible={showCharacterModal}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={handleCharacterChoice}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalBox}>
                            <Text style={styles.modalEmoji}>🌿</Text>
                            <Text style={styles.modalTitle}>분갈이 완료!</Text>
                            <Text style={styles.modalBody}>
                                새 화분으로 이사했어요.{"\n"}
                                캐릭터도 새 모습으로 업데이트할까요?
                            </Text>
                            <View style={styles.modalButtonRow}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.modalButtonGray]}
                                    activeOpacity={0.8}
                                    onPress={handleCharacterChoice}
                                >
                                    <Text style={styles.modalButtonGrayText}>유지하기</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.modalButtonGreen]}
                                    activeOpacity={0.8}
                                    onPress={handleCharacterChoice}
                                >
                                    <Ionicons name="camera" size={15} color={Colors.white} />
                                    <Text style={styles.modalButtonGreenText}>새로 생성</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    safe: {
        flex: 1,
    },

    // Header

    scrollContent: {
        ...screenContent,
        paddingTop: Spacing.sm,
    },

    // New Record Button
    newRecordButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.sm,
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: GreenTint.line,
        paddingVertical: Spacing.lg,
    },
    newRecordText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: GreenTint.deep,
        includeFontPadding: false,
    },

    // Section Label
    sectionLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.medium,
        includeFontPadding: false,
        marginBottom: -4,
    },

    // Record Card (List)
    recordCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
        overflow: "hidden",
    },
    recordMainTouch: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        gap: Spacing.md,
    },
    deleteButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        justifyContent: "center",
        alignItems: "center",
        borderLeftWidth: 1,
        borderLeftColor: Soil.bg,
    },
    recordIconWrap: {
        width: 42,
        height: 42,
        borderRadius: Radius.pill,
        backgroundColor: Colors.separator,
        alignItems: "center",
        justifyContent: "center",
    },
    recordBody: {
        flex: 1,
        gap: Spacing.sm,
    },
    recordDate: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.sm,
    },
    chip: {
        backgroundColor: Colors.separator,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    soilChip: {
        backgroundColor: Soil.sandAlpha,
    },
    chipText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
        includeFontPadding: false,
    },

    // Empty
    emptyState: {
        paddingTop: 60,
        alignItems: "center",
    },
    emptyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textFaint,
        includeFontPadding: false,
    },
    emptySubText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textFaint,
        includeFontPadding: false,
        marginTop: Spacing.xxs,
    },

    // Card
    card: {
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xl,
        gap: Spacing.md,
    },
    cardTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },
    cardTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.primary,
        includeFontPadding: false,
    },
    cardValueLarge: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    // Soil (Detail)
    soilBar: {
        flexDirection: "row",
        height: 18,
        borderRadius: Radius.md,
        overflow: "hidden",
    },
    soilBarSegment: {
        height: "100%",
    },
    soilDetailRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },
    soilDot: {
        width: 12,
        height: 12,
        borderRadius: Radius.sm,
    },
    soilDetailType: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        flex: 1,
        includeFontPadding: false,
    },
    soilDetailRatio: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textGray,
        includeFontPadding: false,
    },
    memoReadText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        lineHeight: 22,
        includeFontPadding: false,
    },

    // Form Inputs
    textInput: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: GreenTint.soft,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        includeFontPadding: false,
    },
    soilInputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },
    soilTypeInput: {
        flex: 1,
    },
    soilRatioInput: {
        width: 52,
        textAlign: "center",
    },
    percentSign: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        includeFontPadding: false,
    },
    addSoilButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
        paddingVertical: Spacing.xs,
        alignSelf: "flex-start",
    },
    addSoilText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.deep,
        includeFontPadding: false,
    },
    memoInput: {
        height: 100,
        textAlignVertical: "top",
        paddingTop: Spacing.md,
    },
    photoButton: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: GreenTint.soft,
        height: 88,
        gap: Spacing.sm,
    },
    photoButtonText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.line,
        includeFontPadding: false,
    },
    saveButton: {
        backgroundColor: GreenTint.deep,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.lg,
        alignItems: "center",
        shadowColor: GreenTint.deep,
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    saveButtonText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.white,
        includeFontPadding: false,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: Shadow.strong,
        alignItems: "center",
        justifyContent: "center",
    },
    modalBox: {
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        paddingHorizontal: Spacing.section,
        paddingTop: Spacing.xxxl,
        paddingBottom: Spacing.xxl,
        marginHorizontal: Spacing.xxxl,
        alignItems: "center",
        gap: Spacing.sm,
        shadowColor: Colors.textBlack,
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    modalEmoji: {
        fontSize: FontSizes.displayLarge,
        marginBottom: Spacing.xs,
    },
    modalTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    modalBody: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textGray,
        textAlign: "center",
        lineHeight: 22,
        includeFontPadding: false,
        marginTop: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    modalButtonRow: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    modalButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderRadius: Radius.lg,
    },
    modalButtonGray: {
        backgroundColor: Colors.separator,
    },
    modalButtonGreen: {
        backgroundColor: GreenTint.deep,
    },
    modalButtonGrayText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textGray,
        includeFontPadding: false,
    },
    modalButtonGreenText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.white,
        includeFontPadding: false,
    },
});