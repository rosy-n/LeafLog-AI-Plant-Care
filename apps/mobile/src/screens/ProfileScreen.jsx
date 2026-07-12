import React, { useEffect, useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, Paper } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import ScreenHeader from "../components/ScreenHeader";
import { getPlant, updatePlant } from "../api";

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

// 등록일 기준 함께한 일수 (1일째부터)
function daysTogether(iso) {
    if (!iso) return null;
    const created = new Date(iso).getTime();
    if (Number.isNaN(created)) return null;
    return Math.max(0, Math.floor((Date.now() - created) / 86400000)) + 1;
}

export default function ProfileScreen({ navigation, route }) {
    const plant = route?.params?.plant;
    const [detail, setDetail] = useState(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(null);

    useEffect(() => {
        const id = plant?.id;
        if (!id) return;
        let mounted = true;
        getPlant(Number(id))
            .then((d) => {
                if (mounted) setDetail(d);
            })
            .catch(() => {
                if (mounted) setDetail(null);
            });
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
            });
            setDetail(updated);
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

            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
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

                {/* 좌측 프로필 이미지 + 우측 식물 정보 */}
                <View style={styles.profileRow}>
                    <View style={styles.leftArea}>
                        <View style={styles.plantCard}>
                            <Image
                                source={require("../../assets/plants/spaghetti.png")}
                                style={styles.plantImage}
                                resizeMode="contain"
                            />
                        </View>

                        <Text style={styles.daysText}>
                            {together != null ? `함께한 지 ${together}일 째` : "함께한 지 -"}
                        </Text>
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
                                    <Text style={styles.infoLabel}>위치</Text>
                                    <TouchableOpacity style={styles.selectValue} onPress={cycleLocation} activeOpacity={0.7}>
                                        <Text style={styles.selectValueText}>
                                            {LOCATION_LABELS[form.location_name] ?? "선택"} ▸
                                        </Text>
                                    </TouchableOpacity>
                                </View>
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
                            </>
                        ) : (
                            <>
                                <Text style={styles.infoText}>이름: {name}</Text>
                                <Text style={styles.infoText}>상태: {statusText}</Text>
                                <Text style={styles.infoText}>키: {heightText}</Text>
                                <Text style={styles.infoText}>위치: {locationText}</Text>
                                <Text style={styles.infoText}>화분 종류: {potTypeText}</Text>
                                <Text style={styles.infoText}>화분 크기: {potSizeText}</Text>
                            </>
                        )}
                    </View>
                </View>

                {/* 추억 이동 버튼 */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.memoryButton}
                    onPress={() => navigation.navigate("MemorialPlant")}
                >
                    <Text style={styles.memoryButtonText}>
                        나의 정원에서 추억으로 이동
                    </Text>
                </TouchableOpacity>
            </View>
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
        marginTop: Spacing.huge,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: Spacing.xl,
    },

    leftArea: {
        width: CARD_WIDTH,
        alignItems: "center",
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
        marginTop: Spacing.lg,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.textBlack,
        includeFontPadding: false,
        textAlign: "center",
    },

    infoArea: {
        width: SCREEN_WIDTH * 0.46,
        paddingTop: Spacing.sm,
        paddingLeft: Spacing.lg,
    },

    infoText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        lineHeight: 30,
        color: Colors.textBlack,
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

    memoryButton: {
        position: "absolute",
        top: SCREEN_HEIGHT * 0.45,
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
});