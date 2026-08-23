import React, { useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StatusBar,
    Modal,
    Image,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint, Paper, Shadow } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import ScreenHeader from "../components/ScreenHeader";

const TODAY = "2026-05-17";

const PLANT_IMAGES: Record<string, any> = {
    spaghetti:   require("../../assets/plants/spaghetti.png"),
    rubber:      require("../../assets/plants/rubber.png"),
    sansevieria: require("../../assets/plants/sansevieria.png"),
    pachira:     require("../../assets/plants/pachira.png"),
    myeongrani:  require("../../assets/plants/myeongrani.png"),
};

const PLANTS = [
    { id: "1", name: "스파게티",   imageKey: "spaghetti" },
    { id: "2", name: "고무나무",   imageKey: "rubber" },
    { id: "3", name: "산세베리아", imageKey: "sansevieria" },
    { id: "4", name: "파키라",     imageKey: "pachira" },
    { id: "5", name: "명라니",     imageKey: "myeongrani" },
];

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const DOW_KO    = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

type CareDay = {
    watered: boolean;
    fertilized: boolean;
    hasJournal: boolean;
    wateredPlants: string[];
    fertilizedPlants: string[];
};

type PhotoSlot = { uri: string | null; plantId: string | null };
type Journal   = { note: string; photoSlots: PhotoSlot[] };

const EMPTY_SLOTS: PhotoSlot[] = [
    { uri: null, plantId: null },
    { uri: null, plantId: null },
];

const MOCK_CARE: Record<string, CareDay> = {
    "2026-05-03": { watered: true,  fertilized: false, hasJournal: false, wateredPlants: ["1","2"], fertilizedPlants: [] },
    "2026-05-07": { watered: false, fertilized: true,  hasJournal: false, wateredPlants: [],        fertilizedPlants: ["3"] },
    "2026-05-10": { watered: true,  fertilized: true,  hasJournal: true,  wateredPlants: ["1","2"], fertilizedPlants: ["3"] },
    "2026-05-14": { watered: true,  fertilized: false, hasJournal: true,  wateredPlants: ["1","4"], fertilizedPlants: [] },
    "2026-05-21": { watered: true,  fertilized: false, hasJournal: false, wateredPlants: ["2"],     fertilizedPlants: [] },
    "2026-05-24": { watered: false, fertilized: true,  hasJournal: false, wateredPlants: [],        fertilizedPlants: ["1"] },
};

const INIT_JOURNALS: Record<string, Journal> = {
    "2026-05-10": {
        note: "오늘은 날씨가 맑아서 모든 식물에 물을 주었어요. 산세베리아에 비료도 줬습니다.",
        photoSlots: [{ uri: null, plantId: "1" }, { uri: null, plantId: "2" }],
    },
    "2026-05-14": {
        note: "스파게티 잎이 새로 나왔어요! 파키라도 잘 자라고 있습니다.",
        photoSlots: [{ uri: null, plantId: "1" }, { uri: null, plantId: null }],
    },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function toKey(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function buildWeeks(year: number, month: number): (string | null)[][] {
    const first = new Date(year, month, 1).getDay();
    const last  = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= last; d++) cells.push(toKey(year, month, d));
    while (cells.length % 7) cells.push(null);
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

function monthLabel(y: number, m: number) {
    return `${y}년 ${m + 1}월`;
}

function diaryDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return `${d}일 ${DOW_KO[dow]}`;
}

type Plant = (typeof PLANTS)[number];

function plantsByIds(ids: string[]): Plant[] {
    return ids
        .map(id => PLANTS.find(p => p.id === id))
        .filter((p): p is Plant => !!p);
}

// 포스트잇은 3~4줄 높이로 고정이므로, 글자 수에 따라 폰트를 줄여 칸 안에
// 들어가게 한다. 단계는 칸 글자 영역(≈228×72px) 기준 수용량으로 잡았다.
function noteFontSize(text: string): number {
    const n = text.trim().length;
    if (n <= 50) return FontSizes.body;
    if (n <= 76) return FontSizes.small;
    return FontSizes.caption;
}

// 그날 일지에 함께 세워둘 개체를 랜덤으로 하나 고른다. 리렌더(타이핑 등)마다
// 캐릭터가 바뀌지 않도록 날짜 문자열을 시드로 쓴 고정 랜덤이다.
function pickBuddy(dateStr: string): Plant {
    let h = 7;
    for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) % 9973;
    return PLANTS[h % PLANTS.length] as Plant;
}

function PlusIcon({ size, color }: { size: number; color: string }) {
    const bar = Math.max(2, Math.round(size * 0.2));
    return (
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            <View style={{ position: "absolute", width: size * 0.85, height: bar, backgroundColor: color, borderRadius: bar / 2 }} />
            <View style={{ position: "absolute", width: bar, height: size * 0.85, backgroundColor: color, borderRadius: bar / 2 }} />
        </View>
    );
}

// 기울어진 폴라로이드 틀 — 눌러서 사진을 넣는다. tiltStyle 로 기울기만 바꿔 쓴다.
function PhotoFrame({
    uri,
    label,
    tiltStyle,
    onPress,
    disabled,
}: {
    uri: string | null;
    label?: string | null;
    tiltStyle: object;
    onPress: () => void;
    disabled: boolean;
}) {
    return (
        <TouchableOpacity
            style={[styles.photoFrame, tiltStyle]}
            onPress={onPress}
            activeOpacity={disabled ? 1 : 0.85}
            disabled={disabled}
        >
            <View style={styles.photoWindow}>
                {uri ? (
                    <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                    <View style={styles.photoPlaceholderInner}>
                        <Ionicons name="camera-outline" size={26} color={Colors.textFaint} />
                        <Text style={styles.photoAddText}>사진 추가</Text>
                    </View>
                )}
            </View>
            <Text style={styles.photoCaption} numberOfLines={1}>
                {label ?? ""}
            </Text>
        </TouchableOpacity>
    );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function CalendarScreen({ navigation }: { navigation: any }) {
    const [viewYear,    setViewYear]    = useState(2026);
    const [viewMonth,   setViewMonth]   = useState(4); // May
    const [selected,    setSelected]    = useState<string | null>(null);
    const [weekViewIdx, setWeekViewIdx] = useState<number | null>(null);
    const [journals,    setJournals]    = useState<Record<string, Journal>>(INIT_JOURNALS);
    const [lockedDays,  setLockedDays]  = useState<Set<string>>(() => new Set(Object.keys(INIT_JOURNALS)));
    const [editNote,    setEditNote]    = useState("");
    const [editSlots,   setEditSlots]   = useState<PhotoSlot[]>(EMPTY_SLOTS);
    const [pickerIdx,   setPickerIdx]   = useState<number | null>(null);
    const noteRef = useRef<TextInput>(null);

    const weeks        = buildWeeks(viewYear, viewMonth);
    const displayWeeks = weekViewIdx !== null ? [weeks[weekViewIdx]] : weeks;

    const care     = selected ? MOCK_CARE[selected] ?? null : null;
    const isLocked = selected ? lockedDays.has(selected) : false;

    const slotA = editSlots[0] ?? { uri: null, plantId: null };
    const slotB = editSlots[1] ?? { uri: null, plantId: null };

    const wateredChars    = plantsByIds(care?.wateredPlants ?? []);
    const fertilizedChars = plantsByIds(care?.fertilizedPlants ?? []);
    const buddy           = selected ? pickBuddy(selected) : null;

    function selectDate(dateStr: string | null) {
        if (!dateStr) return;
        const idx = weeks.findIndex(w => w.includes(dateStr));
        setWeekViewIdx(idx >= 0 ? idx : null);
        setSelected(dateStr);
        const j = journals[dateStr];
        setEditNote(j?.note ?? "");
        setEditSlots(j?.photoSlots ? [...j.photoSlots] : [...EMPTY_SLOTS]);
    }

    function prevMonth() {
        setSelected(null);
        setWeekViewIdx(null);
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    }
    function nextMonth() {
        setSelected(null);
        setWeekViewIdx(null);
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    }

    function prevWeek() {
        setSelected(null);
        setWeekViewIdx(i => (i !== null && i > 0) ? i - 1 : i);
    }
    function nextWeek() {
        setSelected(null);
        setWeekViewIdx(i => (i !== null && i < weeks.length - 1) ? i + 1 : i);
    }
    function exitWeekView() {
        setSelected(null);
        setWeekViewIdx(null);
    }

    function saveJournal() {
        if (!selected || isLocked) return;
        setJournals(prev => ({ ...prev, [selected]: { note: editNote, photoSlots: editSlots } }));
        setLockedDays(prev => new Set([...prev, selected]));
    }

    async function pickImage(idx: number) {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            quality: 0.85,
        });
        if (!result.canceled && result.assets?.[0]) {
            const uri = result.assets[0].uri;
            setEditSlots(prev => {
                const next = [...prev];
                next[idx] = { ...next[idx], uri };
                return next;
            });
            setPickerIdx(idx);
        }
    }

    async function handlePhotoSlotTap(idx: number) {
        if (isLocked) return;
        const slot = editSlots[idx];
        if (!slot.uri) {
            await pickImage(idx);
        } else {
            Alert.alert("사진", undefined, [
                { text: "사진 변경", onPress: () => pickImage(idx) },
                { text: "식물 라벨 변경", onPress: () => setPickerIdx(idx) },
                { text: "사진 삭제", style: "destructive", onPress: () => removePhoto(idx) },
                { text: "취소", style: "cancel" },
            ]);
        }
    }

    function removePhoto(idx: number) {
        setEditSlots(prev => {
            const next = [...prev];
            next[idx] = { uri: null, plantId: null };
            return next;
        });
    }

    function assignPlant(idx: number, plantId: string) {
        setEditSlots(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], plantId };
            return next;
        });
        setPickerIdx(null);
    }

    function clearLabel(idx: number) {
        setEditSlots(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], plantId: null };
            return next;
        });
        setPickerIdx(null);
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>

                {/* Header */}
                <ScreenHeader
                    onBack={() => navigation.goBack()}
                    center={
                        <View style={styles.monthNav}>
                            <TouchableOpacity onPress={prevMonth} hitSlop={{ top:8, bottom:8, left:14, right:14 }}>
                                <Ionicons name="chevron-back" size={20} color={GreenTint.strong} />
                            </TouchableOpacity>
                            <Text style={styles.monthText}>{monthLabel(viewYear, viewMonth)}</Text>
                            <TouchableOpacity onPress={nextMonth} hitSlop={{ top:8, bottom:8, left:14, right:14 }}>
                                <Ionicons name="chevron-forward" size={20} color={GreenTint.strong} />
                            </TouchableOpacity>
                        </View>
                    }
                />

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.scroll}
                    >
                        {/* ── Calendar card ─────────────────────── */}
                        <View style={styles.calCard}>

                            {/* Week navigation bar */}
                            {weekViewIdx !== null && (
                                <View style={styles.weekNavRow}>
                                    <TouchableOpacity
                                        onPress={prevWeek}
                                        disabled={weekViewIdx === 0}
                                        hitSlop={{ top:8, bottom:8, left:14, right:14 }}
                                    >
                                        <Ionicons
                                            name="chevron-back"
                                            size={18}
                                            color={weekViewIdx === 0 ? Colors.textFaint : GreenTint.strong}
                                        />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={exitWeekView}>
                                        <Text style={styles.weekNavText}>월간 보기</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={nextWeek}
                                        disabled={weekViewIdx === weeks.length - 1}
                                        hitSlop={{ top:8, bottom:8, left:14, right:14 }}
                                    >
                                        <Ionicons
                                            name="chevron-forward"
                                            size={18}
                                            color={weekViewIdx === weeks.length - 1 ? Colors.textFaint : GreenTint.strong}
                                        />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Day labels */}
                            <View style={styles.weekRow}>
                                {DAY_LABELS.map((d, i) => (
                                    <View key={d} style={styles.cell}>
                                        <Text style={[
                                            styles.dayLabel,
                                            i === 0 && styles.sunColor,
                                            i === 6 && styles.satColor,
                                        ]}>{d}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Weeks */}
                            {displayWeeks.map((week, wi) => (
                                <View key={wi} style={styles.weekRow}>
                                    {week.map((ds, di) => {
                                        const c       = ds ? MOCK_CARE[ds] ?? null : null;
                                        const isSel   = ds !== null && ds === selected;
                                        const isToday = ds === TODAY;
                                        const both    = c?.watered && c?.fertilized;
                                        const dayNum  = ds ? parseInt(ds.split("-")[2]) : null;

                                        return (
                                            <TouchableOpacity
                                                key={di}
                                                style={[
                                                    styles.cell,
                                                    styles.dayCell,
                                                    !ds && styles.cellGhost,
                                                    c?.watered  && !c.fertilized && !isSel && { backgroundColor: Colors.water },
                                                    !c?.watered && c?.fertilized && !isSel && { backgroundColor: Colors.fertilizer },
                                                    isSel && styles.cellSel,
                                                    c?.hasJournal && !isSel && styles.cellJournal,
                                                ]}
                                                onPress={() => selectDate(ds)}
                                                activeOpacity={ds ? 0.75 : 1}
                                                disabled={!ds}
                                            >
                                                {both && !isSel ? (
                                                    <View style={styles.bothWrap}>
                                                        <View style={[styles.halfCell, { backgroundColor: Colors.water }]}>
                                                            <Ionicons name="water" size={12} color={Colors.waterIcon} />
                                                        </View>
                                                        <View style={[styles.halfCell, { backgroundColor: Colors.fertilizer }]}>
                                                            <PlusIcon size={14} color={Colors.fertilizerIcon} />
                                                        </View>
                                                    </View>
                                                ) : c?.watered && !isSel ? (
                                                    <Ionicons name="water" size={20} color={Colors.waterIcon} />
                                                ) : c?.fertilized && !isSel ? (
                                                    <PlusIcon size={22} color={Colors.fertilizerIcon} />
                                                ) : (
                                                    <Text style={[
                                                        styles.dayNum,
                                                        isSel  && styles.dayNumSel,
                                                        isToday && !isSel && styles.dayNumToday,
                                                        di === 0 && !isSel && styles.sunColor,
                                                        di === 6 && !isSel && styles.satColor,
                                                    ]}>
                                                        {dayNum ?? ""}
                                                    </Text>
                                                )}
                                                {isToday && !isSel && <View style={styles.todayDot} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ))}

                            {/* Legend */}
                            <View style={styles.legend}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: Colors.water }]}>
                                        <Ionicons name="water" size={9} color={Colors.waterIcon} />
                                    </View>
                                    <Text style={styles.legendText}>물주기</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: Colors.fertilizer }]}>
                                        <PlusIcon size={11} color={Colors.fertilizerIcon} />
                                    </View>
                                    <Text style={styles.legendText}>비료</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, styles.legendDotJournal]} />
                                    <Text style={styles.legendText}>일지</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── Diary card ──────────────────────── */}
                        {selected && (
                            <View style={styles.diaryPage}>

                                {/* ① 날짜 — 좌상단 */}
                                <View style={styles.diaryHeaderRow}>
                                    <Text style={styles.diaryDateText}>{diaryDateLabel(selected)}</Text>
                                    {isLocked && (
                                        <View style={styles.savedBadge}>
                                            <Ionicons name="checkmark-circle" size={13} color={GreenTint.strong} />
                                            <Text style={styles.savedBadgeText}>저장됨</Text>
                                        </View>
                                    )}
                                </View>

                                {/* ② 물 준 개체 — 없는 날은 이 줄 자체가 사라진다 */}
                                {wateredChars.length > 0 && (
                                    <View style={styles.careRow}>
                                        <View style={[styles.careIcon, { backgroundColor: Colors.water }]}>
                                            <Ionicons name="water" size={16} color={Colors.waterIcon} />
                                        </View>
                                        {wateredChars.map(p => (
                                            <View key={p.id} style={styles.careCircle}>
                                                <Image
                                                    source={PLANT_IMAGES[p.imageKey]}
                                                    style={styles.careCircleImg}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* ③ 영양제 준 개체 */}
                                {fertilizedChars.length > 0 && (
                                    <View style={styles.careRow}>
                                        <View style={[styles.careIcon, { backgroundColor: Colors.fertilizer }]}>
                                            <PlusIcon size={16} color={Colors.fertilizerIcon} />
                                        </View>
                                        {fertilizedChars.map(p => (
                                            <View key={p.id} style={styles.careCircle}>
                                                <Image
                                                    source={PLANT_IMAGES[p.imageKey]}
                                                    style={styles.careCircleImg}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* ④~⑦ 스크랩북 */}
                                <View style={styles.scrapbook}>

                                    {/* ④ 우측 — 오른쪽으로 10도 기운 틀 */}
                                    <View style={styles.frameRowRight}>
                                        <PhotoFrame
                                            uri={slotA.uri}
                                            label={PLANTS.find(p => p.id === slotA.plantId)?.name}
                                            tiltStyle={styles.tiltRight}
                                            onPress={() => handlePhotoSlotTap(0)}
                                            disabled={isLocked}
                                        />
                                    </View>

                                    {/* ⑥ 포스트잇 — 눌러서 쓰고, 글자 수에 맞춰 폰트가 줄어든다 */}
                                    <Pressable
                                        style={styles.stickyNote}
                                        onPress={() => !isLocked && noteRef.current?.focus()}
                                        disabled={isLocked}
                                    >
                                        <TextInput
                                            ref={noteRef}
                                            style={[styles.stickyNoteInput, { fontSize: noteFontSize(editNote) }]}
                                            value={editNote}
                                            onChangeText={setEditNote}
                                            editable={!isLocked}
                                            placeholder={"오늘 하루 느낀 생각과 감정을 적어보세요."}
                                            placeholderTextColor={Colors.textFaint}
                                            multiline
                                            scrollEnabled={false}
                                            textAlignVertical="top"
                                        />
                                    </Pressable>

                                    {/* ⑤ 좌측 — 왼쪽으로 15도 기운 틀 + ⑦ 오른쪽에 랜덤 개체 */}
                                    <View style={styles.frameRowLeft}>
                                        <View style={styles.lowerFrameWrap}>
                                            <PhotoFrame
                                                uri={slotB.uri}
                                                label={PLANTS.find(p => p.id === slotB.plantId)?.name}
                                                tiltStyle={styles.tiltLeft}
                                                onPress={() => handlePhotoSlotTap(1)}
                                                disabled={isLocked}
                                            />
                                            {buddy && (
                                                <View style={styles.buddyWrap} pointerEvents="none">
                                                    <Image
                                                        source={PLANT_IMAGES[buddy.imageKey]}
                                                        style={styles.buddyImg}
                                                        resizeMode="contain"
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>

                                {/* 저장 (잠긴 날은 숨김) */}
                                {!isLocked && (
                                    <TouchableOpacity
                                        style={styles.saveBtn}
                                        onPress={saveJournal}
                                        activeOpacity={0.82}
                                    >
                                        <Text style={styles.saveBtnText}>저장하기</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Plant label picker modal */}
            <Modal
                visible={pickerIdx !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerIdx(null)}
            >
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={() => setPickerIdx(null)}
                >
                    <View style={styles.pickerBox}>
                        <Text style={styles.pickerTitle}>식물 라벨 선택</Text>
                        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                            {PLANTS.map(p => (
                                <TouchableOpacity
                                    key={p.id}
                                    style={styles.pickerRow}
                                    onPress={() => pickerIdx !== null && assignPlant(pickerIdx, p.id)}
                                    activeOpacity={0.8}
                                >
                                    <Image
                                        source={PLANT_IMAGES[p.imageKey]}
                                        style={styles.pickerImg}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.pickerName}>{p.name}</Text>
                                    {pickerIdx !== null && editSlots[pickerIdx]?.plantId === p.id && (
                                        <Ionicons name="checkmark" size={18} color={Colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                            {pickerIdx !== null && editSlots[pickerIdx]?.plantId && (
                                <TouchableOpacity
                                    style={[styles.pickerRow, { borderTopWidth: 1, borderTopColor: Colors.separator }]}
                                    onPress={() => pickerIdx !== null && clearLabel(pickerIdx)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.pickerImg} />
                                    <Text style={[styles.pickerName, { color: Colors.remove }]}>라벨 제거</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.background },
    safe: { flex: 1 },

    monthNav: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
    },
    monthText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.textBlack,
        includeFontPadding: false,
        minWidth: 116,
        textAlign: "center",
    },

    scroll: {
        ...screenContent,
    },

    // ── calendar ──
    calCard: {
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1.5,
        borderColor: GreenTint.line,
        paddingHorizontal: Spacing.sm,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
    },
    weekNavRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.separator,
        marginBottom: Spacing.xs,
    },
    weekNavText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
        includeFontPadding: false,
    },
    weekRow: { flexDirection: "row" },
    cell: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    dayCell: {
        height: 46,
        margin: Spacing.xxs,
        borderRadius: Radius.md,
        backgroundColor: Colors.white,
        overflow: "hidden",
    },
    cellGhost:   { backgroundColor: "transparent" },
    cellSel:     { backgroundColor: Colors.primary },
    cellJournal: { borderWidth: 1.5, borderColor: GreenTint.strong },
    bothWrap: {
        flex: 1,
        width: "100%",
        flexDirection: "row",
    },
    halfCell: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    dayLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.medium,
        includeFontPadding: false,
        paddingVertical: Spacing.sm,
    },
    dayNum: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    dayNumSel:   { color: Colors.white },
    dayNumToday: { color: Colors.primary },
    sunColor:    { color: Colors.weekendSun },
    satColor:    { color: Colors.weekendSat },
    todayDot: {
        position: "absolute",
        bottom: 4,
        width: 4,
        height: 4,
        borderRadius: Radius.xs,
        backgroundColor: GreenTint.strong,
    },
    legend: {
        flexDirection: "row",
        justifyContent: "center",
        gap: Spacing.xl,
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.separator,
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
    },
    legendDot: {
        width: 18,
        height: 18,
        borderRadius: Radius.sm,
        alignItems: "center",
        justifyContent: "center",
    },
    legendDotJournal: {
        backgroundColor: Colors.white,
        borderWidth: 1.5,
        borderColor: GreenTint.strong,
    },
    legendText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.medium,
        includeFontPadding: false,
    },

    // ── diary ──
    diaryPage: {
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1.5,
        borderColor: GreenTint.line,
        padding: Spacing.xl,
        gap: Spacing.lg,
    },
    diaryHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    diaryDateText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.primary,
        includeFontPadding: false,
    },
    savedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
        backgroundColor: GreenTint.soft,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    savedBadgeText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.strong,
        includeFontPadding: false,
    },
    careRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        flexWrap: "wrap",
    },
    careIcon: {
        width: 32,
        height: 32,
        borderRadius: Radius.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    careCircle: {
        width: 36,
        height: 36,
        borderRadius: Radius.pill,
        backgroundColor: Colors.background,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.2,
        borderColor: GreenTint.line,
        overflow: "hidden",
    },
    careCircleImg: {
        width: 30,
        height: 30,
    },

    // ── 스크랩북 (기운 사진 틀 + 포스트잇) ──
    // 자식마다 음수 마진으로 살짝 겹치고, zIndex 로 포스트잇이 사진 틀 위에
    // 얹히게 쌓는다(글이 가려지면 안 된다).
    // 단, 위 틀은 아래쪽에 식물 라벨(photoCaption)이 붙는다. 10도 기울면
    // 라벨 오른쪽 끝이 레이아웃 박스보다 ~10px 더 내려오므로, 포스트잇은
    // 위 틀과만 양수 마진으로 간격을 둬서 라벨을 덮지 않게 한다.
    scrapbook: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xl,
    },
    frameRowRight: {
        flexDirection: "row",
        justifyContent: "flex-end",
        paddingRight: Spacing.sm,
        zIndex: 2,
    },
    frameRowLeft: {
        flexDirection: "row",
        paddingLeft: Spacing.xs,
        marginTop: -Spacing.md,
        zIndex: 3,
    },
    lowerFrameWrap: {
        position: "relative",
    },
    tiltRight: { transform: [{ rotate: "10deg" }] },
    tiltLeft:  { transform: [{ rotate: "-15deg" }] },

    // 폴라로이드 틀 — 사진 넣는 창 + 아래 라벨 여백
    photoFrame: {
        width: 190,
        backgroundColor: Colors.white,
        borderRadius: Radius.xs,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        paddingBottom: Spacing.xs,
        shadowColor: Shadow.color,
        shadowOpacity: 0.16,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    photoWindow: {
        width: "100%",
        aspectRatio: 1,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: GreenTint.soft,
        overflow: "hidden",
    },
    photoPlaceholderInner: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.xs,
    },
    photoAddText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        color: Colors.textFaint,
        includeFontPadding: false,
    },
    photoCaption: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        color: Colors.textGray,
        textAlign: "center",
        minHeight: 14,
        paddingTop: Spacing.xxs,
        includeFontPadding: false,
    },

    // ⑦ 랜덤으로 고른 개체 — 아래 틀의 우측 하단에 걸쳐 세워둔다
    buddyWrap: {
        position: "absolute",
        right: -Spacing.section,
        bottom: -Spacing.md,
    },
    buddyImg: {
        width: 112,
        height: 112,
    },

    // ⑥ 포스트잇 — 가로로 긴 3~4줄 높이. 사진 틀과 겹치되 항상 맨 위에 얹혀
    // 글이 가려지지 않게 한다. 안드로이드는 elevation 이 zIndex 를 이기므로
    // 틀(elevation 4)보다 큰 값을 함께 줘야 한다.
    stickyNote: {
        alignSelf: "center",
        width: "90%",
        height: 96,
        marginTop: Spacing.lg,
        zIndex: 4,
        backgroundColor: Paper.noteBg,
        borderRadius: Radius.xs,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Paper.noteBorder,
        overflow: "hidden",
        transform: [{ rotate: "-2deg" }],
        shadowColor: Paper.noteAccent,
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    stickyNoteInput: {
        flex: 1,
        fontFamily: Fonts.neoDunggeunmo,
        color: Paper.noteText,
        textAlignVertical: "top",
        includeFontPadding: false,
        padding: 0,
    },

    saveBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.lg,
        alignItems: "center",
        shadowColor: Colors.primary,
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    saveBtnText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.white,
        includeFontPadding: false,
    },

    // ── modal ──
    overlay: {
        flex: 1,
        backgroundColor: Shadow.soft,
        justifyContent: "center",
        alignItems: "center",
    },
    pickerBox: {
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.sm,
        width: 280,
        shadowColor: Shadow.color,
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 10,
    },
    pickerTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.primary,
        textAlign: "center",
        paddingVertical: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.separator,
        includeFontPadding: false,
    },
    pickerRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        gap: Spacing.lg,
    },
    pickerImg: {
        width: 40,
        height: 40,
    },
    pickerName: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        flex: 1,
        includeFontPadding: false,
    },
});