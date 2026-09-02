import React, { useCallback, useEffect, useState } from "react";
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
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import ActionButton from "../components/ActionButton";
import PhotoPickerButton from "../components/PhotoPickerButton";
import { Colors, GreenTint, Soil, Shadow } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import { getCareRecords, createCareRecord, deleteCareRecord, updatePlant } from "../api";

const SOIL_COLORS = [GreenTint.line, Soil.sand, Soil.peat, Soil.clay, Soil.water];

type SoilEntry = { type: string; ratio: string };

type RepottingRecord = {
    id: string;
    date: string;
    potType: string;
    potSize: string;
    soilMix: SoilEntry[];
    memo: string;
};

type ScreenView = "list" | "form" | "detail";

// 분갈이 기록은 care_record(care_type=REPOTTING)에 저장.
// 전용 컬럼이 없는 화분종류/화분크기/흙배합/메모는 note(TEXT)에 JSON으로 함께 보관.
function encodeNote(potType: string, potSize: string, soilMix: SoilEntry[], memo: string): string {
    return JSON.stringify({ potType, potSize, soilMix, memo });
}

function toRecord(item: { id: number; completed_at: string; note: string | null }): RepottingRecord {
    let potType = "";
    let potSize = "";
    let soilMix: SoilEntry[] = [];
    let memo = "";
    if (item.note) {
        try {
            const parsed = JSON.parse(item.note);
            potType = parsed.potType ?? "";
            potSize = parsed.potSize ?? "";
            soilMix = Array.isArray(parsed.soilMix) ? parsed.soilMix : [];
            memo = parsed.memo ?? "";
        } catch {
            memo = item.note; // 과거/비정형 note는 메모로 취급
        }
    }
    const d = new Date(item.completed_at);
    const date = Number.isNaN(d.getTime())
        ? item.completed_at
        : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    return { id: String(item.id), date, potType, potSize, soilMix, memo };
}

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

export default function RepottingScreen({ navigation, route }: { navigation: any; route?: any }) {
    const plant = route?.params?.plant;
    const plantId = plant?.id ? Number(plant.id) : null;

    const [view, setView] = useState<ScreenView>("list");
    const [records, setRecords] = useState<RepottingRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<RepottingRecord | null>(null);
    const [showCharacterModal, setShowCharacterModal] = useState(false);
    // 이번 기록으로 얻은 애정도 (0이면 오늘 이미 분갈이를 기록했거나 만점)
    const [affinityAwarded, setAffinityAwarded] = useState(0);

    // DB에서 이 식물의 분갈이(REPOTTING) 기록 로드
    const loadRecords = useCallback(() => {
        if (!plantId) return;
        getCareRecords(plantId, "REPOTTING")
            .then((items) => setRecords(items.map(toRecord)))
            .catch((e) => console.warn("분갈이 기록 로드 실패:", e?.message));
    }, [plantId]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const [potType, setPotType] = useState("");
    const [potSize, setPotSize] = useState("");
    const [soilMix, setSoilMix] = useState<SoilEntry[]>([{ type: "", ratio: "" }]);
    const [memo, setMemo] = useState("");

    const resetForm = () => {
        setPotType("");
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

    const saveRecord = async () => {
        if (!plantId) {
            Alert.alert("저장 실패", "식물 정보를 찾을 수 없어요.");
            return;
        }
        const trimmedPotType = potType.trim();
        const trimmedPotSize = potSize.trim();
        const note = encodeNote(potType, potSize, soilMix.filter((e) => e.type.trim()), memo);
        try {
            const saved = await createCareRecord(plantId, { care_type: "REPOTTING", note });
            setAffinityAwarded(saved.affinity_awarded);
            // 분갈이 = 화분 교체이므로 입력한 화분 종류/크기를 식물 프로필에 반영
            const potPatch: { pot_type?: string; pot_size?: string } = {};
            if (trimmedPotType) potPatch.pot_type = trimmedPotType;
            if (trimmedPotSize) potPatch.pot_size = trimmedPotSize;
            if (Object.keys(potPatch).length > 0) {
                await updatePlant(plantId, potPatch);
            }
            resetForm();
            await loadRecords();
            setShowCharacterModal(true);
        } catch (e: any) {
            Alert.alert("저장 실패", e?.message ?? "다시 시도해주세요.");
        }
    };

    const handleCharacterChoice = () => {
        setShowCharacterModal(false);
        setView("list");
    };

    const deleteRecord = async (id: string) => {
        if (!plantId) return;
        try {
            await deleteCareRecord(plantId, Number(id));
            await loadRecords();
        } catch (e: any) {
            Alert.alert("삭제 실패", e?.message ?? "다시 시도해주세요.");
        }
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
                        <ActionButton
                            label="새 분갈이 기록 작성"
                            icon="add-circle-outline"
                            color={Colors.white}
                            borderColor={GreenTint.line}
                            textColor={GreenTint.deep}
                            shadow={false}
                            onPress={() => setView("form")}
                        />

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
                        {/* 화분 종류 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="cube-outline" size={18} color={GreenTint.strong} />
                                <Text style={styles.cardTitle}>화분 종류</Text>
                            </View>
                            <Text style={styles.cardValueLarge}>
                                {selectedRecord.potType || "—"}
                            </Text>
                        </View>

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
                        {/* 화분 종류 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="cube-outline" size={18} color={GreenTint.strong} />
                                <Text style={styles.cardTitle}>화분 종류</Text>
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="예: 토분, 플라스틱, 도자기"
                                placeholderTextColor={Colors.textFaint}
                                value={potType}
                                onChangeText={setPotType}
                                maxLength={30}
                            />
                        </View>

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
                            <PhotoPickerButton />
                        </View>

                        <ActionButton
                            label="저장하기"
                            color={GreenTint.deep}
                            onPress={saveRecord}
                        />
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

                            {/* 이번 돌봄으로 오른 애정도 — 하트는 개체탭에서 채워진다 */}
                            {affinityAwarded > 0 ? (
                                <View style={styles.affinityGainChip}>
                                    <Image
                                        source={require("../../assets/icons/fullheart_icon.png")}
                                        style={styles.affinityGainHeart}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.affinityGainText}>
                                        애정도 +{affinityAwarded}
                                    </Text>
                                </View>
                            ) : null}

                            <View style={styles.modalButtonRow}>
                                <ActionButton
                                    label="유지하기"
                                    color={Colors.separator}
                                    textColor={Colors.textGray}
                                    size="md"
                                    shadow={false}
                                    activeOpacity={0.8}
                                    onPress={handleCharacterChoice}
                                    style={styles.modalButton}
                                />
                                <ActionButton
                                    label="새로 생성"
                                    icon="camera"
                                    iconSize={15}
                                    color={GreenTint.deep}
                                    size="md"
                                    shadow={false}
                                    activeOpacity={0.8}
                                    onPress={handleCharacterChoice}
                                    style={styles.modalButton}
                                />
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
    },

    // New Record Button

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
    affinityGainChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        marginBottom: Spacing.md,
        borderRadius: Radius.pill,
        backgroundColor: Colors.separator,
        borderWidth: 1,
        borderColor: GreenTint.line,
    },
    affinityGainHeart: {
        width: 16,
        height: 16,
    },
    affinityGainText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.deep,
        includeFontPadding: false,
    },
    modalButtonRow: {
        flexDirection: "row",
        gap: Spacing.md,
        width: "100%",
    },
    modalButton: {
        flex: 1,
        borderRadius: Radius.lg,
    },
});