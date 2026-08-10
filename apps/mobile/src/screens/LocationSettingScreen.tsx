import React, { useCallback, useState } from "react";
import {
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import ScreenHeader from "../components/ScreenHeader";
import AppButton from "../components/AppButton";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Colors, GreenTint } from "../../constants/colors";
import { Spacing, Radius } from "../../constants/spacing";
import { screenContent } from "../../constants/layout";
import { getUserSettings, updateUserLocation } from "../api";

export default function LocationSettingScreen({ navigation }: { navigation: any }) {
    const [currentLocation, setCurrentLocation] = useState<string | null>(null);
    const [isRequesting, setIsRequesting] = useState(false);
    const [error, setError] = useState<string | undefined>();

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            getUserSettings()
                .then((result) => {
                    if (!cancelled) setCurrentLocation(result.default_location);
                })
                .catch(() => {});
            return () => {
                cancelled = true;
            };
        }, [])
    );

    async function handleUseCurrentLocation() {
        setError(undefined);
        setIsRequesting(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                setError("위치 권한이 필요해요. 기기 설정에서 위치 권한을 허용해주세요.");
                return;
            }
            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const result = await updateUserLocation(
                position.coords.latitude,
                position.coords.longitude
            );
            setCurrentLocation(result.default_location);
            Alert.alert(
                "위치 변경 완료",
                `우리 집 위치가 "${result.default_location}"(으)로 저장됐어요.`,
                [{ text: "확인", onPress: () => navigation.goBack() }]
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "위치를 가져오지 못했어요. 다시 시도해주세요."
            );
        } finally {
            setIsRequesting(false);
        }
    }

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
            <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
                <ScreenHeader title="위치 변경" onBack={() => navigation.goBack()} />

                <View style={styles.content}>
                    <View style={styles.currentBox}>
                        <Text style={styles.currentLabel}>현재 우리 집 위치</Text>
                        <Text style={styles.currentValue}>
                            {currentLocation ?? "설정 안 됨"}
                        </Text>
                    </View>

                    <View style={styles.noticeBox}>
                        <Ionicons name="home-outline" size={18} color={GreenTint.strong} />
                        <Text style={styles.noticeText}>
                            반드시 집에서 설정해주세요.{"\n"}
                            집이 아닌 곳에서 설정하면 그 위치가{"\n"}
                            우리 집으로 저장돼요.
                        </Text>
                    </View>

                    {error && <Text style={styles.errorText}>{error}</Text>}

                    <AppButton
                        label={isRequesting ? "위치 확인 중..." : "현재 위치로 설정하기"}
                        onPress={handleUseCurrentLocation}
                        loading={isRequesting}
                        style={styles.button}
                    />
                </View>
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
    content: {
        ...screenContent,
        gap: Spacing.lg,
    },
    currentBox: {
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: GreenTint.soft,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
    },
    currentLabel: {
        fontFamily: Fonts.nanumSquareNeo.regular,
        fontSize: FontSizes.small,
        color: Colors.textFaint,
        includeFontPadding: false,
        marginBottom: Spacing.xs,
    },
    currentValue: {
        fontFamily: Fonts.neoDunggeunmo,
        fontSize: FontSizes.subtitle,
        color: GreenTint.deep,
        includeFontPadding: false,
    },
    noticeBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: Spacing.sm,
        backgroundColor: GreenTint.faint,
        borderRadius: Radius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    noticeText: {
        flex: 1,
        fontFamily: Fonts.nanumSquareNeo.regular,
        fontSize: FontSizes.body,
        color: GreenTint.strong,
        lineHeight: 20,
    },
    errorText: {
        fontFamily: Fonts.nanumSquareNeo.regular,
        fontSize: FontSizes.small,
        color: Colors.danger,
    },
    button: {
        marginTop: Spacing.md,
    },
});
