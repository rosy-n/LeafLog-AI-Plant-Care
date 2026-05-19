import React, { useState, useRef } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

const FONT = "NanumSquareNeo";

export default function ConsultationScreen({ navigation, route }) {
    const { consultation } = route.params;

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
    const scrollViewRef = useRef(null);

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

    const sendMessage = () => {
        const trimmed = message.trim();
        if (!trimmed && !pendingImage) return;

        const userMessage = {
            id: Date.now(),
            role: "user",
            text: trimmed,
            images: pendingImage ? [pendingImage] : [],
        };

        setNewMessages((prev) => [...prev, userMessage]);
        setMessage("");
        setPendingImage(null);

        // TODO: LLM API 호출로 교체
        setTimeout(() => {
            const aiMessage = {
                id: Date.now() + 1,
                role: "assistant",
                text: "아직 AI 상담 연결 전이에요. 추후 LLM 답변이 이 위치에 표시됩니다.",
                images: [],
            };
            setNewMessages((prev) => [...prev, aiMessage]);
        }, 500);
    };

    const canSend = !!(message.trim() || pendingImage);

    const renderBubble = (item) =>
        item.role === "assistant" ? (
            <View key={item.id} style={styles.assistantRow}>
                <View style={styles.assistantAvatar}>
                    <Text style={styles.assistantAvatarIcon}>🌿</Text>
                </View>
                <View style={styles.assistantContent}>
                    <Text style={styles.assistantText}>{item.text}</Text>
                </View>
            </View>
        ) : (
            <View key={item.id} style={styles.userRow}>
                <View style={styles.userBubble}>
                    {item.images.length > 0 && (
                        <Image
                            source={{ uri: item.images[0] }}
                            style={styles.messageImage}
                            resizeMode="cover"
                        />
                    )}
                    {!!item.text && (
                        <Text style={styles.userText}>{item.text}</Text>
                    )}
                </View>
            </View>
        );

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        activeOpacity={0.75}
                        style={styles.headerBackButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={28} color="#222222" />
                    </TouchableOpacity>
                    <Text style={styles.title} numberOfLines={1}>{consultation.title}</Text>
                    <View style={styles.headerSpacer} />
                </View>

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
                        <Ionicons name="add" size={22} color="#1F5D01" />
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
                                    <Ionicons name="close-circle" size={18} color="#555" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TextInput
                            style={styles.input}
                            value={message}
                            onChangeText={setMessage}
                            placeholder="이어서 질문해 주세요"
                            placeholderTextColor="#8A9A7A"
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
                        <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#FAFFF0",
    },

    container: {
        flex: 1,
        backgroundColor: "#FAFFF0",
    },

    header: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
    },

    headerBackButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },

    headerSpacer: {
        width: 40,
        height: 40,
    },

    title: {
        flex: 1,
        fontFamily: FONT,
        fontSize: 18,
        color: "#111111",
        includeFontPadding: false,
        textAlign: "center",
        marginHorizontal: 4,
    },

    chatArea: {
        flex: 1,
    },

    chatContent: {
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 16,
    },

    historyLabel: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
        gap: 8,
    },

    historyLine: {
        flex: 1,
        height: 1,
        backgroundColor: "rgba(31, 93, 1, 0.15)",
    },

    historyLabelText: {
        fontFamily: FONT,
        fontSize: 11,
        color: "#7A9A6A",
        includeFontPadding: false,
    },

    continueDivider: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 20,
        gap: 8,
    },

    continueDividerText: {
        fontFamily: FONT,
        fontSize: 11,
        color: "#7A9A6A",
        includeFontPadding: false,
    },

    assistantRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 20,
    },

    assistantAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#DFF0D4",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
        marginTop: 1,
    },

    assistantAvatarIcon: {
        fontSize: 14,
    },

    assistantContent: {
        flex: 1,
        paddingTop: 2,
    },

    assistantText: {
        fontFamily: FONT,
        fontSize: 13,
        lineHeight: 21,
        color: "#1A1A1A",
    },

    userRow: {
        alignItems: "flex-end",
        marginBottom: 16,
    },

    userBubble: {
        maxWidth: "75%",
        backgroundColor: "#1F5D01",
        borderRadius: 18,
        borderTopRightRadius: 4,
        overflow: "hidden",
    },

    messageImage: {
        width: 200,
        height: 160,
    },

    userText: {
        fontFamily: FONT,
        fontSize: 13,
        lineHeight: 20,
        color: "#FFFFFF",
        paddingVertical: 10,
        paddingHorizontal: 14,
    },

    inputWrapper: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: Platform.OS === "ios" ? 16 : 12,
        backgroundColor: "#FAFFF0",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(31, 93, 1, 0.18)",
    },

    attachButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#E4F3DB",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
        marginBottom: 3,
    },

    inputBox: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(31, 93, 1, 0.2)",
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 10,
        marginRight: 8,
    },

    pendingImageRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 8,
    },

    pendingImageThumb: {
        width: 68,
        height: 68,
        borderRadius: 10,
    },

    removeImageButton: {
        position: "absolute",
        top: -5,
        left: 56,
        backgroundColor: "#FAFFF0",
        borderRadius: 9,
    },

    input: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#2F4F20",
        minHeight: 20,
        maxHeight: 80,
        padding: 0,
        includeFontPadding: false,
    },

    sendButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#1F5D01",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 3,
    },

    sendButtonDisabled: {
        backgroundColor: "#B5CCA5",
    },
});