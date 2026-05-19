import React, { useState } from "react";
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
    KeyboardAvoidingView,
    Platform,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

const FONT = "NeoDunggeunmoPro-Regular";
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
        photoSlots: [{ uri: null, plantId: "1" }, { uri: null, plantId: "2" }, { uri: null, plantId: null }],
    },
    "2026-05-14": {
        note: "스파게티 잎이 새로 나왔어요! 파키라도 잘 자라고 있습니다.",
        photoSlots: [{ uri: null, plantId: "1" }, { uri: null, plantId: null }, { uri: null, plantId: null }],
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

function PlusIcon({ size, color }: { size: number; color: string }) {
    const bar = Math.max(2, Math.round(size * 0.2));
    return (
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            <View style={{ position: "absolute", width: size * 0.85, height: bar, backgroundColor: color, borderRadius: bar / 2 }} />
            <View style={{ position: "absolute", width: bar, height: size * 0.85, backgroundColor: color, borderRadius: bar / 2 }} />
        </View>
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

    const weeks        = buildWeeks(viewYear, viewMonth);
    const displayWeeks = weekViewIdx !== null ? [weeks[weekViewIdx]] : weeks;

    const care     = selected ? MOCK_CARE[selected] ?? null : null;
    const isLocked = selected ? lockedDays.has(selected) : false;

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
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={28} color="#2B3E25" />
                    </TouchableOpacity>

                    <View style={styles.monthNav}>
                        <TouchableOpacity onPress={prevMonth} hitSlop={{ top:8, bottom:8, left:14, right:14 }}>
                            <Ionicons name="chevron-back" size={20} color="#5A8A5A" />
                        </TouchableOpacity>
                        <Text style={styles.monthText}>{monthLabel(viewYear, viewMonth)}</Text>
                        <TouchableOpacity onPress={nextMonth} hitSlop={{ top:8, bottom:8, left:14, right:14 }}>
                            <Ionicons name="chevron-forward" size={20} color="#5A8A5A" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerBtn} />
                </View>

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
                                            color={weekViewIdx === 0 ? "#C0D0B8" : "#5A8A5A"}
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
                                            color={weekViewIdx === weeks.length - 1 ? "#C0D0B8" : "#5A8A5A"}
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
                                                    c?.watered  && !c.fertilized && !isSel && { backgroundColor: "#E0EDFF" },
                                                    !c?.watered && c?.fertilized && !isSel && { backgroundColor: "#FFF8D0" },
                                                    isSel && styles.cellSel,
                                                    c?.hasJournal && !isSel && styles.cellJournal,
                                                ]}
                                                onPress={() => selectDate(ds)}
                                                activeOpacity={ds ? 0.75 : 1}
                                                disabled={!ds}
                                            >
                                                {both && !isSel ? (
                                                    <View style={styles.bothWrap}>
                                                        <View style={[styles.halfCell, { backgroundColor: "#E0EDFF" }]}>
                                                            <Ionicons name="water" size={12} color="#3A7ED5" />
                                                        </View>
                                                        <View style={[styles.halfCell, { backgroundColor: "#FFF8D0" }]}>
                                                            <PlusIcon size={14} color="#9A7A10" />
                                                        </View>
                                                    </View>
                                                ) : c?.watered && !isSel ? (
                                                    <Ionicons name="water" size={20} color="#3A7ED5" />
                                                ) : c?.fertilized && !isSel ? (
                                                    <PlusIcon size={22} color="#9A7A10" />
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
                                    <View style={[styles.legendDot, { backgroundColor: "#E0EDFF" }]}>
                                        <Ionicons name="water" size={9} color="#3A7ED5" />
                                    </View>
                                    <Text style={styles.legendText}>물주기</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: "#FFF8D0" }]}>
                                        <PlusIcon size={11} color="#9A7A10" />
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

                                {/* Date + lock badge */}
                                <View style={styles.diaryHeaderRow}>
                                    <Text style={styles.diaryDateText}>{diaryDateLabel(selected)}</Text>
                                    {isLocked && (
                                        <View style={styles.savedBadge}>
                                            <Ionicons name="checkmark-circle" size={13} color="#5A8A5A" />
                                            <Text style={styles.savedBadgeText}>저장됨</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Care icon bubbles */}
                                {care && (care.watered || care.fertilized) && (
                                    <View style={styles.diaryIconRow}>
                                        {care.watered && (
                                            <View style={[styles.diaryCareIcon, { backgroundColor: "#E0EDFF" }]}>
                                                <Ionicons name="water" size={14} color="#3A7ED5" />
                                            </View>
                                        )}
                                        {care.wateredPlants.map(id => {
                                            const p = PLANTS.find(x => x.id === id);
                                            return p ? (
                                                <View key={id} style={styles.diaryPlantCircle}>
                                                    <Image source={PLANT_IMAGES[p.imageKey]} style={styles.diaryCircleImg} resizeMode="contain" />
                                                </View>
                                            ) : null;
                                        })}
                                        {care.fertilized && (
                                            <View style={[styles.diaryCareIcon, { backgroundColor: "#FFF8D0" }]}>
                                                <PlusIcon size={16} color="#9A7A10" />
                                            </View>
                                        )}
                                        {care.fertilizedPlants.map(id => {
                                            const p = PLANTS.find(x => x.id === id);
                                            return p ? (
                                                <View key={id} style={styles.diaryPlantCircle}>
                                                    <Image source={PLANT_IMAGES[p.imageKey]} style={styles.diaryCircleImg} resizeMode="contain" />
                                                </View>
                                            ) : null;
                                        })}
                                    </View>
                                )}

                                {/* Photo section: 1 large + 2 small stacked */}
                                <View style={styles.photoSection}>
                                    {/* Main photo */}
                                    <TouchableOpacity
                                        style={styles.mainPhotoSlot}
                                        onPress={() => handlePhotoSlotTap(0)}
                                        activeOpacity={isLocked ? 1 : 0.85}
                                        disabled={isLocked}
                                    >
                                        {editSlots[0].uri ? (
                                            <>
                                                <Image
                                                    source={{ uri: editSlots[0].uri }}
                                                    style={StyleSheet.absoluteFillObject}
                                                    resizeMode="cover"
                                                />
                                                {editSlots[0].plantId && (() => {
                                                    const p = PLANTS.find(x => x.id === editSlots[0].plantId);
                                                    return p ? (
                                                        <View style={styles.photoBadge}>
                                                            <Text style={styles.photoBadgeText}>{p.name}</Text>
                                                        </View>
                                                    ) : null;
                                                })()}
                                            </>
                                        ) : (
                                            <View style={styles.photoPlaceholderInner}>
                                                <Ionicons name="camera-outline" size={30} color="#C0C8BC" />
                                                <Text style={styles.photoAddText}>이미지 추가</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    {/* Side photos */}
                                    <View style={styles.sidePhotos}>
                                        {[1, 2].map(idx => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={styles.sidePhotoSlot}
                                                onPress={() => handlePhotoSlotTap(idx)}
                                                activeOpacity={isLocked ? 1 : 0.85}
                                                disabled={isLocked}
                                            >
                                                {editSlots[idx].uri ? (
                                                    <>
                                                        <Image
                                                            source={{ uri: editSlots[idx].uri }}
                                                            style={StyleSheet.absoluteFillObject}
                                                            resizeMode="cover"
                                                        />
                                                        {editSlots[idx].plantId && (() => {
                                                            const p = PLANTS.find(x => x.id === editSlots[idx].plantId);
                                                            return p ? (
                                                                <View style={styles.photoBadge}>
                                                                    <Text style={styles.photoBadgeText}>{p.name}</Text>
                                                                </View>
                                                            ) : null;
                                                        })()}
                                                    </>
                                                ) : (
                                                    <View style={styles.photoPlaceholderInner}>
                                                        <Ionicons name="camera-outline" size={20} color="#C0C8BC" />
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Sticky note */}
                                <View style={styles.stickyNote}>
                                    <TextInput
                                        style={styles.stickyNoteInput}
                                        value={editNote}
                                        onChangeText={setEditNote}
                                        editable={!isLocked}
                                        placeholder={"오늘 하루 식물을 돌보며\n느낀 생각과 감정을 써보세요."}
                                        placeholderTextColor="#C8BE98"
                                        multiline
                                        textAlignVertical="top"
                                    />
                                </View>

                                {/* Save (hidden when locked) */}
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
                                        <Ionicons name="checkmark" size={18} color="#2F702D" />
                                    )}
                                </TouchableOpacity>
                            ))}
                            {pickerIdx !== null && editSlots[pickerIdx]?.plantId && (
                                <TouchableOpacity
                                    style={[styles.pickerRow, { borderTopWidth: 1, borderTopColor: "#F0EEE2" }]}
                                    onPress={() => pickerIdx !== null && clearLabel(pickerIdx)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.pickerImg} />
                                    <Text style={[styles.pickerName, { color: "#D4887A" }]}>라벨 제거</Text>
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
    root: { flex: 1, backgroundColor: "#FAFFF0" },
    safe: { flex: 1 },

    header: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
    },
    headerBtn: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    monthNav: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    monthText: {
        fontFamily: FONT,
        fontSize: 18,
        color: "#111111",
        includeFontPadding: false,
        minWidth: 116,
        textAlign: "center",
    },

    scroll: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 40,
        gap: 14,
    },

    // ── calendar ──
    calCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "#E0EBCD",
        paddingHorizontal: 6,
        paddingTop: 10,
        paddingBottom: 12,
    },
    weekNavRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F4F0E8",
        marginBottom: 4,
    },
    weekNavText: {
        fontFamily: FONT,
        fontSize: 12,
        color: "#5A8A5A",
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
        margin: 2,
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
    },
    cellGhost:   { backgroundColor: "transparent" },
    cellSel:     { backgroundColor: "#2F702D" },
    cellJournal: { borderWidth: 1.5, borderColor: "#5A9A5A" },
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
        fontFamily: FONT,
        fontSize: 12,
        color: "#8AB08A",
        includeFontPadding: false,
        paddingVertical: 6,
    },
    dayNum: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#222222",
        includeFontPadding: false,
    },
    dayNumSel:   { color: "#FFFFFF" },
    dayNumToday: { color: "#2F702D" },
    sunColor:    { color: "#D46060" },
    satColor:    { color: "#5A7AD4" },
    todayDot: {
        position: "absolute",
        bottom: 4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#5A9A5A",
    },
    legend: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 18,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: "#F4F0E8",
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    legendDot: {
        width: 18,
        height: 18,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
    },
    legendDotJournal: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: "#5A9A5A",
    },
    legendText: {
        fontFamily: FONT,
        fontSize: 11,
        color: "#7A9A7A",
        includeFontPadding: false,
    },

    // ── diary ──
    diaryPage: {
        backgroundColor: "#FFFEF8",
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "#E0EBCD",
        padding: 20,
        gap: 14,
    },
    diaryHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    diaryDateText: {
        fontFamily: FONT,
        fontSize: 18,
        color: "#1A2E1A",
        includeFontPadding: false,
    },
    savedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#E8F5E8",
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    savedBadgeText: {
        fontFamily: FONT,
        fontSize: 11,
        color: "#5A8A5A",
        includeFontPadding: false,
    },
    diaryIconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
    },
    diaryCareIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    diaryPlantCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#F0F8EC",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#D0E8C0",
        overflow: "hidden",
    },
    diaryCircleImg: {
        width: 28,
        height: 28,
    },

    // photo section
    photoSection: {
        flexDirection: "row",
        height: 210,
        gap: 8,
    },
    mainPhotoSlot: {
        flex: 3,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#F6FAF0",
        borderWidth: 1.2,
        borderColor: "#D8E8C8",
    },
    sidePhotos: {
        flex: 2,
        gap: 8,
    },
    sidePhotoSlot: {
        flex: 1,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#F6FAF0",
        borderWidth: 1.2,
        borderColor: "#D8E8C8",
    },
    photoPlaceholderInner: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    photoAddText: {
        fontFamily: FONT,
        fontSize: 10,
        color: "#C0C8BC",
        includeFontPadding: false,
    },
    photoBadge: {
        position: "absolute",
        bottom: 6,
        left: 6,
        backgroundColor: "rgba(0,0,0,0.45)",
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    photoBadgeText: {
        fontFamily: FONT,
        fontSize: 10,
        color: "#FFFFFF",
        includeFontPadding: false,
    },

    // sticky note
    stickyNote: {
        backgroundColor: "#FEFBDF",
        borderRadius: 8,
        padding: 14,
        borderWidth: 1,
        borderColor: "#E8E0B8",
        shadowColor: "#C8B800",
        shadowOpacity: 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    stickyNoteInput: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#333322",
        minHeight: 80,
        textAlignVertical: "top",
        includeFontPadding: false,
    },

    saveBtn: {
        backgroundColor: "#2F702D",
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        shadowColor: "#2F702D",
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    saveBtnText: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#FFFFFF",
        includeFontPadding: false,
    },

    // ── modal ──
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.42)",
        justifyContent: "center",
        alignItems: "center",
    },
    pickerBox: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingTop: 4,
        paddingBottom: 8,
        width: 280,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 10,
    },
    pickerTitle: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#2A4020",
        textAlign: "center",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F0EEE2",
        includeFontPadding: false,
    },
    pickerRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 14,
    },
    pickerImg: {
        width: 40,
        height: 40,
    },
    pickerName: {
        fontFamily: FONT,
        fontSize: 14,
        color: "#222222",
        flex: 1,
        includeFontPadding: false,
    },
});