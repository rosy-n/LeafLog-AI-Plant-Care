import React, { useCallback, useEffect, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import { deleteMe, getUserSettings, updateMe } from "../api";
import {
    sendTestReminder,
    listScheduledReminders,
    syncWateringReminders,
} from "../notifications";
import {
    DEFAULT_NOTIFICATION_SETTINGS,
    loadNotificationSettings,
    saveNotificationSettings,
} from "../notificationSettings";
import { useBackgroundMusic } from "../backgroundMusic";
import { VOLUME_STEPS } from "../audioSettings";

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
            <Ionicons name={icon as any} size={16} color={GreenTint.strong} />
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
                <Ionicons name="remove-circle-outline" size={26} color={GreenTint.strong} />
            </TouchableOpacity>
            <View style={styles.volumeTrack}>
                {Array.from({ length: VOLUME_STEPS }, (_, i) => (
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
                onPress={() => onChange(Math.min(VOLUME_STEPS, value + 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons name="add-circle-outline" size={26} color={GreenTint.strong} />
            </TouchableOpacity>
        </View>
    );
}

export default function SettingsScreen({
    navigation,
    username,
    setUsername,
    onLogout,
}: {
    navigation: any;
    username: string;
    setUsername: (name: string) => void;
    onLogout?: () => void;
}) {
    // 어카운트
    const [isEditingName, setIsEditingName] = useState(false);
    const [draftName, setDraftName] = useState(username);
    const [isSavingName, setIsSavingName] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");

    // 위치 — 위치 변경 화면에서 돌아올 때마다 최신값으로 갱신
    const [homeLocation, setHomeLocation] = useState<string | null>(null);
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            getUserSettings()
                .then((result) => {
                    if (!cancelled) setHomeLocation(result.default_location);
                })
                .catch(() => {});
            return () => {
                cancelled = true;
            };
        }, [])
    );

    // 알림 — 저장된 설정을 불러와 표시하고, 바꾸면 저장 + 예약을 다시 맞춘다
    const [notifEnabled, setNotifEnabled] = useState(DEFAULT_NOTIFICATION_SETTINGS.enabled);
    const [notifHour, setNotifHour] = useState(DEFAULT_NOTIFICATION_SETTINGS.hour);
    const [notifMinute, setNotifMinute] = useState(DEFAULT_NOTIFICATION_SETTINGS.minute);
    const [notifLoaded, setNotifLoaded] = useState(false);

    // 사운드&진동 — 볼륨은 앱 전체가 쓰는 플레이어와 공유하고, 바꾸면 기기에 저장된다
    const { bgmVolume, sfxVolume, setBgmVolume, setSfxVolume } = useBackgroundMusic();
    // 효과음은 아직 재생 지점이 없어서 값만 저장된다
    const [vibration, setVibration] = useState(true);

    // 도움말
    const [openFaqId, setOpenFaqId] = useState<string | null>(null);
    const [showInquiry, setShowInquiry] = useState(false);
    const [inquiryContent, setInquiryContent] = useState("");
    const [inquiryDone, setInquiryDone] = useState(false);

    // 이름 변경 — 서버(app_user.nickname)에 저장한 뒤 화면 값을 갱신한다.
    // 실패하면 편집 상태를 유지해서 사용자가 고칠 수 있게 한다.
    const saveName = async () => {
        const next = draftName.trim();
        if (!next || isSavingName) return;
        if (next === username) {
            setIsEditingName(false);
            return;
        }

        setIsSavingName(true);
        try {
            const updated = await updateMe({ nickname: next });
            setUsername(updated.nickname);
            setIsEditingName(false);
        } catch (e: any) {
            Alert.alert("이름 변경 실패", e?.message ?? "다시 시도해주세요.");
        } finally {
            setIsSavingName(false);
        }
    };

    // 예약된 물주기 알림 목록 — 알럿은 닫히면 사라져서 확인이 어려우니 화면에 둔다
    const [reminders, setReminders] = useState<
        { plantId: string; title: string; dueDate: string }[]
    >([]);

    const refreshReminders = useCallback(() => {
        listScheduledReminders()
            .then(setReminders)
            .catch((e) => console.warn("예약 목록 조회 실패:", e?.message));
    }, []);

    // 화면에 들어올 때마다 갱신 — 물주기·주기 변경 후 돌아와서 바로 확인할 수 있게
    useFocusEffect(refreshReminders);

    // 저장된 알림 설정 불러오기
    useEffect(() => {
        let mounted = true;
        loadNotificationSettings().then((settings) => {
            if (!mounted) return;
            setNotifEnabled(settings.enabled);
            setNotifHour(settings.hour);
            setNotifMinute(settings.minute);
            setNotifLoaded(true);
        });
        return () => {
            mounted = false;
        };
    }, []);

    // 설정이 바뀌면 저장하고 예약을 새 시각으로 다시 맞춘다.
    // 불러오기 전에는 실행하지 않는다 (기본값으로 저장해 사용자 설정을 덮어쓰지 않게)
    useEffect(() => {
        if (!notifLoaded) return;
        saveNotificationSettings({
            enabled: notifEnabled,
            hour: notifHour,
            minute: notifMinute,
        })
            .then(() => syncWateringReminders())
            .then(refreshReminders)
            .catch((e) => console.warn("알림 설정 저장 실패:", e?.message));
    }, [notifLoaded, notifEnabled, notifHour, notifMinute, refreshReminders]);

    const runNotificationTest = async () => {
        try {
            const ok = await sendTestReminder(5);
            if (!ok) {
                Alert.alert(
                    "알림 권한이 없어요",
                    "기기 설정에서 LeafLog 알림을 허용해 주세요.",
                );
                return;
            }
            refreshReminders();
        } catch (e: any) {
            Alert.alert("알림 테스트 실패", e?.message ?? "다시 시도해주세요.");
        }
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
                    // 토큰 삭제·예약 알림 취소·로그인 화면 복귀는 App.tsx 가 처리한다
                    onPress: () => onLogout?.(),
                },
            ]
        );
    };

    // 계정 삭제 — 서버에서 개체·돌봄 기록·상담 내역까지 함께 지운다.
    // 삭제가 끝나면 토큰이 가리키는 사용자가 없어지므로(다음 요청이 401) 로그아웃과
    // 같은 뒷정리가 필요하다 — 토큰 삭제·예약 알림 취소는 onLogout 이 이미 하고 있어
    // 그대로 재사용한다.
    const runAccountDeletion = async () => {
        if (isDeletingAccount) return;
        setIsDeletingAccount(true);
        try {
            await deleteMe(deletePassword);
            setDeletePassword("");
            setShowDeleteConfirm(false);
            onLogout?.();
        } catch (e: any) {
            // 비밀번호가 틀리면 서버가 401을 준다 — 입력만 비우고 창은 열어 둔다
            setDeletePassword("");
            Alert.alert("계정 삭제 실패", e?.message ?? "다시 시도해주세요.");
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const deleteAccount = () => {
        if (isDeletingAccount || !deletePassword) return;
        Alert.alert(
            "계정 삭제",
            "정말로 계정을 삭제하시겠어요?\n모든 데이터가 삭제되며 복구할 수 없습니다.",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "삭제",
                    style: "destructive",
                    onPress: runAccountDeletion,
                },
            ]
        );
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                <ScreenHeader title="설정" onBack={() => navigation.goBack()} />

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
                                            // 서버 규칙과 동일하게 2~10자 (한글/영문/숫자)
                                            maxLength={10}
                                            returnKeyType="done"
                                            editable={!isSavingName}
                                            onSubmitEditing={saveName}
                                        />
                                        <TouchableOpacity
                                            style={[
                                                styles.saveBtn,
                                                isSavingName && styles.saveBtnDisabled,
                                            ]}
                                            onPress={saveName}
                                            activeOpacity={0.8}
                                            disabled={isSavingName}
                                        >
                                            <Text style={styles.saveBtnText}>
                                                {isSavingName ? "저장 중" : "저장"}
                                            </Text>
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
                                        <Ionicons name="pencil-outline" size={16} color={GreenTint.line} />
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
                                <Ionicons name="log-out-outline" size={20} color={GreenTint.line} />
                            </TouchableOpacity>

                            <RowDivider />

                            <TouchableOpacity
                                style={styles.row}
                                onPress={() => {
                                    setShowDeleteConfirm(!showDeleteConfirm);
                                    setDeletePassword("");
                                }}
                                activeOpacity={0.75}
                                disabled={isDeletingAccount}
                            >
                                <Text style={styles.deleteLabel}>
                                    {isDeletingAccount ? "계정 삭제 중" : "계정 삭제"}
                                </Text>
                                <Ionicons
                                    name={showDeleteConfirm ? "chevron-up" : "chevron-down"}
                                    size={18}
                                    color={Colors.remove}
                                />
                            </TouchableOpacity>

                            {/* 되돌릴 수 없는 작업이라 본인 확인으로 비밀번호를 다시 받는다 */}
                            {showDeleteConfirm && (
                                <View style={styles.deleteConfirmArea}>
                                    <Text style={styles.deleteWarning}>
                                        계정을 삭제하면 등록한 개체와 돌봄 기록,
                                        상담 내역이 모두 사라지고 되돌릴 수 없어요.
                                    </Text>
                                    <TextInput
                                        style={styles.deleteInput}
                                        placeholder="비밀번호를 입력해주세요"
                                        placeholderTextColor={Colors.textFaint}
                                        value={deletePassword}
                                        onChangeText={setDeletePassword}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!isDeletingAccount}
                                        returnKeyType="done"
                                        onSubmitEditing={deleteAccount}
                                    />
                                    <TouchableOpacity
                                        style={[
                                            styles.deleteSubmitBtn,
                                            (!deletePassword || isDeletingAccount) &&
                                                styles.deleteSubmitBtnDisabled,
                                        ]}
                                        onPress={deleteAccount}
                                        activeOpacity={0.82}
                                        disabled={!deletePassword || isDeletingAccount}
                                    >
                                        <Text style={styles.deleteSubmitText}>
                                            {isDeletingAccount ? "삭제 중" : "계정 삭제하기"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* ── 위치 ──────────────────────────── */}
                        <View style={styles.card}>
                            <SectionLabel icon="home-outline" label="위치" />
                            <RowDivider />

                            <View style={styles.row}>
                                <Text style={styles.rowLabel}>우리 집</Text>
                                <Text style={styles.nameValue} numberOfLines={1}>
                                    {homeLocation ?? "설정 안 됨"}
                                </Text>
                            </View>

                            <RowDivider />

                            <TouchableOpacity
                                style={styles.row}
                                onPress={() => navigation.navigate("LocationSetting")}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.rowLabel}>위치 변경하기</Text>
                                <Ionicons name="chevron-forward" size={18} color={GreenTint.line} />
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
                                    trackColor={{ false: Colors.border, true: GreenTint.line }}
                                    thumbColor={Colors.white}
                                    ios_backgroundColor={Colors.border}
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
                                                    <Ionicons name="chevron-up" size={20} color={GreenTint.strong} />
                                                </TouchableOpacity>
                                                <Text style={styles.timeValue}>
                                                    {String(notifHour).padStart(2, "0")}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => adjustHour(-1)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="chevron-down" size={20} color={GreenTint.strong} />
                                                </TouchableOpacity>
                                            </View>

                                            <Text style={styles.timeColon}>:</Text>

                                            <View style={styles.timeSpinner}>
                                                <TouchableOpacity
                                                    onPress={() => adjustMinute(1)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="chevron-up" size={20} color={GreenTint.strong} />
                                                </TouchableOpacity>
                                                <Text style={styles.timeValue}>
                                                    {String(notifMinute).padStart(2, "0")}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => adjustMinute(-1)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="chevron-down" size={20} color={GreenTint.strong} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>

                                    {/*
                                        알림 동작 확인용 임시 경로.
                                        실제 물주기 알림은 예정일 09:00 에 오므로 그날까지
                                        기다려야 확인이 된다. 권한·채널·수신·탭 이동을
                                        한 번에 점검하려고 둔 것이고, 확인이 끝나면 지운다.
                                    */}
                                    <RowDivider />
                                    <TouchableOpacity
                                        style={styles.row}
                                        onPress={runNotificationTest}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.rowLabel}>알림 테스트 (5초 뒤)</Text>
                                        <Ionicons
                                            name="chevron-forward"
                                            size={20}
                                            color={GreenTint.strong}
                                        />
                                    </TouchableOpacity>

                                    <RowDivider />
                                    <View style={styles.reminderBlock}>
                                        <Text style={styles.rowLabel}>
                                            예약된 물주기 알림 {reminders.length}건
                                        </Text>
                                        {reminders.length ? (
                                            reminders.map((item) => (
                                                <Text
                                                    key={item.plantId}
                                                    style={styles.reminderItem}
                                                >
                                                    · {item.title} — {item.dueDate} {String(notifHour).padStart(2, "0")}:{String(notifMinute).padStart(2, "0")}
                                                </Text>
                                            ))
                                        ) : (
                                            <Text style={styles.reminderItem}>
                                                예정일이 이미 지난 개체는 예약하지 않아요.
                                                물을 주거나 주기를 늘리면 예약됩니다.
                                            </Text>
                                        )}
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
                                    trackColor={{ false: Colors.border, true: GreenTint.line }}
                                    thumbColor={Colors.white}
                                    ios_backgroundColor={Colors.border}
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
                                                color={GreenTint.line}
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
                                    color={GreenTint.line}
                                />
                            </TouchableOpacity>

                            {showInquiry && (
                                <View style={styles.inquiryArea}>
                                    {inquiryDone ? (
                                        <View style={styles.inquiryDone}>
                                            <Ionicons
                                                name="checkmark-circle"
                                                size={32}
                                                color={GreenTint.medium}
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
                                                placeholderTextColor={Colors.textFaint}
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
        backgroundColor: Colors.background,
    },
    safe: {
        flex: 1,
    },

    scrollContent: {
        ...screenContent,
    },

    card: {
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xs,
    },

    sectionLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
    },
    sectionLabelText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        includeFontPadding: false,
    },

    divider: {
        height: 1,
        backgroundColor: Colors.separator,
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: Spacing.lg,
    },
    // 예약된 알림 목록 (동작 확인용 임시 표시)
    reminderBlock: {
        paddingVertical: Spacing.lg,
        gap: Spacing.xs,
    },
    reminderItem: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        lineHeight: 20,
        color: Colors.textGray,
        includeFontPadding: false,
    },
    rowLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    // 어카운트
    nameDisplayRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },
    nameValue: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: GreenTint.deep,
        includeFontPadding: false,
    },
    nameEditRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },
    nameInput: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        backgroundColor: Colors.background,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: GreenTint.soft,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        minWidth: 100,
        includeFontPadding: false,
    },
    saveBtn: {
        backgroundColor: GreenTint.deep,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    saveBtnDisabled: {
        backgroundColor: GreenTint.soft,
    },
    saveBtnText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.white,
        includeFontPadding: false,
    },
    deleteLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.remove,
        includeFontPadding: false,
    },

    deleteConfirmArea: {
        gap: Spacing.md,
        paddingBottom: Spacing.md,
    },
    deleteWarning: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        lineHeight: 20,
        includeFontPadding: false,
    },
    deleteInput: {
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
    deleteSubmitBtn: {
        backgroundColor: Colors.remove,
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
        alignItems: "center",
    },
    deleteSubmitBtnDisabled: {
        backgroundColor: GreenTint.soft,
    },
    deleteSubmitText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.white,
        includeFontPadding: false,
    },

    // 알림 시간
    timePicker: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },
    timeSpinner: {
        alignItems: "center",
        gap: Spacing.xxs,
    },
    timeValue: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.textBlack,
        minWidth: 36,
        textAlign: "center",
        includeFontPadding: false,
    },
    timeColon: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.title,
        color: Colors.textBlack,
        includeFontPadding: false,
        marginBottom: Spacing.xxs,
    },

    // 볼륨
    volumeItem: {
        paddingVertical: Spacing.lg,
        gap: Spacing.md,
    },
    volumeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },
    volumeTrack: {
        flex: 1,
        flexDirection: "row",
        gap: Spacing.xs,
    },
    volumeSegment: {
        flex: 1,
        height: 8,
        borderRadius: Radius.xs,
    },
    volumeSegmentOn: {
        backgroundColor: GreenTint.medium,
    },
    volumeSegmentOff: {
        backgroundColor: GreenTint.soft,
    },

    // FAQ
    faqSectionTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.medium,
        includeFontPadding: false,
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.sm,
    },
    faqRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: Spacing.md,
        gap: Spacing.md,
    },
    faqQuestion: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        flex: 1,
        includeFontPadding: false,
    },
    faqAnswer: {
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        marginBottom: Spacing.sm,
    },
    faqAnswerText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        lineHeight: 20,
        includeFontPadding: false,
    },

    // 문의하기
    inquiryArea: {
        gap: Spacing.md,
        paddingBottom: Spacing.md,
    },
    inquiryInput: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: GreenTint.soft,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        height: 110,
        textAlignVertical: "top",
        includeFontPadding: false,
    },
    inquirySubmitBtn: {
        backgroundColor: GreenTint.deep,
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
        alignItems: "center",
        shadowColor: GreenTint.deep,
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    inquirySubmitBtnDisabled: {
        backgroundColor: GreenTint.soft,
        shadowOpacity: 0,
        elevation: 0,
    },
    inquirySubmitText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.white,
        includeFontPadding: false,
    },
    inquiryDone: {
        alignItems: "center",
        gap: Spacing.md,
        paddingVertical: Spacing.xl,
    },
    inquiryDoneText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        textAlign: "center",
        lineHeight: 22,
        includeFontPadding: false,
    },

    versionText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        textAlign: "center",
        includeFontPadding: false,
    },
});
