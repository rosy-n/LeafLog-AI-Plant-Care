import React, { useCallback, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import ScreenHeader from "../components/ScreenHeader";
import ActionButton from "../components/ActionButton";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import { answerInquiry, getAllInquiries, type Inquiry } from "../api";

/**
 * 문의 관리 — role='ADMIN' 계정만 들어온다.
 *
 * 진입점은 설정 화면이고 그쪽에서 role 로 항목을 가린다. 다만 화면을 가리는 것은
 * 편의일 뿐이고, 실제 차단은 서버가 한다 (관리자가 아니면 403).
 */
export default function InquiryAdminScreen({ navigation }: { navigation: any }) {
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [onlyOpen, setOnlyOpen] = useState(true);
    const [loaded, setLoaded] = useState(false);
    // 문의별 답변 입력값 — 여러 건을 동시에 쓰다 말 수 있어 id 로 들고 있는다
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const [savingId, setSavingId] = useState<number | null>(null);

    const refresh = useCallback(() => {
        getAllInquiries(onlyOpen)
            .then((rows) => {
                setInquiries(rows);
                setLoaded(true);
            })
            .catch((e: any) => {
                setLoaded(true);
                Alert.alert("목록을 불러오지 못했어요", e?.message ?? "다시 시도해주세요.");
            });
    }, [onlyOpen]);

    useFocusEffect(refresh);

    const submitAnswer = async (item: Inquiry) => {
        const text = (drafts[item.id] ?? item.answer ?? "").trim();
        if (!text || savingId !== null) return;

        setSavingId(item.id);
        try {
            await answerInquiry(item.id, text);
            // 입력값은 지우고 서버가 준 최신 상태로 목록을 다시 맞춘다
            setDrafts((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
            });
            refresh();
        } catch (e: any) {
            Alert.alert("답변 저장 실패", e?.message ?? "다시 시도해주세요.");
        } finally {
            setSavingId(null);
        }
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                <ScreenHeader title="문의 관리" onBack={() => navigation.goBack()} />

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.filterRow}>
                            <Text style={styles.filterLabel}>답변 안 한 것만 보기</Text>
                            <Switch
                                value={onlyOpen}
                                onValueChange={setOnlyOpen}
                                trackColor={{ false: Colors.border, true: GreenTint.line }}
                                thumbColor={Colors.white}
                                ios_backgroundColor={Colors.border}
                            />
                        </View>

                        {loaded && inquiries.length === 0 && (
                            <Text style={styles.emptyText}>
                                {onlyOpen
                                    ? "답변을 기다리는 문의가 없어요."
                                    : "아직 들어온 문의가 없어요."}
                            </Text>
                        )}

                        {inquiries.map((item) => {
                            const draft = drafts[item.id] ?? item.answer ?? "";
                            const saving = savingId === item.id;
                            return (
                                <View key={item.id} style={styles.card}>
                                    <View style={styles.cardHead}>
                                        <Text style={styles.cardDate}>
                                            #{item.id} · {item.created_at.slice(0, 10)}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.badge,
                                                item.answer ? styles.badgeDone : styles.badgeWait,
                                            ]}
                                        >
                                            {item.answer ? "답변 완료" : "답변 대기"}
                                        </Text>
                                    </View>

                                    <Text style={styles.content}>{item.content}</Text>

                                    <TextInput
                                        style={styles.answerInput}
                                        placeholder="답변을 입력해주세요"
                                        placeholderTextColor={Colors.textFaint}
                                        value={draft}
                                        onChangeText={(v) =>
                                            setDrafts((prev) => ({ ...prev, [item.id]: v }))
                                        }
                                        multiline
                                        textAlignVertical="top"
                                        editable={!saving}
                                        maxLength={4000}
                                    />

                                    <ActionButton
                                        label={
                                            saving
                                                ? "저장 중"
                                                : item.answer
                                                  ? "답변 수정"
                                                  : "답변 등록"
                                        }
                                        color={
                                            draft.trim() && !saving
                                                ? GreenTint.deep
                                                : GreenTint.soft
                                        }
                                        size="md"
                                        shadow={false}
                                        disabled={!draft.trim() || saving}
                                        onPress={() => submitAnswer(item)}
                                    />
                                </View>
                            );
                        })}
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
        gap: Spacing.md,
    },

    filterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: Spacing.sm,
    },
    filterLabel: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        includeFontPadding: false,
    },
    emptyText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textFaint,
        textAlign: "center",
        paddingVertical: Spacing.huge,
        includeFontPadding: false,
    },

    card: {
        gap: Spacing.sm,
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
        padding: Spacing.lg,
    },
    cardHead: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    cardDate: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        includeFontPadding: false,
    },
    badge: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.caption,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xxs,
        borderRadius: Radius.pill,
        overflow: "hidden",
        includeFontPadding: false,
    },
    badgeWait: {
        backgroundColor: GreenTint.soft,
        color: GreenTint.strong,
    },
    badgeDone: {
        backgroundColor: GreenTint.deep,
        color: Colors.white,
    },
    content: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        lineHeight: 20,
        includeFontPadding: false,
    },
    answerInput: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.textBlack,
        backgroundColor: Colors.background,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: GreenTint.soft,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        minHeight: 88,
        includeFontPadding: false,
    },
});
