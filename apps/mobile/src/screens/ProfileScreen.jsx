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

import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors } from "../../constants/colors";
import ScreenHeader from "../components/ScreenHeader";

export default function ProfileScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

            <View style={styles.container}>
                {/* 상단 제목 / 편집 버튼 */}
                <ScreenHeader
                    title="프로필"
                    onBack={() => navigation.goBack()}
                    right={
                        <TouchableOpacity
                            activeOpacity={0.75}
                            style={styles.editButton}
                            onPress={() => {
                                // 편집 화면 연결 전이면 임시로 주석 처리해도 됩니다.
                                // navigation.navigate("ProfileEdit");
                            }}
                        >
                            <Ionicons name="pencil-outline" size={28} color={Colors.textBlack} />
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
            </View>
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
        marginTop: 0,
    },

    editUnderline: {
        width: 14,
        height: 3,
        borderRadius: 2,
        backgroundColor: Colors.textBlack,
        marginTop: -6,
        marginLeft: 20,
    },

    profileRow: {
        marginTop: 38,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: 20,
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
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        color: Colors.textBlack,
        includeFontPadding: false,
        textAlign: "center",
    },

    infoArea: {
        width: SCREEN_WIDTH * 0.46,
        paddingTop: 8,
        paddingLeft: 16,
    },

    infoText: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.bodyLarge,
        lineHeight: 30,
        color: Colors.textBlack,
        includeFontPadding: false,
    },

    memoryButton: {
        position: "absolute",
        top: SCREEN_HEIGHT * 0.45,
        alignSelf: "center",
        width: SCREEN_WIDTH * 0.62,
        height: 46,
        borderRadius: 20,
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