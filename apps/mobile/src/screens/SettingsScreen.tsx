import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StatusBar,
    Switch,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const FONT = "NeoDunggeunmoPro-Regular";

const FAQ_ITEMS = [
    {
        id: "1",
        q: "분갈이는 얼마나 자주 해야 하나요?",
        a: "일반적으로 1~2년에 한 번이 적당합니다. 뿌리가 화분 밖으로 나오거나 성장이 둔해지면 분갈이 시기예요.",
    },
    {
        id: "2",
        q: "물은 얼마나 자주 줘야 하나요?",
        a: "식물마다 다르지만 겉흙이 마르면 흠뻑 주는 것이 기본입니다. 과습은 뿌리 썩음의 주된 원인이 됩니다.",
    },
    {
        id: "3",
        q: "LeafLog는 어떤 앱인가요?",
        a: "LeafLog는 AI 기반 식물 케어 앱으로, 식물의 상태를 기록하고 맞춤 돌봄 알림을 제공합니다.",
    },
    {
        id: "4",
        q: "AI 상담은 어떻게 이용하나요?",
        a: "식물 상세 페이지의 채팅 버튼을 누르면 AI와 대화하며 식물 상태를 진단받을 수 있습니다.",
    },
];

function RowDivider() {
    return <View style={styles.divider} />;
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
    return (
        <View style={styles.sectionLabelRow}>
            <Ionicons name={icon as any} size={16} color="#5A8A5A" />
            <Text style={styles.sectionLabelText}>{label}</Text>
        </View>
    );
}

function VolumeControl({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <View style={styles.volumeRow}>
            <TouchableOpacity
                onPress={() => onChange(Math.max(0, value - 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons name="remove-circle-outline" size={26} color="#5A8A5A" />
            </TouchableOpacity>
            <View style={styles.volumeTrack}>
                {Array.from({ length: 10 }, (_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.volumeSegment,
                            i < value ? styles.volumeSegmentOn : styles.volumeSegmentOff,
                        ]}
                    />
                ))}
            </View>
            <TouchableOpacity
                onPress={() => onChange(Math.min(10, value + 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons name="add-circle-outline" size={26} color="#5A8A5A" />
            </TouchableOpacity>
        </View>
    );
}

export default function SettingsScreen({
    navigation,
    username,
    setUsername,
}: {
    navigation: any;
    username: string;
    setUsername: (name: string) => void;
}) {
    // 어카운트
    const [isEditingName, setIsEditingName] = useState(false);
    const [draftName, setDraftName] = useState(username);

    // 알림
    const [notifEnabled, setNotifEnabled] = useState(true);
    const [notifHour, setNotifHour] = useState(8);
    const [notifMinute, setNotifMinute] = useState(0);

    // 사운드&진동
    const [bgmVolume, setBgmVolume] = useState(7);
    const [sfxVolume, setSfxVolume] = useState(8);
    const [vibration, setVibration] = useState(true);

    // 도움말
    const [openFaqId, setOpenFaqId] = useState<string | null>(null);
    const [showInquiry, setShowInquiry] = useState(false);
    const [inquiryContent, setInquiryContent] = useState("");
    const [inquiryDone, setInquiryDone] = useState(false);

    const saveName = () => {
        if (draftName.trim()) setUsername(draftName.trim());
        setIsEditingName(false);
    };

    const adjustHour = (d: number) =>
        setNotifHour((prev) => (prev + d + 24) % 24);

    const adjustMinute = (d: number) =>
        setNotifMinute((prev) => (prev + d * 10 + 60) % 60);

    const submitInquiry = () => {
        if (!inquiryContent.trim()) return;
        setInquiryDone(true);
        setInquiryContent("");
    };

    const logout = () => {
        Alert.alert(
            "로그아웃",
            "정말로 로그아웃 하시겠어요?",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "로그아웃",
                    onPress: () => navigation.navigate("Home"),
                },
            ]
        );
    };

    const deleteAccount = () => {
        Alert.alert(
            "계정 삭제",
            "정말로 계정을 삭제하시겠어요?\n모든 데이터가 삭제되며 복구할 수 없습니다.",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "삭제",
                    style: "destructive",
                    onPress: () => navigation.navigate("Home"),
                },
            ]
        );
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={28} color="#2B3E25" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>설정</Text>
                    <View style={styles.headerButton} />
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* ── 어카운트 ─────────────────────── */}
                        <View style={styles.card}>
                            <SectionLabel icon="person-outline" label="어카운트" />
                            <RowDivider />

                            <View style={styles.row}>
                                <Text style={styles.rowLabel}>이름</Text>
                                {isEditingName ? (
                                    <View style={styles.nameEditRow}>
                                        <TextInput
                                            style={styles.nameInput}
                                            value={draftName}
                                            onChangeText={setDraftName}
                                            autoFocus
                                            maxLength={5}
                                            returnKeyType="done"
                                            onSubmitEditing={saveName}
                                        />
                                        <TouchableOpacity
                                            style={styles.saveBtn}
                                            onPress={saveName}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.saveBtnText}>저장</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.nameDisplayRow}
                                        onPress={() => {
                                            setDraftName(username);
                                            setIsEditingName(true);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.nameValue}>{username}</Text>
                                        <Ionicons name="pencil-outline" size={16} color="#8AB08A" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <RowDivider />

                            <TouchableOpacity
                                style={styles.row}
                                onPress={logout}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.rowLabel}>로그아웃</Text>
                                <Ionicons name="log-out-outline" size={20} color="#8AB08A" />
                            </TouchableOpacity>

                            <RowDivider />

                            <TouchableOpacity
                                style={styles.row}
                                onPress={deleteAccount}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.deleteLabel}>계정 삭제</Text>
                                <Ionicons name="chevron-forward" size={18} color="#D4887A" />
                            </TouchableOpacity>
                        </View>

                        {/* ── 알림 ──────────────────────────── */}
                        <View style={styles.card}>
                            <SectionLabel icon="notifications-outline" label="알림" />
                            <RowDivider />

                            <View style={styles.row}>
                                <Text style={styles.rowLabel}>돌보기 알림</Text>
                                <Switch
                                    value={notifEnabled}
                                    onValueChange={setNotifEnabled}
                                    trackColor={{ false: "#E0E0E0", true: "#A8D5A2" }}
                                    thumbColor="#FFFFFF"
                                    ios_backgroundColor="#E0E0E0"
                                />
                            </View>

                            {notifEnabled && (
                                <>
                                    <RowDivider />
                                    <View style={styles.row}>
                                        <Text style={styles.rowLabel}>알림 시간</Text>
                                        <View style={styles.timePicker}>
                                            <View style={styles.timeSpinner}>
                                                <TouchableOpacity
                                                    onPress={() => adjustHour(1)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="chevron-up" size={20} color="#5A8A5A" />
                                                </TouchableOpacity>
                                                <Text style={styles.timeValue}>
                                                    {String(notifHour).padStart(2, "0")}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => adjustHour(-1)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="chevron-down" size={20} color="#5A8A5A" />
                                                </TouchableOpacity>
                                            </View>

                                            <Text style={styles.timeColon}>:</Text>

                                            <View style={styles.timeSpinner}>
                                                <TouchableOpacity
                                                    onPress={() => adjustMinute(1)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="chevron-up" size={20} color="#5A8A5A" />
                                                </TouchableOpacity>
                                                <Text style={styles.timeValue}>
                                                    {String(notifMinute).padStart(2, "0")}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => adjustMinute(-1)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="chevron-down" size={20} color="#5A8A5A" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* ── 사운드&진동 ───────────────────── */}
                        <View style={styles.card}>
                            <SectionLabel icon="musical-notes-outline" label="사운드&진동" />
                            <RowDivider />

                            <View style={styles.volumeItem}>
                                <Text style={styles.rowLabel}>배경음악</Text>
                                <VolumeControl value={bgmVolume} onChange={setBgmVolume} />
                            </View>

                            <RowDivider />

                            <View style={styles.volumeItem}>
                                <Text style={styles.rowLabel}>효과음</Text>
                                <VolumeControl value={sfxVolume} onChange={setSfxVolume} />
                            </View>

                            <RowDivider />

                            <View style={styles.row}>
                                <Text style={styles.rowLabel}>진동</Text>
                                <Switch
                                    value={vibration}
                                    onValueChange={setVibration}
                                    trackColor={{ false: "#E0E0E0", true: "#A8D5A2" }}
                                    thumbColor="#FFFFFF"
                                    ios_backgroundColor="#E0E0E0"
                                />
                            </View>
                        </View>

                        {/* ── 도움말 ────────────────────────── */}
                        <View style={styles.card}>
                            <SectionLabel icon="help-circle-outline" label="도움말" />
                            <RowDivider />

                            <Text style={styles.faqSectionTitle}>자주 하는 질문</Text>

                            {FAQ_ITEMS.map((faq, i) => {
                                const isOpen = openFaqId === faq.id;
                                return (
                                    <View key={faq.id}>
                                        <TouchableOpacity
                                            style={styles.faqRow}
                                            onPress={() =>
                                                setOpenFaqId(isOpen ? null : faq.id)
                                            }
                                            activeOpacity={0.75}
                                        >
                                            <Text
                                                style={styles.faqQuestion}
                                                numberOfLines={isOpen ? undefined : 1}
                                            >
                                                {faq.q}
                                            </Text>
                                            <Ionicons
                                                name={isOpen ? "chevron-up" : "chevron-down"}
                                                size={16}
                                                color="#8AB08A"
                                            />
                                        </TouchableOpacity>

                                        {isOpen && (
                                            <View style={styles.faqAnswer}>
                                                <Text style={styles.faqAnswerText}>{faq.a}</Text>
                                            </View>
                                        )}

                                        {i < FAQ_ITEMS.length - 1 && <RowDivider />}
                                    </View>
                                );
                            })}

                            <RowDivider />

                            {/* 문의하기 */}
                            <TouchableOpacity
                                style={styles.row}
                                onPress={() => {
                                    setShowInquiry(!showInquiry);
                                    setInquiryDone(false);
                                }}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.rowLabel}>문의하기</Text>
                                <Ionicons
                                    name={showInquiry ? "chevron-up" : "chevron-down"}
                                    size={18}
                                    color="#8AB08A"
                                />
                            </TouchableOpacity>

                            {showInquiry && (
                                <View style={styles.inquiryArea}>
                                    {inquiryDone ? (
                                        <View style={styles.inquiryDone}>
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={32}
                                                color="#5A9A5A"
                                            />
                                            <Text style={styles.inquiryDoneText}>
                                                문의가 접수되었습니다.{"\n"}빠르게 답변 드릴게요!
                                            </Text>
                                        </View>
                                    ) : (
                                        <>
                                            <TextInput
                                                style={styles.inquiryInput}
                                                placeholder="문의 내용을 입력해주세요"
                                                placeholderTextColor="#C0C8BC"
                                                value={inquiryContent}
                                                onChangeText={setInquiryContent}
                                                multiline
                                                textAlignVertical="top"
                                            />
                                            <TouchableOpacity
                                                style={[
                                                    styles.inquirySubmitBtn,
                                                    !inquiryContent.trim() &&
                                                        styles.inquirySubmitBtnDisabled,
                                                ]}
                                                onPress={submitInquiry}
                                                activeOpacity={0.82}
                                                disabled={!inquiryContent.trim()}
                                            >
                                                <Text style={styles.inquirySubmitText}>
                                                    제출하기
                                                </Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            )}
                        </View>

                        <Text style={styles.versionText}>LeafLog v1.0.0</Text>
                    </ScrollView>
                </KeyboardAvoidingView>
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

    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "#E0EBCD",
        paddingHorizontal: 20,
        paddingVertical: 4,
    },

    sectionLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 14,
    },
    sectionLabelText: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#5A8A5A",
        includeFontPadding: false,
    },

    divider: {
        height: 1,
        backgroundColor: "#F0EEE2",
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
    },
    rowLabel: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#222222",
        includeFontPadding: false,
    },

    // 어카운트
    nameDisplayRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    nameValue: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#2F702D",
        includeFontPadding: false,
    },
    nameEditRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    nameInput: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#111111",
        backgroundColor: "#F6FAF0",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#D8E8C8",
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 100,
        includeFontPadding: false,
    },
    saveBtn: {
        backgroundColor: "#2F702D",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    saveBtnText: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#FFFFFF",
        includeFontPadding: false,
    },
    deleteLabel: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#D4887A",
        includeFontPadding: false,
    },

    // 알림 시간
    timePicker: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    timeSpinner: {
        alignItems: "center",
        gap: 2,
    },
    timeValue: {
        fontFamily: FONT,
        fontSize: 22,
        color: "#111111",
        minWidth: 36,
        textAlign: "center",
        includeFontPadding: false,
    },
    timeColon: {
        fontFamily: FONT,
        fontSize: 22,
        color: "#111111",
        includeFontPadding: false,
        marginBottom: 2,
    },

    // 볼륨
    volumeItem: {
        paddingVertical: 14,
        gap: 10,
    },
    volumeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    volumeTrack: {
        flex: 1,
        flexDirection: "row",
        gap: 3,
    },
    volumeSegment: {
        flex: 1,
        height: 8,
        borderRadius: 4,
    },
    volumeSegmentOn: {
        backgroundColor: "#5A9A5A",
    },
    volumeSegmentOff: {
        backgroundColor: "#E0EBCD",
    },

    // FAQ
    faqSectionTitle: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#7A9A7A",
        includeFontPadding: false,
        paddingTop: 4,
        paddingBottom: 8,
    },
    faqRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 13,
        gap: 10,
    },
    faqQuestion: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#222222",
        flex: 1,
        includeFontPadding: false,
    },
    faqAnswer: {
        backgroundColor: "#F6FAF0",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 6,
    },
    faqAnswerText: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#444444",
        lineHeight: 20,
        includeFontPadding: false,
    },

    // 문의하기
    inquiryArea: {
        gap: 10,
        paddingBottom: 10,
    },
    inquiryInput: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#111111",
        backgroundColor: "#F6FAF0",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#D8E8C8",
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 10,
        height: 110,
        textAlignVertical: "top",
        includeFontPadding: false,
    },
    inquirySubmitBtn: {
        backgroundColor: "#2F702D",
        borderRadius: 12,
        paddingVertical: 13,
        alignItems: "center",
        shadowColor: "#2F702D",
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    inquirySubmitBtnDisabled: {
        backgroundColor: "#B8CEB0",
        shadowOpacity: 0,
        elevation: 0,
    },
    inquirySubmitText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#FFFFFF",
        includeFontPadding: false,
    },
    inquiryDone: {
        alignItems: "center",
        gap: 10,
        paddingVertical: 18,
    },
    inquiryDoneText: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#4A7A4A",
        textAlign: "center",
        lineHeight: 22,
        includeFontPadding: false,
    },

    versionText: {
        fontFamily: FONT,
        fontSize: 12,
        color: "#B0B8A8",
        textAlign: "center",
        includeFontPadding: false,
    },
});