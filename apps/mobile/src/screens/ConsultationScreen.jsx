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
    const { consultation, plant } = route.params;

    const messagesByConsultation = {
        1: [
            {
                id: "h1",
                role: "assistant",
                text: "안녕하세요! 식물 상태가 걱정되시나요?\n증상을 자세히 알려주시면 원인을 함께 찾아볼게요.",
                images: [],
            },
            {
                id: "h2",
                role: "user",
                text: "잎 끝이 갈색으로 변해있어. 왜 그런거야?",
                images: [],
            },
            {
                id: "h3",
                role: "assistant",
                text: "주요 원인을 하나씩 확인해볼게요.\n\n• 수분 부족 — 흙이 너무 건조하면 잎 끝부터 말라요. 손가락으로 흙 2~3cm를 눌러보고 건조하면 충분히 물을 주세요.\n\n• 낮은 공중 습도 — 실내 난방이나 에어컨으로 공기가 건조할 때 자주 나타나요. 분무기로 잎에 물을 뿌리거나 가습기를 활용해보세요.\n\n• 수돗물의 염소·불소 — 민감한 식물은 수돗물에 반응할 수 있어요. 물을 하루 이상 받아뒀다 주거나 정수한 물을 사용해보세요.\n\n• 비료 과다 — 뿌리 주변 염류 농도가 높으면 잎 끝이 타들어가요. 최근 비료를 자주 줬다면 한동안 중단하고 물로 흙을 씻어내보세요.\n\n현재 물 주는 주기와 실내 환경을 알려주시면 더 정확히 확인해드릴게요!",
                images: [],
            },
        ],
        2: [
            {
                id: "h1",
                role: "assistant",
                text: "안녕하세요! 식물 상태가 걱정되시나요?\n증상을 자세히 알려주시면 원인을 함께 찾아볼게요.",
                images: [],
            },
            {
                id: "h2",
                role: "user",
                text: "잎에 흰 줄무늬 같은 상처가 생겼어. 왜 그런거야?",
                images: [],
            },
            {
                id: "h3",
                role: "assistant",
                text: "총채벌레에 의한 피해일 가능성이 높아요.\n\n총채벌레는 잎 표면을 갉아먹으면서 흰 줄이나 은색 반점, 상처 자국을 남겨요. 잎 뒷면을 자세히 보면 아주 작은 벌레가 보이기도 해요.\n\n대처 방법을 알려드릴게요.\n\n• 즉시 격리 — 다른 식물에 전파되지 않도록 감염된 식물을 먼저 분리해주세요.\n\n• 살충제 처리 — 총채벌레 전용 살충제 또는 님 오일을 잎 앞뒷면에 고루 뿌려주세요. 3~5일 간격으로 2~3회 반복하는 것이 효과적이에요.\n\n• 황색 끈끈이 트랩 — 총채벌레는 황색에 유인되므로 트랩을 설치하면 개체 수를 줄이는 데 도움이 돼요.\n\n• 피해 잎 제거 — 심하게 손상된 잎은 제거해 추가 확산을 막아주세요.\n\n방제 후에도 새 잎이 계속 손상된다면 알이 남아 있을 수 있으니 살충을 반복해서 진행해야 해요.",
                images: [],
            },
        ],
        3: [
            {
                id: "h1",
                role: "assistant",
                text: "안녕하세요! 식물 상태가 걱정되시나요?\n증상을 자세히 알려주시면 원인을 함께 찾아볼게요.",
                images: [],
            },
            {
                id: "h2",
                role: "user",
                text: "흙 표면에 하얀 솜 같은 게 생겼어. 곰팡이인가?",
                images: [],
            },
            {
                id: "h3",
                role: "assistant",
                text: "네, 흙 표면에 생기는 하얀 솜 형태는 대부분 곰팡이균이에요. 식물에 직접 해를 끼치는 경우는 드물지만, 환경이 맞지 않다는 신호예요.\n\n주요 원인과 대처법을 알려드릴게요.\n\n• 통풍 부족 — 밀폐된 공간이나 바람이 없는 환경에서 잘 발생해요. 창문을 자주 열거나 선풍기로 공기를 순환시켜 주세요.\n\n• 과습한 흙 — 물을 너무 자주 주거나 배수가 잘 안 되면 흙이 계속 축축해져 곰팡이가 번식해요. 흙이 충분히 마른 후에 물을 주는 습관이 중요해요.\n\n• 유기물이 많은 흙 — 부엽토 등 유기물이 풍부한 흙은 곰팡이의 먹이가 되기 쉬워요.\n\n곰팡이가 핀 흙 표면 1~2cm를 걷어내고 버린 후, 계핏가루나 숯을 얇게 뿌리면 재발 방지에 도움이 돼요. 물 주는 횟수를 줄이고 환기를 자주 시켜주시면 금방 나아질 거예요!",
                images: [],
            },
        ],
    };

    const historyMessages = messagesByConsultation[consultation.id] ?? [];

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
    const scrollViewRef = useRef(null);
    // 진단은 매 요청마다 이미지가 필요하다 — 후속 질문에 새 사진이 없으면 직전에 보낸 사진을 재사용한다.
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
            const result = await diagnosePlantPhoto({ uri: lastImageRef.current }, trimmed || undefined, plant?.id);
            setNewMessages((prev) =>
                prev.map((item) =>
                    item.id === loadingId
                        ? { ...item, text: result.diagnosis, isDiagnosis: true }
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
                <ScreenHeader title={consultation.title} onBack={() => navigation.goBack()} />

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
                            placeholder="이어서 질문해 주세요"
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

    chatArea: {
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