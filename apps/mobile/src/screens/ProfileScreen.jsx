import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Keyboard,
    SafeAreaView,
    StatusBar,
    Dimensions,
    Alert,
    Modal,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, Paper, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import ScreenHeader from "../components/ScreenHeader";
import {
    getPlant,
    updatePlant,
    searchSpecies,
    getPlantCare,
    updateWateringSchedule,
} from "../api";
import { plantImages } from "../data/plants";

// 서버 enum 코드 → 한글 표시
const LOCATION_LABELS = {
    LIVING_ROOM: "거실",
    BEDROOM: "침실",
    BALCONY: "베란다",
    KITCHEN: "주방",
    OFFICE: "사무실",
};
const STATUS_LABELS = { ALIVE: "건강함", SICK: "아픔", DEAD: "떠나보냄" };

// 편집 시 탭으로 순환할 enum 순서 (CHECK 제약 값)
const STATUS_ORDER = ["ALIVE", "SICK", "DEAD"];
const LOCATION_ORDER = ["LIVING_ROOM", "BEDROOM", "BALCONY", "KITCHEN", "OFFICE"];

// 물주기 주기 조절 범위 (서버도 1~365 로 검증)
const WATERING_MIN_DAYS = 1;
const WATERING_MAX_DAYS = 60;

// 주기의 근거 — DEFAULT 는 자료가 없어 넣은 값이라 그 사실을 감추지 않는다
const INTERVAL_SOURCE_NOTE = {
    SPECIES: "종 정보 기준",
    DEFAULT: "자료가 없어 기본값",
    USER: "직접 설정",
};

// 등록일 기준 함께한 일수 (1일째부터)
function daysTogether(iso) {
    if (!iso) return null;
    const created = new Date(iso).getTime();
    if (Number.isNaN(created)) return null;
    return Math.max(0, Math.floor((Date.now() - created) / 86400000)) + 1;
}

// 읽기 모드 한 줄 — 라벨은 회색 고정폭, 값은 남는 폭을 쓴다.
// '식물종: 수박페페로미아' 처럼 값이 길어도 라벨 기준선이 흐트러지지 않게 하기 위함.
function InfoLine({ label, value, note }) {
    return (
        <View style={styles.infoLine}>
            <Text style={styles.infoLineLabel}>{label}</Text>
            <View style={styles.infoLineValueBox}>
                <Text style={styles.infoText}>{value}</Text>
                {note ? <Text style={styles.infoLineNote}>{note}</Text> : null}
            </View>
        </View>
    );
}

export default function ProfileScreen({ navigation, route }) {
    const plant = route?.params?.plant;
    const [detail, setDetail] = useState(null);
    const [care, setCare] = useState(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(null);

    // 식물종 다시 고르기 — 인식이 어긋났거나 종 마스터 도입 전에 등록한 개체용
    const [pickerOpen, setPickerOpen] = useState(false);
    const [speciesQuery, setSpeciesQuery] = useState("");
    const [speciesResults, setSpeciesResults] = useState([]);
    const [speciesSearching, setSpeciesSearching] = useState(false);
    const searchTimer = useRef(null);

    const onSpeciesQueryChange = (text) => {
        setSpeciesQuery(text);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!text.trim()) {
            setSpeciesResults([]);
            return;
        }
        searchTimer.current = setTimeout(async () => {
            setSpeciesSearching(true);
            try {
                setSpeciesResults(await searchSpecies(text));
            } catch (e) {
                Alert.alert("오류", e?.message ?? "식물종 검색에 실패했어요.");
            } finally {
                setSpeciesSearching(false);
            }
        }, 400);
    };

    const openSpeciesPicker = () => {
        setSpeciesQuery("");
        setSpeciesResults([]);
        setPickerOpen(true);
    };

    const chooseSpecies = (species) => {
        setForm((f) => ({
            ...f,
            species_id: species.species_id,
            species_name: species.common_name_ko,
        }));
        setPickerOpen(false);
    };

    useEffect(() => {
        const id = plant?.id;
        if (!id) return;
        let mounted = true;
        // allSettled: 돌봄 일정 조회가 실패해도 프로필은 보여준다
        Promise.allSettled([getPlant(Number(id)), getPlantCare(Number(id))]).then(
            ([detailResult, careResult]) => {
                if (!mounted) return;
                setDetail(detailResult.status === "fulfilled" ? detailResult.value : null);
                if (careResult.status === "fulfilled") setCare(careResult.value);
            },
        );
        return () => {
            mounted = false;
        };
    }, [plant?.id]);

    const startEdit = () => {
        setForm({
            nickname: detail?.nickname ?? plant?.name ?? "",
            status: detail?.status ?? "ALIVE",
            height: detail?.height ?? "",
            location_name: detail?.location_name ?? null,
            pot_type: detail?.pot_type ?? "",
            pot_size: detail?.pot_size ?? "",
            // 종은 바꾸지 않으면 null 로 남겨 PATCH 에 싣지 않는다
            species_id: null,
            species_name: detail?.species?.common_name_ko ?? detail?.common_name_ko ?? null,
            // 물주기 주기 — 저장 시 값이 바뀐 경우에만 별도 엔드포인트로 보낸다
            watering_days: care?.watering_interval_days
                ? String(care.watering_interval_days)
                : "",
            watering_reset: false,
        });
        setEditing(true);
    };

    const cycleStatus = () =>
        setForm((f) => ({
            ...f,
            status: STATUS_ORDER[(STATUS_ORDER.indexOf(f.status) + 1) % STATUS_ORDER.length],
        }));

    const cycleLocation = () =>
        setForm((f) => ({
            ...f,
            location_name:
                LOCATION_ORDER[(LOCATION_ORDER.indexOf(f.location_name) + 1) % LOCATION_ORDER.length],
        }));

    const saveEdit = async () => {
        const id = plant?.id;
        if (!id || !form) {
            setEditing(false);
            return;
        }
        if (!form.nickname.trim()) {
            Alert.alert("확인", "이름을 입력해주세요.");
            return;
        }
        setSaving(true);
        try {
            const updated = await updatePlant(Number(id), {
                nickname: form.nickname.trim(),
                status: form.status,
                location_name: form.location_name,
                pot_type: form.pot_type,
                pot_size: form.pot_size,
                height: form.height,
                // 종을 다시 고른 경우에만 포함 (넘기지 않으면 서버가 건드리지 않음)
                ...(form.species_id ? { species_id: form.species_id } : {}),
            });
            setDetail(updated);

            // 물주기 주기는 전용 엔드포인트를 쓴다 (다음 예정일 재계산이 따라오므로)
            const days = Number(form.watering_days);
            const changed =
                form.watering_reset ||
                (Number.isFinite(days) &&
                    days >= WATERING_MIN_DAYS &&
                    days <= WATERING_MAX_DAYS &&
                    days !== care?.watering_interval_days);
            if (changed) {
                try {
                    setCare(
                        await updateWateringSchedule(
                            Number(id),
                            form.watering_reset ? null : days,
                        ),
                    );
                } catch (e) {
                    Alert.alert("물주기 저장 실패", e?.message ?? "다시 시도해주세요.");
                }
            }

            setEditing(false);
        } catch (e) {
            Alert.alert("저장 실패", e?.message ?? "다시 시도해주세요.");
        } finally {
            setSaving(false);
        }
    };

    const onEditPress = () => {
        if (saving) return;
        if (editing) saveEdit();
        else startEdit();
    };

    // 추억으로 이동: 상태를 DEAD(떠나보냄)로 변경하고 DB 반영 후 추억 화면으로 이동
    const moveToMemorial = () => {
        Alert.alert(
            "추억으로 이동",
            `${name}을(를) 떠나보내고 추억 공간으로 옮길까요?`,
            [
                { text: "취소", style: "cancel" },
                {
                    text: "이동",
                    style: "destructive",
                    onPress: async () => {
                        const id = plant?.id;
                        try {
                            if (id) {
                                const updated = await updatePlant(Number(id), { status: "DEAD" });
                                setDetail(updated);
                            }
                            navigation.navigate("MemorialPlant", { plant });
                        } catch (e) {
                            Alert.alert("이동 실패", e?.message ?? "다시 시도해주세요.");
                        }
                    },
                },
            ]
        );
    };

    const name = detail?.nickname ?? plant?.name ?? "-";
    const statusText = STATUS_LABELS[detail?.status] ?? "-";
    const heightText = detail?.height ? `${detail.height}cm` : "-";
    const locationText = LOCATION_LABELS[detail?.location_name] ?? "-";
    const potTypeText = detail?.pot_type ?? "-";
    const potSizeText = detail?.pot_size ? `${detail.pot_size}cm` : "-";
    const together = daysTogether(detail?.created_at ?? plant?.createdAt);

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

            {/*
                추억 버튼을 흐름 안으로 옮긴 뒤로 편집 모드(항목 8개)에서 내용이
                작은 화면을 넘길 수 있어 스크롤을 둔다. 키보드는 드래그로 닫힌다
                (ScrollView 가 탭을 먼저 받아 바깥 탭 닫기는 동작하지 않는다).
            */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                {/* 상단 제목 / 편집 버튼 */}
                <ScreenHeader
                    title="프로필"
                    onBack={() => navigation.goBack()}
                    right={
                        <TouchableOpacity
                            activeOpacity={0.75}
                            style={styles.editButton}
                            onPress={onEditPress}
                            disabled={saving}
                        >
                            <Ionicons
                                name={editing ? "checkmark" : "pencil-outline"}
                                size={28}
                                color={editing ? Colors.primary : Colors.textBlack}
                            />
                            <View style={styles.editUnderline} />
                        </TouchableOpacity>
                    }
                />

                {/*
                    상단: 캐릭터 카드 + 짧은 요약(함께한 지 / 이름 / 종명)
                    하단: 세부 항목 카드 (전체 폭)

                    이전에는 세부 항목 8개를 카드 옆 좁은 열(149~189pt)에 넣어
                    값이 계속 줄바꿈되고 두 열의 높이도 안 맞았다.
                    항목 수가 늘어난 뒤로는 나란히 두는 배치가 맞지 않는다.
                */}
                <View style={styles.profileRow}>
                    <View style={styles.plantCard}>
                        <Image
                            source={plant?.imageUri ? { uri: plant.imageUri } : plantImages[plant?.imageKey ?? "spaghetti"]}
                            style={styles.plantImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* 이름을 맨 위에 두고 종명·함께한 일수를 아래로 — 이름이 문장 사이에 끼지 않게 */}
                    <View style={styles.summaryArea}>
                        <Text style={styles.summaryName} numberOfLines={1}>
                            {name}
                        </Text>
                        <Text style={styles.summarySpecies} numberOfLines={2}>
                            {detail?.species?.common_name_ko ?? detail?.common_name_ko ?? "-"}
                        </Text>
                        <Text style={styles.daysText}>
                            {together != null ? `함께한 지 ${together}일 째` : "함께한 지 -"}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoArea}>
                        {editing && form ? (
                            <>
                                <View style={styles.editRow}>
                                    <Text style={styles.infoLabel}>이름</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={form.nickname}
                                        onChangeText={(v) => setForm((f) => ({ ...f, nickname: v }))}
                                        maxLength={20}
                                    />
                                </View>
                                <View style={styles.editRow}>
                                    <Text style={styles.infoLabel}>상태</Text>
                                    <TouchableOpacity style={styles.selectValue} onPress={cycleStatus} activeOpacity={0.7}>
                                        <Text style={styles.selectValueText}>{STATUS_LABELS[form.status]} ▸</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.editRow}>
                                    <Text style={styles.infoLabel}>키</Text>
                                    <TextInput
                                        style={styles.editInputSmall}
                                        value={form.height}
                                        onChangeText={(v) => setForm((f) => ({ ...f, height: v.replace(/[^0-9]/g, "") }))}
                                        keyboardType="number-pad"
                                        maxLength={3}
                                    />
                                    <Text style={styles.unit}>cm</Text>
                                </View>
                                <View style={styles.editRow}>
                                    <Text style={styles.infoLabel}>식물종</Text>
                                    <TouchableOpacity
                                        style={styles.selectValue}
                                        onPress={openSpeciesPicker}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.selectValueText} numberOfLines={1}>
                                            {form.species_name ?? "선택"} ▸
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.editRow}>
                                    <Text style={styles.infoLabel}>위치</Text>
                                    <TouchableOpacity style={styles.selectValue} onPress={cycleLocation} activeOpacity={0.7}>
                                        <Text style={styles.selectValueText}>
                                            {LOCATION_LABELS[form.location_name] ?? "선택"} ▸
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                {care ? (
                                    <View style={styles.editRow}>
                                        <Text style={styles.infoLabel}>물주기</Text>
                                        <TextInput
                                            style={styles.editInputSmall}
                                            value={form.watering_days}
                                            onChangeText={(v) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    watering_days: v.replace(/[^0-9]/g, ""),
                                                    watering_reset: false,
                                                }))
                                            }
                                            keyboardType="number-pad"
                                            maxLength={2}
                                        />
                                        <Text style={styles.unit}>일에 한 번</Text>
                                    </View>
                                ) : null}

                                <View style={styles.editRow}>
                                    <Text style={styles.infoLabel}>화분 종류</Text>
                                    <TextInput
                                        style={styles.editInput}
                                        value={form.pot_type}
                                        onChangeText={(v) => setForm((f) => ({ ...f, pot_type: v }))}
                                        maxLength={30}
                                        placeholder="예: 토분"
                                        placeholderTextColor={Colors.textFaint}
                                    />
                                </View>
                                <View style={styles.editRow}>
                                    <Text style={styles.infoLabel}>화분 크기</Text>
                                    <TextInput
                                        style={styles.editInputSmall}
                                        value={form.pot_size}
                                        onChangeText={(v) => setForm((f) => ({ ...f, pot_size: v.replace(/[^0-9]/g, "") }))}
                                        keyboardType="number-pad"
                                        maxLength={3}
                                    />
                                    <Text style={styles.unit}>cm</Text>
                                </View>

                                {/* 직접 설정한 주기를 권장값으로 되돌리기 */}
                                {care?.watering_interval_source === "USER" &&
                                !form.watering_reset ? (
                                    <TouchableOpacity
                                        onPress={() =>
                                            setForm((f) => ({
                                                ...f,
                                                watering_reset: true,
                                                watering_days: "",
                                            }))
                                        }
                                        activeOpacity={0.7}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={styles.resetLink}>
                                            물주기를 권장값으로 되돌리기
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                                {form.watering_reset ? (
                                    <Text style={styles.resetLink}>
                                        저장하면 권장 주기로 돌아갑니다
                                    </Text>
                                ) : null}
                            </>
                        ) : (
                            <>
                                {/* 이름·식물종은 위 요약에 있으므로 여기서는 생략 */}
                                <InfoLine label="상태" value={statusText} />
                                <InfoLine label="키" value={heightText} />
                                <InfoLine label="위치" value={locationText} />
                                <InfoLine label="화분 종류" value={potTypeText} />
                                <InfoLine label="화분 크기" value={potSizeText} />
                                {care?.watering_interval_days ? (
                                    <InfoLine
                                        label="물주기"
                                        value={`${care.watering_interval_days}일에 한 번`}
                                        note={
                                            care.watering_interval_source
                                                ? INTERVAL_SOURCE_NOTE[
                                                      care.watering_interval_source
                                                  ]
                                                : null
                                        }
                                    />
                                ) : null}
                            </>
                        )}
                </View>

                {/* 추억 이동 버튼 */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.memoryButton}
                    onPress={moveToMemorial}
                >
                    <Text style={styles.memoryButtonText}>
                        나의 정원에서 추억으로 이동
                    </Text>
                </TouchableOpacity>

                {/* 식물종 다시 고르기 */}
                <Modal
                    visible={pickerOpen}
                    animationType="slide"
                    transparent
                    onRequestClose={() => setPickerOpen(false)}
                >
                    <View style={styles.pickerBackdrop}>
                        <View style={styles.pickerSheet}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>식물종 다시 고르기</Text>
                                <TouchableOpacity onPress={() => setPickerOpen(false)}>
                                    <Ionicons name="close" size={26} color={Colors.textBlack} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.pickerSearchRow}>
                                <TextInput
                                    style={styles.pickerInput}
                                    value={speciesQuery}
                                    onChangeText={onSpeciesQueryChange}
                                    placeholder="식물 이름이나 학명으로 검색"
                                    placeholderTextColor={Colors.textFaint}
                                    autoFocus
                                    returnKeyType="search"
                                />
                                {speciesSearching && <ActivityIndicator size="small" />}
                            </View>

                            <ScrollView
                                style={styles.pickerList}
                                keyboardShouldPersistTaps="handled"
                            >
                                {speciesResults.map((item) => (
                                    <TouchableOpacity
                                        key={item.species_id}
                                        style={styles.pickerItem}
                                        activeOpacity={0.7}
                                        onPress={() => chooseSpecies(item)}
                                    >
                                        <Text style={styles.pickerItemName} numberOfLines={1}>
                                            {item.common_name_ko}
                                        </Text>
                                        {item.scientific_name ? (
                                            <Text style={styles.pickerItemSci} numberOfLines={1}>
                                                {item.scientific_name}
                                            </Text>
                                        ) : null}
                                    </TouchableOpacity>
                                ))}
                                {!speciesSearching &&
                                speciesQuery.trim() &&
                                speciesResults.length === 0 ? (
                                    <Text style={styles.pickerEmpty}>검색 결과가 없어요</Text>
                                ) : null}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const CARD_WIDTH = SCREEN_WIDTH * 0.43;
const CARD_HEIGHT = CARD_WIDTH * 1.2;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    contentContainer: {
        paddingBottom: Spacing.xl,
    },

    editButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        marginTop: Spacing.none,
    },

    editUnderline: {
        width: 14,
        height: 3,
        borderRadius: Radius.xs,
        backgroundColor: Colors.textBlack,
        marginTop: -6,
        marginLeft: Spacing.xl,
    },

    profileRow: {
        marginTop: Spacing.xxl,
        flexDirection: "row",
        alignItems: "flex-start",
        width: "100%",
        paddingHorizontal: Spacing.xl,
        gap: Spacing.lg,
    },

    summaryArea: {
        flex: 1,
        minWidth: 0,
        paddingTop: Spacing.sm,
        gap: Spacing.xs,
    },

    summaryName: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.screenTitle,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    summarySpecies: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 24,
        color: Colors.textGray,
        includeFontPadding: false,
    },

    plantCard: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 28,
        backgroundColor: Paper.cardBg,
        borderWidth: 3,
        borderColor: Paper.cardBorder,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },

    plantImage: {
        width: CARD_WIDTH * 1.0,
        height: CARD_HEIGHT * 1.3,
    },

    daysText: {
        marginTop: Spacing.xs,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        includeFontPadding: false,
    },

    // 세부 항목 카드 — 전체 폭을 쓴다 (상단 요약과 분리)
    infoArea: {
        marginTop: Spacing.xl,
        marginHorizontal: Spacing.xl,
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
    },

    infoText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 26,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    infoLine: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: Spacing.xs,
    },

    // 라벨 폭을 고정해 값들의 시작선을 맞춘다 ('화분 종류' 가 가장 긴 라벨)
    infoLineLabel: {
        width: 66,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 26,
        color: Colors.textGray,
        includeFontPadding: false,
    },

    infoLineValueBox: {
        flex: 1,
        minWidth: 0,
    },

    infoLineNote: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        includeFontPadding: false,
    },

    // 편집 모드
    editRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    infoLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textGray,
        includeFontPadding: false,
    },
    editInput: {
        flex: 1,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        borderBottomWidth: 1,
        borderColor: Colors.border,
        paddingVertical: Spacing.xxs,
        includeFontPadding: false,
    },
    editInputSmall: {
        width: 40,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        borderBottomWidth: 1,
        borderColor: Colors.border,
        paddingVertical: Spacing.xxs,
        textAlign: "center",
        includeFontPadding: false,
    },
    unit: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    selectValue: {
        borderBottomWidth: 1,
        borderColor: Colors.border,
        paddingVertical: Spacing.xxs,
    },
    selectValueText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.primary,
        includeFontPadding: false,
    },

    // 이전에는 position:absolute + top:45% 로 고정돼 있어서, 세부 항목 카드가
    // 길어진 뒤로는 카드 위를 덮었다. 문서 흐름에 두고 카드 아래에 배치한다.
    memoryButton: {
        marginTop: Spacing.xxl,
        marginBottom: Spacing.xl,
        alignSelf: "center",
        width: SCREEN_WIDTH * 0.62,
        height: 46,
        borderRadius: Radius.xl,
        backgroundColor: Colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },

    memoryButtonText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.white,
        includeFontPadding: false,
    },

    resetLink: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.primary,
        marginTop: Spacing.sm,
        includeFontPadding: false,
    },

    // 식물종 다시 고르기 모달
    pickerBackdrop: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0, 0, 0, 0.35)",
    },

    pickerSheet: {
        maxHeight: SCREEN_HEIGHT * 0.7,
        backgroundColor: Colors.white,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.xxl,
    },

    pickerHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: Spacing.lg,
    },

    pickerTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    pickerSearchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.separator,
        paddingBottom: Spacing.sm,
        marginBottom: Spacing.sm,
    },

    pickerInput: {
        flex: 1,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        paddingVertical: Spacing.sm,
        includeFontPadding: false,
    },

    pickerList: {
        flexGrow: 0,
    },

    pickerItem: {
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.separator,
    },

    pickerItemName: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    pickerItemSci: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        marginTop: 2,
        includeFontPadding: false,
    },

    pickerEmpty: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textFaint,
        textAlign: "center",
        paddingVertical: Spacing.xl,
        includeFontPadding: false,
    },
});