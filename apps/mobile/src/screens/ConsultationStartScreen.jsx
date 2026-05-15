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

export default function ConsultStartScreen({ navigation }) {
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

        setMessages((prev) => [...prev, userMessage]);
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
            setMessages((prev) => [...prev, aiMessage]);
        }, 500);
    };

    const canSend = !!(message.trim() || pendingImage);

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
                    <Text style={styles.title}>식물 상담</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.guideBox}>
                    <Text style={styles.guideTitle}>촬영 가이드</Text>
                    <Text style={styles.guideText}>
                        식물의 잎, 줄기, 흙 상태가 잘 보이도록 촬영해 주세요.
                        {"\n"}증상이 있는 부분을 가까이 찍으면 더 정확한 상담이 가능해요.
                    </Text>
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
                    {messages.map((item) =>
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
                        )
                    )}
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
                            placeholder="식물 상태를 입력해 주세요"
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

    title: {
        fontFamily: FONT,
        fontSize: 20,
        color: "#111111",
        includeFontPadding: false,
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

    guideBox: {
        marginHorizontal: 14,
        marginTop: 4,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: "rgba(31, 93, 1, 0.1)",
    },

    guideTitle: {
        fontFamily: FONT,
        fontSize: 13,
        color: "#1F5D01",
        marginBottom: 6,
    },

    guideText: {
        fontFamily: FONT,
        fontSize: 11,
        lineHeight: 17,
        color: "#2F4F20",
    },

    chatArea: {
        flex: 1,
        marginTop: 12,
    },

    chatContent: {
        paddingHorizontal: 14,
        paddingTop: 4,
        paddingBottom: 16,
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
