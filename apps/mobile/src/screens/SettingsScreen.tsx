import React, { useCallback, useEffect, useRef, useState } from "react";
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
    Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import ActionButton from "../components/ActionButton";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import {
    deleteMe,
    getInquiries,
    getUserSettings,
    sendInquiry,
    updateMe,
    type Inquiry,
} from "../api";
import {
    listScheduledReminders,
    syncWateringReminders,
    getNotificationPermission,
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
    isAdmin = false,
    onLogout,
}: {
    navigation: any;
    username: string;
    setUsername: (name: string) => void;
    /** 관리자면 도움말에 "문의 관리" 항목이 보인다 (실제 차단은 서버가 한다) */
    isAdmin?: boolean;
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
    // 알림을 켜뒀지만 기기 권한이 없어 예약이 막힌 상태.
    // 예약 0건은 "예정일이 다 지났다"로도 나와서, 원인을 구분해 안내해야 한다.
    const [notifBlocked, setNotifBlocked] = useState(false);
    // 사용자가 방금 스위치를 켰는지 — 알럿은 그때만 띄운다(화면 열 때마다 뜨면 성가시다)
    const justEnabledNotif = useRef(false);

    // 사운드&진동 — 앱 전체가 쓰는 값과 공유하고, 바꾸면 바로 기기에 저장된다.
    // 효과음·진동을 실제로 내는 쪽은 feedback.ts (playSfx / hapticImpact)
    const {
        bgmVolume,
        sfxVolume,
        vibration,
        setBgmVolume,
        setSfxVolume,
        setVibration,
    } = useBackgroundMusic();

    // 도움말
    const [openFaqId, setOpenFaqId] = useState<string | null>(null);
    const [showInquiry, setShowInquiry] = useState(false);
    const [inquiryContent, setInquiryContent] = useState("");
    const [inquiryDone, setInquiryDone] = useState(false);
    const [isSendingInquiry, setIsSendingInquiry] = useState(false);

    // 문의 내역 — 관리자가 답변을 달면 여기에 함께 실려 온다
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [inquiriesLoaded, setInquiriesLoaded] = useState(false);

    const refreshInquiries = useCallback(() => {
        getInquiries()
            .then((rows) => {
                setInquiries(rows);
                setInquiriesLoaded(true);
            })
            .catch((e) => console.warn("문의 내역 조회 실패:", e?.message));
    }, []);

    // 문의하기를 펼칠 때만 불러온다 — 설정 화면을 열 때마다 부를 필요가 없다
    useEffect(() => {
        if (showInquiry) refreshInquiries();
    }, [showInquiry, refreshInquiries]);

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

    // 권한이 없으면 기기 설정으로 보내준다 — 앱 안에서는 더 할 수 있는 게 없다
    const openDeviceSettings = () => {
        Linking.openSettings().catch((e: any) =>
            console.warn("기기 설정 열기 실패:", e?.message),
        );
    };

    const alertPermissionBlocked = () => {
        Alert.alert(
            "알림 권한이 없어요",
            "기기 설정에서 LeafLog 알림을 허용해야 물주기 알림을 받을 수 있어요.",
            [
                { text: "나중에", style: "cancel" },
                { text: "설정 열기", onPress: openDeviceSettings },
            ],
        );
    };

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
            .then((result) => {
                // 권한이 없으면 스위치만 켜지고 실제로는 아무것도 예약되지 않는다.
                // 그대로 두면 "알림 켰는데 안 온다"가 되므로 화면에 남겨 알린다.
                setNotifBlocked(result.blockedByPermission);
                if (result.blockedByPermission && justEnabledNotif.current) {
                    alertPermissionBlocked();
                }
                justEnabledNotif.current = false;
                refreshReminders();
            })
            .catch((e) => console.warn("알림 설정 저장 실패:", e?.message));
    }, [notifLoaded, notifEnabled, notifHour, notifMinute, refreshReminders]);

    /*
        기기 설정에서 권한을 켜고 돌아왔을 수 있으니 화면에 들어올 때마다 다시 본다.
        막혀 있다가 풀렸으면 그 자리에서 예약까지 다시 맞춘다.
    */
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            getNotificationPermission()
                .then(({ granted }) => {
                    if (cancelled || !notifEnabled) return;
                    setNotifBlocked(!granted);
                    if (granted && notifBlocked) {
                        return syncWateringReminders().then(() => refreshReminders());
                    }
                })
                .catch(() => {});
            return () => {
                cancelled = true;
            };
        }, [notifEnabled, notifBlocked, refreshReminders]),
    );

    const adjustHour = (d: number) =>
        setNotifHour((prev) => (prev + d + 24) % 24);

    const adjustMinute = (d: number) =>
        setNotifMinute((prev) => (prev + d * 10 + 60) % 60);

    // 문의하기 — 서버가 지원 메일함으로 보낸다.
    // 실패하면 완료 화면을 띄우지 않고 입력을 남겨 둔다 (다시 쓰게 하면 안 된다)
    const submitInquiry = async () => {
        const content = inquiryContent.trim();
        if (!content || isSendingInquiry) return;

        setIsSendingInquiry(true);
        try {
            await sendInquiry(content);
            setInquiryContent("");
            setInquiryDone(true);
            refreshInquiries();
        } catch (e: any) {
            Alert.alert("문의 전송 실패", e?.message ?? "다시 시도해주세요.");
        } finally {
            setIsSendingInquiry(false);
        }
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
                                    <ActionButton
                                        label={isDeletingAccount ? "삭제 중" : "계정 삭제하기"}
                                        color={
                                            !deletePassword || isDeletingAccount
                                                ? GreenTint.soft
                                                : Colors.remove
                                        }
                                        size="md"
                                        shadow={false}
                                        disabled={!deletePassword || isDeletingAccount}
                                        onPress={deleteAccount}
                                    />
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
                                    onValueChange={(next) => {
                                        justEnabledNotif.current = next;
                                        setNotifEnabled(next);
                                    }}
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
                                        권한이 없으면 스위치가 켜져 있어도 예약이 0건이다.
                                        알럿은 닫히면 사라지므로 상태를 화면에 남겨 둔다.
                                    */}
                                    {notifBlocked && (
                                        <>
                                            <RowDivider />
                                            <View style={styles.permissionWarning}>
                                                <Ionicons
                                                    name="alert-circle-outline"
                                                    size={18}
                                                    color={Colors.remove}
                                                />
                                                <View style={styles.permissionTextBox}>
                                                    <Text style={styles.permissionTitle}>
                                                        알림 권한이 없어요
                                                    </Text>
                                                    <Text style={styles.permissionBody}>
                                                        기기 설정에서 LeafLog 알림을 허용해야
                                                        물주기 알림이 예약됩니다.
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={openDeviceSettings}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.permissionLink}>
                                                            기기 설정 열기
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </>
                                    )}

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
                                                {notifBlocked
                                                    ? "알림 권한을 허용하면 예약됩니다."
                                                    : "예정일이 이미 지난 개체는 예약하지 않아요. 물을 주거나 주기를 늘리면 예약됩니다."}
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
                                                문의가 접수되었습니다.{"\n"}답변이 달리면 문의 내역에 표시됩니다.
                                            </Text>
                                        </View>
                                    ) : (
                                        <>
                                            {/*
                                                답변은 앱이 아니라 메일로 간다.
                                                어디로 오는지 미리 알려주지 않으면
                                                앱에서 답을 기다리게 된다.
                                            */}
                                            <Text style={styles.inquiryNotice}>
                                                답변이 달리면 아래 문의 내역에서
                                                확인하실 수 있어요.
                                            </Text>
                                            <TextInput
                                                style={styles.inquiryInput}
                                                placeholder="문의 내용을 입력해주세요"
                                                placeholderTextColor={Colors.textFaint}
                                                value={inquiryContent}
                                                onChangeText={setInquiryContent}
                                                multiline
                                                textAlignVertical="top"
                                                editable={!isSendingInquiry}
                                                // 서버가 5~2000자를 받는다
                                                maxLength={2000}
                                            />
                                            <ActionButton
                                                label={
                                                    isSendingInquiry
                                                        ? "보내는 중"
                                                        : "제출하기"
                                                }
                                                color={
                                                    inquiryContent.trim() && !isSendingInquiry
                                                        ? GreenTint.deep
                                                        : GreenTint.soft
                                                }
                                                size="md"
                                                shadow={
                                                    !!inquiryContent.trim() && !isSendingInquiry
                                                }
                                                disabled={
                                                    !inquiryContent.trim() || isSendingInquiry
                                                }
                                                onPress={submitInquiry}
                                            />
                                        </>
                                    )}

                                    {/* 문의 내역 — 답변은 여기서 확인한다 */}
                                    {inquiriesLoaded && inquiries.length > 0 && (
                                        <View style={styles.historyBlock}>
                                            <RowDivider />
                                            <Text style={styles.historyTitle}>
                                                내 문의 내역
                                            </Text>
                                            {inquiries.map((item) => (
                                                <View key={item.id} style={styles.historyItem}>
                                                    <View style={styles.historyHead}>
                                                        <Text style={styles.historyDate}>
                                                            {item.created_at.slice(0, 10)}
                                                        </Text>
                                                        <Text
                                                            style={[
                                                                styles.historyBadge,
                                                                item.answer
                                                                    ? styles.historyBadgeDone
                                                                    : styles.historyBadgeWait,
                                                            ]}
                                                        >
                                                            {item.answer ? "답변 완료" : "답변 대기"}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.historyContent}>
                                                        {item.content}
                                                    </Text>
                                                    {item.answer && (
                                                        <View style={styles.answerBox}>
                                                            <Text style={styles.answerLabel}>
                                                                답변
                                                            </Text>
                                                            <Text style={styles.answerText}>
                                                                {item.answer}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* 관리자 전용 — 다른 사용자의 문의에 답변한다 */}
                            {isAdmin && (
                                <>
                                    <RowDivider />
                                    <TouchableOpacity
                                        style={styles.row}
                                        onPress={() => navigation.navigate("InquiryAdmin")}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={styles.rowLabel}>문의 관리</Text>
                                        <View style={styles.adminRight}>
                                            <Text style={styles.adminTag}>관리자</Text>
                                            <Ionicons
                                                name="chevron-forward"
                                                size={18}
                                                color={GreenTint.line}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                </>
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
    adminRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
    },
    adminTag: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        color: Colors.white,
        backgroundColor: GreenTint.deep,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xxs,
        borderRadius: Radius.pill,
        overflow: "hidden",
        includeFontPadding: false,
    },
    historyBlock: {
        gap: Spacing.md,
    },
    historyTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        includeFontPadding: false,
    },
    historyItem: {
        gap: Spacing.xs,
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: GreenTint.soft,
        padding: Spacing.md,
    },
    historyHead: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    historyDate: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        includeFontPadding: false,
    },
    historyBadge: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xxs,
        borderRadius: Radius.pill,
        overflow: "hidden",
        includeFontPadding: false,
    },
    historyBadgeWait: {
        backgroundColor: GreenTint.soft,
        color: GreenTint.strong,
    },
    historyBadgeDone: {
        backgroundColor: GreenTint.deep,
        color: Colors.white,
    },
    historyContent: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        lineHeight: 20,
        includeFontPadding: false,
    },
    answerBox: {
        marginTop: Spacing.xs,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: GreenTint.soft,
        gap: Spacing.xxs,
    },
    answerLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
        includeFontPadding: false,
    },
    answerText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        lineHeight: 20,
        includeFontPadding: false,
    },
    inquiryNotice: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        lineHeight: 18,
        includeFontPadding: false,
    },
    permissionWarning: {
        flexDirection: "row",
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
    },
    permissionTextBox: {
        flex: 1,
        gap: Spacing.xxs,
    },
    permissionTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.remove,
        includeFontPadding: false,
    },
    permissionBody: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        lineHeight: 18,
        includeFontPadding: false,
    },
    permissionLink: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
        textDecorationLine: "underline",
        paddingTop: Spacing.xxs,
        includeFontPadding: false,
    },
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
