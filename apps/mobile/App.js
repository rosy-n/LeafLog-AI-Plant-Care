import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, AppState } from "react-native";
import { useFonts } from "expo-font";
import { Fonts } from "./constants/fonts";
import { Asset } from "expo-asset";
import { NavigationContainer } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./src/screens/HomeScreen";
import GardenScreen from "./src/screens/GardenScreen";
import PlantDetailScreen from "./src/screens/PlantDetailScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CareInfoScreen from "./src/screens/CareInfoScreen";
import ConsultationHistoryScreen from "./src/screens/ConsultationHistoryScreen"
import ConsultationScreen from "./src/screens/ConsultationScreen";
import ConsultationStartScreen from "./src/screens/ConsultationStartScreen"
import PlantDecorateScreen from "./src/screens/PlantDecorateScreen";
import SensorDataScreen from "./src/screens/SensorDataScreen";
import RepottingScreen from "./src/screens/RepottingScreen";
import NutrientScreen from "./src/screens/NutrientScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import LocationSettingScreen from "./src/screens/LocationSettingScreen";
import StoreScreen from "./src/screens/StoreScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import CalendarScreen from "./src/screens/CalendarScreen";
import MemorialPlantScreen from "./src/screens/MemorialPlantScreen";
import AddPlantNavigator from "./src/screens/AddPlantNavigator";
import { getPlants } from "./src/api";
import { syncWateringReminders } from "./src/notifications";
import { buildCareNotices } from "./src/careNotices";

const Stack = createNativeStackNavigator();

// 알림 재동기화 최소 간격 — 포그라운드 복귀가 잦아도 개체별 조회가 반복되지 않게
const SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

// DB 식물 → 정원 UI 형태로 변환
function toGardenPlant(plant) {
    return {
        id: String(plant.id),
        name: plant.nickname,
        favorite: plant.is_favorite,
        // 캐릭터 이미지: S3 URL이 있으면 원격 사용, 없으면 번들 fallback
        // (FLUX 미구현 fallback. "3호"는 URL 없을 때 test 번들 이미지로 표시 — 테스트용)
        imageUri: plant.character_image_url ?? null,
        imageKey: plant.nickname === "3호" ? "test" : undefined,
        // 애정도 — 서버가 돌봄 기록(물주기/영양제/분갈이)에서 계산해 목록에 함께 보낸다.
        // hearts 는 0~5(0.5 단위), affinityLevel = 꽉 찬 하트 수 = 꾸미기 아이템 해금 단계
        hearts: plant.affinity_hearts ?? 0,
        affinityScore: plant.affinity_score ?? 0,
        affinityLevel: plant.affinity_level ?? 0,
        memorial: plant.status === "DEAD",
        commonNameKo: plant.common_name_ko,
        persona: plant.persona,
        createdAt: plant.created_at,
        // 돌봄 알림 목록·배지 계산용 (목록 응답에 함께 실려 온다)
        wateringIntervalDays: plant.watering_interval_days,
        nextWateringDate: plant.next_watering_date,
        daysUntilWatering: plant.days_until_watering,
    };
}

const imageAssets = [
    require("./assets/images/home_clear_bg.png"),
    require("./assets/images/store_bg1.png"),
    require("./assets/images/store_bg2.png"),
    require("./assets/images/detail-bg.png"),

    require("./assets/plants/spaghetti.png"),
    require("./assets/plants/rubber.png"),
    require("./assets/plants/sansevieria.png"),
    require("./assets/plants/pachira.png"),
    require("./assets/plants/myeongrani.png"),
    require("./assets/plants/test.png"),

    require("./assets/items/level1_item.png"),
    require("./assets/items/level1_plants.png"),
    require("./assets/items/level2_item.png"),
    require("./assets/items/level2_plants.png"),
    require("./assets/items/level3_item.png"),
    require("./assets/items/level3_plants.png"),
    require("./assets/items/level4_item.png"),
    require("./assets/items/level4_plants.png"),
    require("./assets/items/level5_item.png"),
    require("./assets/items/level5_plants.png"),
];

async function preloadImages() {
    const cacheImages = imageAssets.map((image) => {
        return Asset.fromModule(image).downloadAsync();
    });

    await Promise.all(cacheImages);
}

// onLogout — 인증 상태는 App.tsx 가 들고 있어서 여기서는 콜백을 받아 설정 화면까지 내려준다
export default function MainApp({ user, onLogout }) {
    const [plants, setPlants] = useState([]);
    const [appliedItem, setAppliedItem] = useState(null);
    const [username, setUsername] = useState(user?.nickname ?? "식물집사");
    const [imagesLoaded, setImagesLoaded] = useState(false);
    const [coins, setCoins] = useState(450);
    const [purchasedBgs, setPurchasedBgs] = useState([]);
    const [appliedBg, setAppliedBg] = useState("home-bg");
    // 돌봄 알림 목록 — 더미 배열 대신 개체 일정에서 계산한다
    const notices = useMemo(() => buildCareNotices(plants), [plants]);

    // 알림 탭 처리에 필요 — 리스너는 한 번만 등록하므로 최신 값을 ref 로 참조한다
    const navigationRef = useRef(null);
    const plantsRef = useRef(plants);
    useEffect(() => {
        plantsRef.current = plants;
    }, [plants]);

    const [fontsLoaded] = useFonts({
        [Fonts.neoDunggeunmo]: require("./assets/fonts/NeoDunggeunmoPro-Regular.ttf"),
        [Fonts.nanumSquareNeo.light]: require("./assets/fonts/NanumSquareNeo-aLt.ttf"),
        [Fonts.nanumSquareNeo.regular]: require("./assets/fonts/NanumSquareNeo-bRg.ttf"),
        [Fonts.nanumSquareNeo.bold]: require("./assets/fonts/NanumSquareNeo-cBd.ttf"),
        [Fonts.nanumSquareNeo.extraBold]: require("./assets/fonts/NanumSquareNeo-dEb.ttf"),
        [Fonts.nanumSquareNeo.heavy]: require("./assets/fonts/NanumSquareNeo-eHv.ttf"),
    });

    // DB에서 현재 사용자의 식물 목록 로드 (정원 진입 시 갱신도 이 함수 재사용)
    const loadPlants = useCallback(() => {
        getPlants()
            .then((rows) => setPlants(rows.map(toGardenPlant)))
            .catch((error) => console.warn("식물 목록 로드 실패:", error?.message));
    }, []);

    useEffect(() => {
        loadPlants();
    }, [loadPlants]);

    // 물주기 알림을 현재 일정에 맞춰 다시 맞춘다.
    // 다른 기기에서 물을 줬거나 주기를 바꿨으면 기기에 남은 예약이 어긋나기 때문.
    //
    // 앱 시작 때 한 번만 하면 며칠씩 켜둔 경우 그동안의 변경이 반영되지 않아,
    // 포그라운드로 돌아올 때도 다시 맞춘다. 개체마다 일정을 조회하므로
    // 최소 간격을 둬서 화면 전환마다 반복 호출되지 않게 한다.
    useEffect(() => {
        let lastSyncAt = 0;
        const resync = () => {
            const now = Date.now();
            if (now - lastSyncAt < SYNC_MIN_INTERVAL_MS) return;
            lastSyncAt = now;
            syncWateringReminders().catch((error) =>
                console.warn("물주기 알림 동기화 실패:", error?.message),
            );
        };

        resync();
        const sub = AppState.addEventListener("change", (state) => {
            if (state === "active") resync();
        });
        return () => sub.remove();
    }, []);

    // 알림을 누르면 해당 개체 화면으로 이동
    useEffect(() => {
        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
            const plantId = response.notification.request.content.data?.plantId;
            if (!plantId) return;
            const target = plantsRef.current.find((p) => p.id === String(plantId));
            if (target) navigationRef.current?.navigate("PlantDetail", { plant: target });
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        let mounted = true;

        preloadImages()
            .then(() => {
                if (mounted) {
                    setImagesLoaded(true);
                }
            })
            .catch((error) => {
                console.warn("Image preload failed:", error);
                if (mounted) {
                    setImagesLoaded(true);
                }
            });

        return () => {
            mounted = false;
        };
    }, []);

    if (!fontsLoaded || !imagesLoaded) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: "#8FCB7D",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ActivityIndicator size="large" color="#2F7831" />
            </View>
        );
    }

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
                id="MainStack"
                initialRouteName="Home"
                screenOptions={{
                    headerShown: false,
                    animation: "none",
                }}
            >
                <Stack.Screen name="Home">
                    {(props) => (
                        <HomeScreen
                            {...props}
                            appliedBg={appliedBg}
                            hasUnread={notices.some((n) => n.urgent)}
                            urgentCount={notices.filter((n) => n.urgent).length}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen
                    name="Garden"
                    options={{
                        presentation: "transparentModal",
                        animation: "none",
                        gestureEnabled: false,
                        contentStyle: {
                            backgroundColor: "transparent",
                        },
                    }}
                >
                    {(props) => (
                        <GardenScreen
                            {...props}
                            plants={plants}
                            setPlants={setPlants}
                            username={username}
                            reloadPlants={loadPlants}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen
                    name="PlantDetail"
                    options={{
                        presentation: "card",
                        animation: "none",
                        gestureEnabled: false,
                    }}
                >
                    {(props) => (
                        <PlantDetailScreen {...props} appliedItem={appliedItem} />
                    )}
                </Stack.Screen>

                <Stack.Screen
                    name="AddPlant"
                    component={AddPlantNavigator}
                    options={{ headerShown: false, animation: "slide_from_bottom" }}
                />

                <Stack.Screen
                    name="Profile"
                    component={ProfileScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="CareInfo"
                    component={CareInfoScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="ConsultationHistory"
                    component={ConsultationHistoryScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="ConsultationStart"
                    component={ConsultationStartScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="Consultation"
                    component={ConsultationScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="SensorData"
                    component={SensorDataScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="Repotting"
                    component={RepottingScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="Nutrient"
                    component={NutrientScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="Settings"
                    options={{ headerShown: false }}
                >
                    {(props) => (
                        <SettingsScreen
                            {...props}
                            username={username}
                            setUsername={setUsername}
                            onLogout={onLogout}
                        />
                    )}
                </Stack.Screen>
                <Stack.Screen
                    name="LocationSetting"
                    component={LocationSettingScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="PlantDecorate"
                    options={{ headerShown: false }}
                >
                    {(props) => (
                        <PlantDecorateScreen
                            {...props}
                            appliedItem={appliedItem}
                            setAppliedItem={setAppliedItem}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen
                    name="Notifications"
                    options={{ headerShown: false }}
                >
                    {(props) => (
                        <NotificationsScreen
                            {...props}
                            notices={notices}
                            plants={plants}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen
                    name="Calendar"
                    options={{ headerShown: false }}
                >
                    {(props) => <CalendarScreen {...props} />}
                </Stack.Screen>

                <Stack.Screen
                    name="MemorialPlant"
                    options={{
                        presentation: "card",
                        animation: "none",
                        gestureEnabled: false,
                    }}
                >
                    {(props) => (
                        <MemorialPlantScreen {...props} appliedItem={appliedItem} />
                    )}
                </Stack.Screen>

                <Stack.Screen
                    name="Store"
                    options={{ headerShown: false }}
                >
                    {(props) => (
                        <StoreScreen
                            {...props}
                            coins={coins}
                            setCoins={setCoins}
                            purchasedBgs={purchasedBgs}
                            setPurchasedBgs={setPurchasedBgs}
                            appliedBg={appliedBg}
                            setAppliedBg={setAppliedBg}
                        />
                    )}
                </Stack.Screen>

            </Stack.Navigator>
        </NavigationContainer>
    );
}