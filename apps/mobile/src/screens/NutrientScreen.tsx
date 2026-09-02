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
import { Colors, GreenTint, Shadow } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import { getCareRecords, createCareRecord, deleteCareRecord } from "../api";

type NutrientRecord = {
    id: string;
    date: string;
    fertilizerType: string;
    amount: string;
    intervalDays: string;
    memo: string;
};

type ScreenView = "list" | "form" | "detail";

// 영양제 기록은 care_record(care_type=FERTILIZING)에 저장.
// 전용 컬럼이 없는 영양제 종류/용량/주기/메모는 note(TEXT)에 JSON으로 함께 보관.
function encodeNote(
    fertilizerType: string,
    amount: string,
    intervalDays: string,
    memo: string,
): string {
    return JSON.stringify({ fertilizerType, amount, intervalDays, memo });
}

function toRecord(item: { id: number; completed_at: string; note: string | null }): NutrientRecord {
    let fertilizerType = "";
    let amount = "";
    let intervalDays = "";
    let memo = "";
    if (item.note) {
        try {
            const parsed = JSON.parse(item.note);
            fertilizerType = parsed.fertilizerType ?? "";
            amount = parsed.amount ?? "";
            intervalDays = parsed.intervalDays ?? "";
            memo = parsed.memo ?? "";
        } catch {
            memo = item.note; // 과거/비정형 note는 메모로 취급
        }
    }
    const d = new Date(item.completed_at);
    const date = Number.isNaN(d.getTime())
        ? item.completed_at
        : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    return { id: String(item.id), date, fertilizerType, amount, intervalDays, memo };
}

export default function NutrientScreen({ navigation, route }: { navigation: any; route?: any }) {
    const plant = route?.params?.plant;
    const plantId = plant?.id ? Number(plant.id) : null;

    const [view, setView] = useState<ScreenView>("list");
    const [records, setRecords] = useState<NutrientRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<NutrientRecord | null>(null);
    const [showCharacterModal, setShowCharacterModal] = useState(false);
    // 이번 기록으로 얻은 애정도 (0이면 오늘 이미 영양제를 기록했거나 만점)
    const [affinityAwarded, setAffinityAwarded] = useState(0);

    // DB에서 이 식물의 영양제(FERTILIZING) 기록 로드
    const loadRecords = useCallback(() => {
        if (!plantId) return;
        getCareRecords(plantId, "FERTILIZING")
            .then((items) => setRecords(items.map(toRecord)))
            .catch((e) => console.warn("영양제 기록 로드 실패:", e?.message));
    }, [plantId]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const [fertilizerType, setFertilizerType] = useState("");
    const [amount, setAmount] = useState("");
    const [intervalDays, setIntervalDays] = useState("");
    const [memo, setMemo] = useState("");

    const resetForm = () => {
        setFertilizerType("");
        setAmount("");
        setIntervalDays("");
        setMemo("");
    };

    const saveRecord = async () => {
        if (!plantId) {
            Alert.alert("저장 실패", "식물 정보를 찾을 수 없어요.");
            return;
        }
        if (!fertilizerType.trim()) {
            Alert.alert("입력 필요", "영양제 종류를 입력해주세요.");
            return;
        }
        const note = encodeNote(fertilizerType.trim(), amount.trim(), intervalDays.trim(), memo.trim());
        try {
            const saved = await createCareRecord(plantId, { care_type: "FERTILIZING", note });
            setAffinityAwarded(saved.affinity_awarded);
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
                    <ScreenHeader title="영양제" onBack={() => navigation.goBack()} />
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <ActionButton
                            label="새 영양제 기록 작성"
                            icon="add-circle-outline"
                            color={Colors.fertilizer}
                            borderColor={Colors.fertilizerIcon}
                            textColor={Colors.fertilizerIcon}
                            shadow={false}
                            onPress={() => setView("form")}
                        />

                        {records.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>영양제 기록이 없습니다</Text>
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
                                                <Text style={styles.recordIconPlus}>✚</Text>
                                            </View>
                                            <View style={styles.recordBody}>
                                                <Text style={styles.recordDate}>{record.date}</Text>
                                                <View style={styles.chipRow}>
                                                    <View style={[styles.chip, styles.typeChip]}>
                                                        <Text style={styles.chipText}>
                                                            💊 {record.fertilizerType || "—"}
                                                        </Text>
                                                    </View>
                                                    {record.amount ? (
                                                        <View style={styles.chip}>
                                                            <Text style={styles.chipText}>{record.amount}</Text>
                                                        </View>
                                                    ) : null}
                                                    {record.intervalDays ? (
                                                        <View style={styles.chip}>
                                                            <Text style={styles.chipText}>
                                                                주기 {record.intervalDays}일
                                                            </Text>
                                                        </View>
                                                    ) : null}
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
                                                    "이 영양제 기록을 삭제할까요?",
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
        return (
            <View style={styles.root}>
                <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
                <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                    <ScreenHeader title={selectedRecord.date} onBack={() => setView("list")} />
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* 영양제 종류 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="flask-outline" size={18} color={Colors.fertilizerIcon} />
                                <Text style={styles.cardTitle}>영양제 종류</Text>
                            </View>
                            <Text style={styles.cardValueLarge}>
                                {selectedRecord.fertilizerType || "—"}
                            </Text>
                        </View>

                        {/* 용량 · 주기 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="beaker-outline" size={18} color={Colors.fertilizerIcon} />
                                <Text style={styles.cardTitle}>용량 · 주기</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>용량</Text>
                                <Text style={styles.detailValue}>{selectedRecord.amount || "—"}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>다음 주기</Text>
                                <Text style={styles.detailValue}>
                                    {selectedRecord.intervalDays ? `${selectedRecord.intervalDays}일` : "—"}
                                </Text>
                            </View>
                        </View>

                        {/* 메모 */}
                        {selectedRecord.memo ? (
                            <View style={styles.card}>
                                <View style={styles.cardTitleRow}>
                                    <Ionicons
                                        name="document-text-outline"
                                        size={18}
                                        color={Colors.fertilizerIcon}
                                    />
                                    <Text style={styles.cardTitle}>메모</Text>
                                </View>
                                <Text style={styles.memoReadText}>{selectedRecord.memo}</Text>
                            </View>
                        ) : null}

                        {/* 사진 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="images-outline" size={18} color={Colors.fertilizerIcon} />
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
                <ScreenHeader
                    title="새 영양제 기록"
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
                        {/* 영양제 종류 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="flask-outline" size={18} color={Colors.fertilizerIcon} />
                                <Text style={styles.cardTitle}>영양제 종류</Text>
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="예: 액체비료, 하이포넥스"
                                placeholderTextColor={Colors.textFaint}
                                value={fertilizerType}
                                onChangeText={setFertilizerType}
                            />
                        </View>

                        {/* 용량 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="beaker-outline" size={18} color={Colors.fertilizerIcon} />
                                <Text style={styles.cardTitle}>용량</Text>
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="예: 5ml, 1알"
                                placeholderTextColor={Colors.textFaint}
                                value={amount}
                                onChangeText={setAmount}
                            />
                        </View>

                        {/* 다음 주기 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="repeat-outline" size={18} color={Colors.fertilizerIcon} />
                                <Text style={styles.cardTitle}>다음 주기</Text>
                            </View>
                            <View style={styles.intervalRow}>
                                <TextInput
                                    style={[styles.textInput, styles.intervalInput]}
                                    placeholder="14"
                                    placeholderTextColor={Colors.textFaint}
                                    value={intervalDays}
                                    onChangeText={(v) => setIntervalDays(v.replace(/[^0-9]/g, ""))}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                />
                                <Text style={styles.intervalSuffix}>일마다</Text>
                            </View>
                        </View>

                        {/* 메모 / 기록 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons
                                    name="document-text-outline"
                                    size={18}
                                    color={Colors.fertilizerIcon}
                                />
                                <Text style={styles.cardTitle}>메모 / 기록</Text>
                            </View>
                            <TextInput
                                style={[styles.textInput, styles.memoInput]}
                                placeholder="영양제 종류, 식물 반응 등을 기록하세요"
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
                                <Ionicons name="images-outline" size={18} color={Colors.fertilizerIcon} />
                                <Text style={styles.cardTitle}>사진</Text>
                            </View>
                            <PhotoPickerButton />
                        </View>

                        <ActionButton
                            label="저장하기"
                            color={Colors.fertilizerIcon}
                            onPress={saveRecord}
                        />
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* 저장 완료 모달 */}
                <Modal
                    visible={showCharacterModal}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={handleCharacterChoice}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalBox}>
                            <Text style={styles.modalEmoji}>💪</Text>
                            <Text style={styles.modalTitle}>영양 보충 완료!</Text>
                            <Text style={styles.modalBody}>
                                든든하게 영양을 채웠어요.{"\n"}
                                다음 영양제 날까지 무럭무럭 자랄게요!
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

                            <ActionButton
                                label="확인"
                                color={Colors.fertilizerIcon}
                                size="md"
                                shadow={false}
                                activeOpacity={0.8}
                                onPress={handleCharacterChoice}
                                style={styles.modalButton}
                            />
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
        borderLeftColor: GreenTint.soft,
    },
    recordIconWrap: {
        width: 42,
        height: 42,
        borderRadius: Radius.pill,
        backgroundColor: Colors.fertilizer,
        alignItems: "center",
        justifyContent: "center",
    },
    recordIconPlus: {
        fontSize: FontSizes.title,
        color: Colors.fertilizerIcon,
        includeFontPadding: false,
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
        alignItems: "center",
        justifyContent: "center",
    },
    typeChip: {
        backgroundColor: Colors.fertilizer,
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

    // Detail rows
    detailRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    detailLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 24,
        color: GreenTint.strong,
        includeFontPadding: false,
    },
    detailValue: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        lineHeight: 24,
        color: Colors.textBlack,
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
    intervalRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },
    intervalInput: {
        width: 72,
        textAlign: "center",
    },
    intervalSuffix: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
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
        backgroundColor: Colors.fertilizer,
        borderWidth: 1,
        borderColor: Colors.fertilizerIcon,
    },
    affinityGainHeart: {
        width: 16,
        height: 16,
    },
    affinityGainText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.fertilizerIcon,
        includeFontPadding: false,
    },
    modalButton: {
        paddingHorizontal: Spacing.huge,
        borderRadius: Radius.lg,
    },
});