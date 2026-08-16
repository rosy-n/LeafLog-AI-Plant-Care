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
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { diagnosePlantPhoto, getPlant, updatePlant } from "../api";

// 상담 화면의 "식물 상태 업데이트" 카드 — 프로필 탭과 값은 같지만(CHECK 제약)
// 카드에서는 짧은 라벨을 쓴다.
const STATUS_ORDER = ["ALIVE", "SICK", "DEAD"];
const STATUS_LABELS = { ALIVE: "건강", SICK: "아픔", DEAD: "떠나보냄" };

// Qwen 답변이 오기까지 수초~수십초 걸리므로, "···" 하나만 보여주는 대신 처리 단계를
// 순서대로 보여준다 — 이미지 유무에 따라 실제로 거치는 파이프라인이 다르므로 문구도 다르다.
// 마지막 문구에서 멈춰 응답이 올 때까지 유지된다.
const LOADING_STEP_INTERVAL_MS = 2500;
const IMAGE_LOADING_STEPS = [
    "RAG에서 유사한 이미지를 검색하고 있어요",
    "RAG 검색결과를 토대로 Qwen에게 물어보고 있어요",
    "답변을 정리하고 있어요",
];
const buildTextOnlyLoadingSteps = (plantName) => [
    `${plantName}의 돌보기 데이터를 살펴보고 있어요`,
    `${plantName}의 과거 상담 기록을 살펴보고 있어요`,
    `${plantName}의 종합적인 데이터로 Qwen에게 물어보고 있어요`,
    "답변을 정리하고 있어요",
];

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

export default function ConsultStartScreen({ navigation, route }) {
    const plant = route?.params?.plant;
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([
        {
            id: 1,
            role: "assistant",
            text: "안녕하세요! 식물 상태가 걱정되시나요?\n궁금한 점을 편하게 물어봐 주세요.",
            images: [],
        },
    ]);
    const [pendingImage, setPendingImage] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [plantDetail, setPlantDetail] = useState(null);
    // 카드마다 독립적으로: 아직 저장하지 않은 선택값(태그만 누른 상태) / 저장 완료된 결과
    const [selectedStatus, setSelectedStatus] = useState({});
    const [statusUpdates, setStatusUpdates] = useState({});
    const [savingStatusId, setSavingStatusId] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const scrollViewRef = useRef(null);
    // 후속 질문에 새 사진이 없으면 직전에 보낸 사진을 재사용한다 — 사진이 한 번도 없었다면
    // 자연어만으로 상담(텍스트 전용 경로)한다.
    const lastImageRef = useRef(null);
    const copiedTimerRef = useRef(null);
    const loadingStepTimerRef = useRef(null);

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

    useEffect(() => () => clearTimeout(copiedTimerRef.current), []);
    useEffect(() => () => clearInterval(loadingStepTimerRef.current), []);

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

        setMessages((prev) => [...prev, userMessage]);
        setMessage("");
        setPendingImage(null);

        const hasImage = !!lastImageRef.current;
        const loadingSteps = hasImage ? IMAGE_LOADING_STEPS : buildTextOnlyLoadingSteps(plantName);

        const loadingId = Date.now() + 1;
        setIsSending(true);
        setMessages((prev) => [
            ...prev,
            { id: loadingId, role: "assistant", text: loadingSteps[0], images: [] },
        ]);

        let stepIndex = 0;
        loadingStepTimerRef.current = setInterval(() => {
            stepIndex += 1;
            if (stepIndex >= loadingSteps.length) {
                clearInterval(loadingStepTimerRef.current);
                return;
            }
            setMessages((prev) =>
                prev.map((item) =>
                    item.id === loadingId ? { ...item, text: loadingSteps[stepIndex] } : item
                )
            );
        }, LOADING_STEP_INTERVAL_MS);

        try {
            const result = await diagnosePlantPhoto(
                hasImage ? { uri: lastImageRef.current } : null,
                trimmed || undefined,
                plant?.id
            );
            setMessages((prev) =>
                prev.map((item) =>
                    item.id === loadingId
                        ? { ...item, text: result.diagnosis, isDiagnosis: true }
                        : item
                )
            );
        } catch (error) {
            const errorText = error instanceof Error ? error.message : "상담 답변을 받아오지 못했어요.";
            setMessages((prev) =>
                prev.map((item) => (item.id === loadingId ? { ...item, text: errorText } : item))
            );
        } finally {
            clearInterval(loadingStepTimerRef.current);
            setIsSending(false);
        }
    };

    const canSend = !!(message.trim() || pendingImage) && !isSending;

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScreenHeader title="식물 상담" onBack={() => navigation.goBack()} />

                <ScrollView
                    ref={scrollViewRef}
                    style={styles.chatArea}
                    contentContainerStyle={styles.chatContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() =>
                        scrollViewRef.current?.scrollToEnd({ animated: true })
                    }
                >
                    <View style={styles.guideBox}>
                        <Text style={styles.guideTitle}>촬영 가이드</Text>
                        <Text style={styles.guideText}>
                            식물의 잎, 줄기, 흙 상태가 잘 보이도록 촬영해 주세요.
                            {"\n"}증상부위를 가까이 찍으면 더 정확한 상담이 가능해요.
                        </Text>
                    </View>

                    {messages.map((item) =>
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
                                {item.isDiagnosis && plant?.id && (
                                    <View style={styles.statusCard}>
                                        {statusUpdates[item.id] ? (
                                            <Text style={styles.statusResultText}>
                                                {plantName}의 상태를 {STATUS_LABELS[statusUpdates[item.id].status]}
                                                {statusUpdates[item.id].kept ? "으로 유지했어요" : "으로 업데이트했어요"}
                                            </Text>
                                        ) : (
                                            <>
                                                <Text style={styles.statusCardTitle}>식물 상태 업데이트</Text>
                                                <View style={styles.statusRow}>
                                                    <View style={styles.statusOptions}>
                                                        {STATUS_ORDER.map((code) => {
                                                            const active =
                                                                (selectedStatus[item.id] ?? plantDetail?.status) ===
                                                                code;
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
                        )
                    )}
                </ScrollView>

                <View style={styles.inputWrapper}>
                    <TouchableOpacity
                        style={styles.attachButton}
                        onPress={pickImage}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add" size={22} color={Colors.primary} />
                    </TouchableOpacity>

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
                            placeholder="식물 상태를 입력해 주세요"
                            placeholderTextColor={GreenTint.medium}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            !canSend && styles.sendButtonDisabled,
                        ]}
                        onPress={sendMessage}
                        activeOpacity={0.8}
                        disabled={!canSend}
                    >
                        <Ionicons name="arrow-up" size={20} color={Colors.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    guideBox: {
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        borderRadius: Radius.lg,
        backgroundColor: GreenTint.wash,
        marginBottom: Spacing.xl,
    },

    guideTitle: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        color: Colors.primary,
        marginBottom: Spacing.sm,
    },

    guideText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.small,
        lineHeight: 17,
        color: GreenTint.deep,
    },

    chatArea: {
        flex: 1,
        marginTop: Spacing.md,
    },

    chatContent: {
        ...screenContent,
        paddingBottom: Spacing.lg,
        gap: Spacing.none,
    },

    assistantRow: {
        marginBottom: Spacing.xl,
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

    attachButton: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        backgroundColor: GreenTint.faint,
        alignItems: "center",
        justifyContent: "center",
        marginRight: Spacing.sm,
        marginBottom: Spacing.xs,
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

    sendButton: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: Spacing.xs,
    },

    sendButtonDisabled: {
        backgroundColor: GreenTint.line,
    },
});
