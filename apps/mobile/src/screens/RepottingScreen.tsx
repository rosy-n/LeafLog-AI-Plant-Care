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

const FONT = "NeoDunggeunmoPro-Regular";

const SOIL_COLORS = ["#A8D5A2", "#F5C87A", "#B8A5D4", "#F5A07A", "#7AC5F5"];

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
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.headerButton}
                onPress={onBack}
                activeOpacity={0.7}
            >
                <Ionicons name="chevron-back" size={28} color="#2B3E25" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.headerButton} />
        </View>
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
                <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
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
                            <Ionicons name="add-circle-outline" size={22} color="#2F702D" />
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
                                                <Ionicons name="leaf-outline" size={22} color="#3D7842" />
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
                                            <Ionicons name="chevron-forward" size={18} color="#BBCBB8" />
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
                                            <Ionicons name="trash-outline" size={19} color="#D4887A" />
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
                <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
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
                                <Ionicons name="resize-outline" size={18} color="#5A8A5A" />
                                <Text style={styles.cardTitle}>화분 크기</Text>
                            </View>
                            <Text style={styles.cardValueLarge}>
                                {selectedRecord.potSize || "—"}
                            </Text>
                        </View>

                        {/* 흙 구성 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="earth-outline" size={18} color="#5A8A5A" />
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
                                        color="#5A8A5A"
                                    />
                                    <Text style={styles.cardTitle}>메모</Text>
                                </View>
                                <Text style={styles.memoReadText}>{selectedRecord.memo}</Text>
                            </View>
                        ) : null}

                        {/* 사진 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="images-outline" size={18} color="#5A8A5A" />
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
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
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
                                <Ionicons name="resize-outline" size={18} color="#5A8A5A" />
                                <Text style={styles.cardTitle}>화분 크기</Text>
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="예: 12cm, 4호"
                                placeholderTextColor="#C0C8BC"
                                value={potSize}
                                onChangeText={setPotSize}
                            />
                        </View>

                        {/* 흙 정보 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="earth-outline" size={18} color="#5A8A5A" />
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
                                        placeholderTextColor="#C0C8BC"
                                        value={entry.type}
                                        onChangeText={(v) => updateSoilEntry(index, "type", v)}
                                    />
                                    <TextInput
                                        style={[styles.textInput, styles.soilRatioInput]}
                                        placeholder="0"
                                        placeholderTextColor="#C0C8BC"
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
                                                color="#D4887A"
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
                                <Ionicons name="add" size={16} color="#2F702D" />
                                <Text style={styles.addSoilText}>흙 종류 추가</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 메모 / 기록 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons
                                    name="document-text-outline"
                                    size={18}
                                    color="#5A8A5A"
                                />
                                <Text style={styles.cardTitle}>메모 / 기록</Text>
                            </View>
                            <TextInput
                                style={[styles.textInput, styles.memoInput]}
                                placeholder="분갈이 중 특이사항, 식물 상태 등을 기록하세요"
                                placeholderTextColor="#C0C8BC"
                                value={memo}
                                onChangeText={setMemo}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        {/* 사진 */}
                        <View style={styles.card}>
                            <View style={styles.cardTitleRow}>
                                <Ionicons name="images-outline" size={18} color="#5A8A5A" />
                                <Text style={styles.cardTitle}>사진</Text>
                            </View>
                            <TouchableOpacity style={styles.photoButton} activeOpacity={0.75}>
                                <Ionicons name="camera-outline" size={28} color="#8AB08A" />
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
                                    <Ionicons name="camera" size={15} color="#FFFFFF" />
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
        fontFamily: FONT,
        fontSize: 25,
        color: "#111111",
        includeFontPadding: false,
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 40,
        gap: 14,
    },

    // New Record Button
    newRecordButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#A8D5A2",
        paddingVertical: 16,
    },
    newRecordText: {
        fontFamily: FONT,
        fontSize: 16,
        color: "#2F702D",
        includeFontPadding: false,
    },

    // Section Label
    sectionLabel: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#7A9A7A",
        includeFontPadding: false,
        marginBottom: -4,
    },

    // Record Card (List)
    recordCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#E0EBCD",
        overflow: "hidden",
    },
    recordMainTouch: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    deleteButton: {
        paddingHorizontal: 14,
        paddingVertical: 14,
        justifyContent: "center",
        alignItems: "center",
        borderLeftWidth: 1,
        borderLeftColor: "#EEE8D8",
    },
    recordIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#EEF7E8",
        alignItems: "center",
        justifyContent: "center",
    },
    recordBody: {
        flex: 1,
        gap: 8,
    },
    recordDate: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#222222",
        includeFontPadding: false,
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    chip: {
        backgroundColor: "#F0F5EC",
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 4,
    },
    soilChip: {
        backgroundColor: "#F5C87A44",
    },
    chipText: {
        fontFamily: FONT,
        fontSize: 12,
        color: "#4A6A4A",
        includeFontPadding: false,
    },

    // Empty
    emptyState: {
        paddingTop: 60,
        alignItems: "center",
    },
    emptyText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#B0B8A8",
        includeFontPadding: false,
    },
    emptySubText: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#B0B8A8",
        includeFontPadding: false,
        marginTop: 2,
    },

    // Card
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "#E0EBCD",
        paddingHorizontal: 20,
        paddingVertical: 18,
        gap: 12,
    },
    cardTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    cardTitle: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#2A4A18",
        includeFontPadding: false,
    },
    cardValueLarge: {
        fontFamily: FONT,
        fontSize: 22,
        color: "#111111",
        includeFontPadding: false,
    },

    // Soil (Detail)
    soilBar: {
        flexDirection: "row",
        height: 18,
        borderRadius: 10,
        overflow: "hidden",
    },
    soilBarSegment: {
        height: "100%",
    },
    soilDetailRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    soilDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    soilDetailType: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#333333",
        flex: 1,
        includeFontPadding: false,
    },
    soilDetailRatio: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#666666",
        includeFontPadding: false,
    },
    memoReadText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#333333",
        lineHeight: 22,
        includeFontPadding: false,
    },

    // Form Inputs
    textInput: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#111111",
        backgroundColor: "#F6FAF0",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#D8E8C8",
        paddingHorizontal: 12,
        paddingVertical: 10,
        includeFontPadding: false,
    },
    soilInputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    soilTypeInput: {
        flex: 1,
    },
    soilRatioInput: {
        width: 52,
        textAlign: "center",
    },
    percentSign: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#5A7A5A",
        includeFontPadding: false,
    },
    addSoilButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 4,
        alignSelf: "flex-start",
    },
    addSoilText: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#2F702D",
        includeFontPadding: false,
    },
    memoInput: {
        height: 100,
        textAlignVertical: "top",
        paddingTop: 10,
    },
    photoButton: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F6FAF0",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#D8E8C8",
        height: 88,
        gap: 6,
    },
    photoButtonText: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#8AB08A",
        includeFontPadding: false,
    },
    saveButton: {
        backgroundColor: "#2F702D",
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: "center",
        shadowColor: "#2F702D",
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    saveButtonText: {
        fontFamily: FONT,
        fontSize: 16,
        color: "#FFFFFF",
        includeFontPadding: false,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.48)",
        alignItems: "center",
        justifyContent: "center",
    },
    modalBox: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        paddingHorizontal: 28,
        paddingTop: 32,
        paddingBottom: 24,
        marginHorizontal: 32,
        alignItems: "center",
        gap: 8,
        shadowColor: "#000000",
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    modalEmoji: {
        fontSize: 48,
        marginBottom: 4,
    },
    modalTitle: {
        fontFamily: FONT,
        fontSize: 22,
        color: "#111111",
        includeFontPadding: false,
    },
    modalBody: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#555555",
        textAlign: "center",
        lineHeight: 22,
        includeFontPadding: false,
        marginTop: 4,
        marginBottom: 8,
    },
    modalButtonRow: {
        flexDirection: "row",
        gap: 10,
        width: "100%",
    },
    modalButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 13,
        borderRadius: 14,
    },
    modalButtonGray: {
        backgroundColor: "#F0F0F0",
    },
    modalButtonGreen: {
        backgroundColor: "#2F702D",
    },
    modalButtonGrayText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#555555",
        includeFontPadding: false,
    },
    modalButtonGreenText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#FFFFFF",
        includeFontPadding: false,
    },
});