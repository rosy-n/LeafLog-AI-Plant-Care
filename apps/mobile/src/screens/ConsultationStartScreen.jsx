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

import { Fonts, FontSizes } from "../../constants/fonts";
import ScreenHeader from "../components/ScreenHeader";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";

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
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScreenHeader title="식물 상담" onBack={() => navigation.goBack()} />

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
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.xs,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        borderRadius: Radius.lg,
        backgroundColor: GreenTint.wash,
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
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: Spacing.xl,
    },

    assistantAvatar: {
        width: 28,
        height: 28,
        borderRadius: Radius.lg,
        backgroundColor: GreenTint.faint,
        alignItems: "center",
        justifyContent: "center",
        marginRight: Spacing.md,
        marginTop: Spacing.xxs,
    },

    assistantAvatarIcon: {
        fontSize: FontSizes.body,
    },

    assistantContent: {
        flex: 1,
        paddingTop: Spacing.xxs,
    },

    assistantText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.body,
        lineHeight: 21,
        color: Colors.textBlack,
    },

    userRow: {
        alignItems: "flex-end",
        marginBottom: Spacing.lg,
    },

    userBubble: {
        maxWidth: "75%",
        backgroundColor: Colors.primary,
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
