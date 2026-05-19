import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const FONT = "NeoDunggeunmoPro-Regular";

export default function ProfileScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAFFF0" />

            <View style={styles.container}>
                {/* 상단 제목 / 편집 버튼 */}
                <View style={styles.header}>
                    <View style={styles.headerSpacer} />

                    <Text style={styles.title}>프로필</Text>

                    <TouchableOpacity
                        activeOpacity={0.75}
                        style={styles.editButton}
                        onPress={() => {
                            // 편집 화면 연결 전이면 임시로 주석 처리해도 됩니다.
                            // navigation.navigate("ProfileEdit");
                        }}
                    >
                        <Ionicons name="pencil-outline" size={28} color="#222222" />
                        <View style={styles.editUnderline} />
                    </TouchableOpacity>
                </View>

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

                        <Text style={styles.daysText}>함께한 지 32일 째</Text>
                    </View>

                    <View style={styles.infoArea}>
                        <Text style={styles.infoText}>이름: 스파게티</Text>
                        <Text style={styles.infoText}>상태: 건강함</Text>
                        <Text style={styles.infoText}>키: 10cm</Text>
                        <Text style={styles.infoText}>위치: 베란다 창가</Text>
                        <Text style={styles.infoText}>화분 종류: 플라스틱</Text>
                        <Text style={styles.infoText}>화분 크기: 18cm</Text>
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

                {/* 좌측 하단 X 버튼 */}
                <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.closeButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="close" size={36} color="#555555" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const CARD_WIDTH = SCREEN_WIDTH * 0.43;
const CARD_HEIGHT = CARD_WIDTH * 1.2;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#FAFFF0",
    },

    container: {
        flex: 1,
        backgroundColor: "#FAFFF0",
        paddingHorizontal: 24,
    },

    header: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    headerSpacer: {
        width: 44,
    },

    title: {
        fontFamily: FONT,
        fontSize: 27,
        color: "#111111",
        includeFontPadding: false,
        marginTop: 0,
    },

    editButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 0,
    },

    editUnderline: {
        width: 14,
        height: 3,
        borderRadius: 2,
        backgroundColor: "#222222",
        marginTop: -6,
        marginLeft: 20,
    },

    profileRow: {
        marginTop: 38,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        width: "100%",
    },

    leftArea: {
        width: CARD_WIDTH,
        alignItems: "center",
    },

    plantCard: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 28,
        backgroundColor: "#FBE9C2",
        borderWidth: 3,
        borderColor: "#4B2D18",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },

    plantImage: {
        width: CARD_WIDTH * 1.0,
        height: CARD_HEIGHT * 1.3,
    },

    daysText: {
        marginTop: 16,
        fontFamily: FONT,
        fontSize: 16,
        color: "#111111",
        includeFontPadding: false,
        textAlign: "center",
    },

    infoArea: {
        width: SCREEN_WIDTH * 0.46,
        paddingTop: 8,
        paddingLeft: 16,
    },

    infoText: {
        fontFamily: FONT,
        fontSize: 15,
        lineHeight: 30,
        color: "#111111",
        includeFontPadding: false,
    },

    memoryButton: {
        position: "absolute",
        top: SCREEN_HEIGHT * 0.45,
        alignSelf: "center",
        width: SCREEN_WIDTH * 0.62,
        height: 46,
        borderRadius: 20,
        backgroundColor: "#1F5D01",
        alignItems: "center",
        justifyContent: "center",
    },

    memoryButtonText: {
        fontFamily: FONT,
        fontSize: 15,
        color: "#FFFFFF",
        includeFontPadding: false,
    },

    closeButton: {
        position: "absolute",
        left: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 35,
        backgroundColor: "rgba(255, 255, 255, 0.85)",
        alignItems: "center",
        justifyContent: "center",

        shadowColor: "#000000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.13,
        shadowRadius: 13,
        elevation: 8,
    },
});