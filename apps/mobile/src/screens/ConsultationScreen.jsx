import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    Image,
    ActivityIndicator,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import IconCircleButton from "../components/IconCircleButton";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import Markdown from "react-native-markdown-display";
import MarkdownIt from "markdown-it";
import markdownItMark from "markdown-it-mark";

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import { diagnosePlantPhoto, getConsultation, getPlant, updatePlant } from "../api";

const FALLBACK_TITLE = "상담 기록";

// 상담 화면의 "식물 상태 업데이트" 카드 — 프로필 탭과 값은 같지만(CHECK 제약)
// 카드에서는 짧은 라벨을 쓴다.
const STATUS_ORDER = ["ALIVE", "SICK", "DEAD"];
const STATUS_LABELS = { ALIVE: "건강", SICK: "아픔", DEAD: "떠나보냄" };

// 기본 markdown-it은 ==하이라이트==(mark) 문법을 모르므로 플러그인을 얹는다.
// 컴포넌트 바깥에서 한 번만 만들어 매 렌더마다 재생성되지 않게 한다.
const markdownItInstance = MarkdownIt({ typographer: true }).use(markdownItMark);

// react-native-markdown-display는 mark 노드에 대한 기본 렌더 규칙이 없어 직접 추가한다.
const markdownRules = {
    mark: (node, children, parent, styles) => (
        <Text key={node.key} style={styles.mark}>
            {children}
        </Text>
    ),
};

// LLM 답변(마크다운)을 도트 폰트 톤에 맞춰 렌더링 — NeoDunggeunmoPro가 bold 웨이트를
// 따로 갖고 있지 않아 굵게(**) 표시된 핵심 키워드는 폰트 굵기 대신 초록 텍스트로
// 강조한다. 더 시급한 경고(==하이라이트==)는 별도로 노란 배경으로 눈에 띄게 한다.
const markdownStyles = {
    body: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 21,
        color: Colors.textBlack,
    },
    heading1: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: Colors.primary,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    heading2: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.primary,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    strong: {
        color: Colors.primary,
    },
    mark: {
        backgroundColor: Colors.fertilizer,
        color: Colors.fertilizerIcon,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: Spacing.sm,
    },
    bullet_list_icon: {
        color: Colors.primary,
    },
    list_item: {
        marginBottom: Spacing.xxs,
    },
    hr: {
        backgroundColor: GreenTint.mist,
        height: 1,
        marginVertical: Spacing.sm,
    },
};

export default function ConsultationScreen({ navigation, route }) {
    const { sessionId, plant } = route.params;

    const [historyMessages, setHistoryMessages] = useState([]);
    const [consultationTitle, setConsultationTitle] = useState(FALLBACK_TITLE);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState([]);
    const [pendingImage, setPendingImage] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [plantDetail, setPlantDetail] = useState(null);
    // 카드마다 독립적으로: 아직 저장하지 않은 선택값(태그만 누른 상태) / 저장 완료된 결과
    const [selectedStatus, setSelectedStatus] = useState({});
    const [statusUpdates, setStatusUpdates] = useState({});
    const [savingStatusId, setSavingStatusId] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [expandedRagId, setExpandedRagId] = useState({});
    const scrollViewRef = useRef(null);
    // 진단은 매 요청마다 이미지가 필요하다 — 후속 질문에 새 사진이 없으면 직전에 보낸 사진을 재사용한다.
    // 과거 기록을 불러오면 그 세션의 마지막 사진 URL로 초기화된다(S3 URL도 업로드 폼에 그대로 쓸 수 있음).
    const lastImageRef = useRef(null);
    const copiedTimerRef = useRef(null);

    useEffect(() => {
        const id = plant?.id;
        if (!id) return;
        let mounted = true;
        getPlant(Number(id))
            .then((detail) => {
                if (mounted) setPlantDetail(detail);
            })
            .catch(() => {
                if (mounted) setPlantDetail({ status: "ALIVE", nickname: plant?.name });
            });
        return () => {
            mounted = false;
        };
    }, [plant?.id]);

    useEffect(() => {
        let mounted = true;
        getConsultation(sessionId)
            .then((detail) => {
                if (!mounted) return;
                setConsultationTitle(detail.title || FALLBACK_TITLE);
                const converted = detail.messages.map((m) => ({
                    id: `h${m.id}`,
                    role: m.role,
                    // 사진만 보낸 턴은 서버가 "[사진]" 자리표시자를 넣어두는데, 사진 버블이 이미
                    // 있으니 그 문구를 텍스트 버블로 중복 표시하지 않는다.
                    text: m.content === "[사진]" && m.image_url ? "" : m.content,
                    images: m.image_url ? [m.image_url] : [],
                    // DB에 저장된 진단 당시 RAG 근거 — 과거 상담을 다시 열어도 토글로 보여줄 수 있다.
                    similarCases: m.similar_cases ?? [],
                    referenceDatasetSize: m.reference_dataset_size ?? null,
                }));
                setHistoryMessages(converted);
                const lastUserImage = [...converted].reverse().find((m) => m.role === "user" && m.images.length > 0);
                if (lastUserImage) {
                    lastImageRef.current = lastUserImage.images[0];
                }
            })
            .catch((e) => {
                if (!mounted) return;
                Alert.alert(
                    "상담 기록을 불러오지 못했어요",
                    e?.message ?? "다시 시도해주세요.",
                    [{ text: "확인", onPress: () => navigation.goBack() }]
                );
            })
            .finally(() => {
                if (mounted) setIsLoadingHistory(false);
            });
        return () => {
            mounted = false;
        };
    }, [sessionId]);

    useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

    const plantName = plantDetail?.nickname ?? plant?.name ?? "식물";

    const submitStatusUpdate = async (msgId) => {
        const id = plant?.id;
        if (!id || savingStatusId) return;
        const previousStatus = plantDetail?.status ?? "ALIVE";
        const chosenStatus = selectedStatus[msgId] ?? previousStatus;
        setSavingStatusId(msgId);
        try {
            const updated = await updatePlant(Number(id), { status: chosenStatus });
            setPlantDetail(updated);
            setStatusUpdates((prev) => ({
                ...prev,
                [msgId]: { status: chosenStatus, kept: chosenStatus === previousStatus },
            }));
        } catch (e) {
            Alert.alert("상태 변경 실패", e?.message ?? "다시 시도해주세요.");
        } finally {
            setSavingStatusId(null);
        }
    };

    const copyText = async (id, text) => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        setCopiedId(id);
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1200);
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            alert("갤러리 접근 권한이 필요합니다.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 0.8,
        });
        if (!result.canceled) {
            setPendingImage(result.assets[0].uri);
        }
    };

    const sendMessage = async () => {
        const trimmed = message.trim();
        if ((!trimmed && !pendingImage) || isSending) return;

        const userMessage = {
            id: Date.now(),
            role: "user",
            text: trimmed,
            images: pendingImage ? [pendingImage] : [],
        };

        if (pendingImage) {
            lastImageRef.current = pendingImage;
        }

        setNewMessages((prev) => [...prev, userMessage]);
        setMessage("");
        setPendingImage(null);

        if (!lastImageRef.current) {
            setNewMessages((prev) => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: "assistant",
                    text: "식물 사진을 먼저 첨부해 주세요. 사진이 있어야 정확한 상담이 가능해요.",
                    images: [],
                },
            ]);
            return;
        }

        const loadingId = Date.now() + 1;
        setIsSending(true);
        setNewMessages((prev) => [...prev, { id: loadingId, role: "assistant", text: "···", images: [] }]);

        try {
            const result = await diagnosePlantPhoto(
                { uri: lastImageRef.current },
                trimmed || undefined,
                plant?.id,
                sessionId
            );
            setNewMessages((prev) =>
                prev.map((item) =>
                    item.id === loadingId
                        ? {
                              ...item,
                              text: result.diagnosis,
                              isDiagnosis: true,
                              similarCases: result.similar_cases,
                              referenceDatasetSize: result.reference_dataset_size,
                          }
                        : item
                )
            );
        } catch (error) {
            const errorText = error instanceof Error ? error.message : "상담 답변을 받아오지 못했어요.";
            setNewMessages((prev) =>
                prev.map((item) => (item.id === loadingId ? { ...item, text: errorText } : item))
            );
        } finally {
            setIsSending(false);
        }
    };

    const canSend = !!(message.trim() || pendingImage) && !isSending;

    const renderBubble = (item) =>
        item.role === "assistant" ? (
            <View key={item.id} style={styles.assistantRow}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onLongPress={() => copyText(item.id, item.text)}
                >
                    <Markdown
                        style={markdownStyles}
                        rules={markdownRules}
                        markdownit={markdownItInstance}
                    >
                        {item.text}
                    </Markdown>
                </TouchableOpacity>
                {copiedId === item.id && (
                    <View style={[styles.copiedBadge, styles.copiedBadgeLeft]}>
                        <Text style={styles.copiedBadgeText}>복사됨</Text>
                    </View>
                )}
                {item.similarCases?.length > 0 && (
                    <View style={styles.ragSection}>
                        <TouchableOpacity
                            style={styles.ragToggle}
                            activeOpacity={0.7}
                            onPress={() =>
                                setExpandedRagId((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                            }
                        >
                            <Text style={styles.ragToggleText}>
                                RAG 검색 결과
                                {item.referenceDatasetSize != null
                                    ? ` · 전체 ${item.referenceDatasetSize}장 중 ${item.similarCases.length}건`
                                    : ""}
                                {" "}
                                {expandedRagId[item.id] ? "▲" : "▼"}
                            </Text>
                        </TouchableOpacity>
                        {expandedRagId[item.id] && (
                            <View style={styles.ragList}>
                                {item.similarCases.map((c, idx) => (
                                    <View key={idx} style={styles.ragRow}>
                                        {c.image_url ? (
                                            <Image
                                                source={{ uri: c.image_url }}
                                                style={styles.ragThumb}
                                                resizeMode="cover"
                                            />
                                        ) : null}
                                        <Text style={styles.ragItemText}>
                                            {idx + 1}. {c.plant_species ?? "종 미상"} · {c.symptom_group ?? "증상 미상"}
                                            {c.suspected_cause ? ` · ${c.suspected_cause}` : ""}
                                            {c.plant_part ? ` · ${c.plant_part}` : ""}
                                            {"  "}(유사도 {Math.round(c.score * 100)}%)
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}
                {item.isDiagnosis && plant?.id && (
                    <View style={styles.statusCard}>
                        {statusUpdates[item.id] ? (
                            <Text style={styles.statusResultText}>
                                {plantName}의 상태를 {STATUS_LABELS[statusUpdates[item.id].status]}
                                {statusUpdates[item.id].kept ? "로 유지했어요" : "로 업데이트했어요"}
                            </Text>
                        ) : (
                            <>
                                <Text style={styles.statusCardTitle}>식물 상태 업데이트</Text>
                                <View style={styles.statusRow}>
                                    <View style={styles.statusOptions}>
                                        {STATUS_ORDER.map((code) => {
                                            const active =
                                                (selectedStatus[item.id] ?? plantDetail?.status) === code;
                                            return (
                                                <TouchableOpacity
                                                    key={code}
                                                    style={[
                                                        styles.statusChip,
                                                        active && styles.statusChipActive,
                                                    ]}
                                                    onPress={() =>
                                                        setSelectedStatus((prev) => ({
                                                            ...prev,
                                                            [item.id]: code,
                                                        }))
                                                    }
                                                    activeOpacity={0.75}
                                                    disabled={savingStatusId === item.id}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.statusChipText,
                                                            active && styles.statusChipTextActive,
                                                        ]}
                                                    >
                                                        {STATUS_LABELS[code]}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    <TouchableOpacity
                                        style={styles.statusUpdateButton}
                                        onPress={() => submitStatusUpdate(item.id)}
                                        activeOpacity={0.8}
                                        disabled={savingStatusId === item.id}
                                    >
                                        <Text style={styles.statusUpdateButtonText}>
                                            {savingStatusId === item.id ? "···" : "업데이트"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                )}
            </View>
        ) : (
            <View key={item.id} style={styles.userRow}>
                {item.images.length > 0 && (
                    <View style={styles.userImageBubble}>
                        <Image
                            source={{ uri: item.images[0] }}
                            style={styles.messageImage}
                            resizeMode="cover"
                        />
                    </View>
                )}
                {!!item.text && (
                    <TouchableOpacity
                        style={styles.userBubble}
                        activeOpacity={0.85}
                        onLongPress={() => copyText(item.id, item.text)}
                    >
                        <Text style={styles.userText}>{item.text}</Text>
                    </TouchableOpacity>
                )}
                {copiedId === item.id && (
                    <View style={styles.copiedBadge}>
                        <Text style={styles.copiedBadgeText}>복사됨</Text>
                    </View>
                )}
            </View>
        );

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScreenHeader title={consultationTitle} onBack={() => navigation.goBack()} />

                {isLoadingHistory ? (
                    <ActivityIndicator style={styles.loadingIndicator} color={Colors.primary} />
                ) : (
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.chatArea}
                        contentContainerStyle={styles.chatContent}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() =>
                            scrollViewRef.current?.scrollToEnd({ animated: true })
                        }
                    >
                        <View style={styles.historyLabel}>
                            <View style={styles.historyLine} />
                            <Text style={styles.historyLabelText}>이전 상담 내역</Text>
                            <View style={styles.historyLine} />
                        </View>

                        {historyMessages.map(renderBubble)}

                        {newMessages.length > 0 && (
                            <View style={styles.continueDivider}>
                                <View style={styles.historyLine} />
                                <Text style={styles.continueDividerText}>이어서</Text>
                                <View style={styles.historyLine} />
                            </View>
                        )}

                        {newMessages.map(renderBubble)}
                    </ScrollView>
                )}

                <View style={styles.inputWrapper}>
                    <IconCircleButton
                        icon="add"
                        iconSize={22}
                        color={GreenTint.faint}
                        iconColor={Colors.primary}
                        activeOpacity={0.7}
                        onPress={pickImage}
                        style={styles.attachButton}
                    />

                    <View style={styles.inputBox}>
                        {pendingImage && (
                            <View style={styles.pendingImageRow}>
                                <Image
                                    source={{ uri: pendingImage }}
                                    style={styles.pendingImageThumb}
                                    resizeMode="cover"
                                />
                                <TouchableOpacity
                                    style={styles.removeImageButton}
                                    onPress={() => setPendingImage(null)}
                                >
                                    <Ionicons name="close-circle" size={18} color={Colors.textGray} />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TextInput
                            style={styles.input}
                            value={message}
                            onChangeText={setMessage}
                            placeholder="이어서 질문해 주세요"
                            placeholderTextColor={GreenTint.medium}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    <IconCircleButton
                        icon="arrow-up"
                        color={Colors.primary}
                        disabled={!canSend}
                        onPress={sendMessage}
                        style={styles.sendButton}
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    attachButton: {
        marginRight: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    sendButton: {
        marginBottom: Spacing.xs,
    },
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    chatArea: {
        flex: 1,
    },

    loadingIndicator: {
        flex: 1,
    },

    chatContent: {
        ...screenContent,
        paddingBottom: Spacing.lg,
        gap: Spacing.none,
    },

    historyLabel: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: Spacing.xl,
        gap: Spacing.sm,
    },

    historyLine: {
        flex: 1,
        height: 1,
        backgroundColor: GreenTint.mist,
    },

    historyLabelText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.medium,
        includeFontPadding: false,
    },

    continueDivider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: Spacing.xl,
        gap: Spacing.sm,
    },

    continueDividerText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.medium,
        includeFontPadding: false,
    },

    assistantRow: {
        marginBottom: Spacing.xl,
    },

    ragSection: {
        marginTop: Spacing.sm,
    },

    ragToggle: {
        alignSelf: "flex-start",
    },

    ragToggleText: {
        fontFamily: Fonts.neoDunggeunmo,
        // FontSizes.small(12)보다 아주 약간 큼 — 본문(FontSizes.body, 14)보다는 계속 작게 유지.
        fontSize: 13,
        color: Colors.textGray,
    },

    ragList: {
        marginTop: Spacing.xs,
        gap: Spacing.xs,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        backgroundColor: Colors.surfaceGrayTint,
    },

    ragRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.xs,
    },

    ragThumb: {
        width: 32,
        height: 32,
        borderRadius: Radius.sm,
    },

    ragItemText: {
        flex: 1,
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        lineHeight: 17,
        color: Colors.textGray,
    },

    statusCard: {
        marginTop: Spacing.md,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        backgroundColor: GreenTint.wash,
    },

    statusCardTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.deep,
        marginBottom: Spacing.sm,
    },

    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    statusOptions: {
        flexDirection: "row",
        gap: Spacing.xs,
    },

    statusChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        borderWidth: 1.5,
        borderColor: GreenTint.line,
        backgroundColor: Colors.white,
    },

    statusChipActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },

    statusChipText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.deep,
    },

    statusChipTextActive: {
        color: Colors.white,
    },

    statusUpdateButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        marginLeft: Spacing.sm,
    },

    statusUpdateButtonText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.white,
    },

    statusResultText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: GreenTint.deep,
    },

    copiedBadge: {
        marginTop: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Radius.pill,
        backgroundColor: GreenTint.strong,
    },

    copiedBadgeLeft: {
        alignSelf: "flex-start",
    },

    copiedBadgeText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        color: Colors.white,
    },

    userRow: {
        alignItems: "flex-end",
        marginBottom: Spacing.lg,
    },

    userImageBubble: {
        borderRadius: Radius.xl,
        borderTopRightRadius: Radius.xs,
        overflow: "hidden",
        marginBottom: Spacing.xs,
    },

    userBubble: {
        maxWidth: "75%",
        backgroundColor: GreenTint.strong,
        borderRadius: Radius.xl,
        borderTopRightRadius: Radius.xs,
        overflow: "hidden",
    },

    messageImage: {
        width: 200,
        height: 160,
    },

    userText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 20,
        color: Colors.white,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },

    inputWrapper: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Platform.OS === "ios" ? 16 : 12,
        backgroundColor: Colors.background,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: GreenTint.veil,
    },


    inputBox: {
        flex: 1,
        backgroundColor: Colors.white,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: GreenTint.haze,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        marginRight: Spacing.sm,
    },

    pendingImageRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: Spacing.sm,
    },

    pendingImageThumb: {
        width: 68,
        height: 68,
        borderRadius: Radius.md,
    },

    removeImageButton: {
        position: "absolute",
        top: -5,
        left: 56,
        backgroundColor: Colors.background,
        borderRadius: Radius.sm,
    },

    input: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: GreenTint.deep,
        minHeight: 20,
        maxHeight: 80,
        padding: Spacing.none,
        includeFontPadding: false,
    },


});