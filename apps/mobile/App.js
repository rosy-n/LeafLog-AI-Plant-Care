import React, { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useFonts } from "expo-font";
import { Fonts } from "./constants/fonts";
import { Asset } from "expo-asset";
import { NavigationContainer } from "@react-navigation/native";
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
import SettingsScreen from "./src/screens/SettingsScreen";
import StoreScreen from "./src/screens/StoreScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import CalendarScreen from "./src/screens/CalendarScreen";
import MemorialPlantScreen from "./src/screens/MemorialPlantScreen";
import AddPlantNavigator from "./src/screens/AddPlantNavigator";
import { getPlants } from "./src/api";

const Stack = createNativeStackNavigator();

// 아직 미구현인 값의 임시 표시 — 나중에 실제 기능 연결 시 교체
const PLACEHOLDER_HEARTS = 5; // 호감도: care_record 기능 연결 전 임시 고정

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
        hearts: PLACEHOLDER_HEARTS,
        memorial: plant.status === "DEAD",
        commonNameKo: plant.common_name_ko,
        createdAt: plant.created_at,
    };
}

const imageAssets = [
    require("./assets/images/home-bg.png"),
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

export default function MainApp({ user }) {
    const [plants, setPlants] = useState([]);
    const [appliedItem, setAppliedItem] = useState(null);
    const [username, setUsername] = useState(user?.nickname ?? "식물집사");
    const [imagesLoaded, setImagesLoaded] = useState(false);
    const [coins, setCoins] = useState(450);
    const [purchasedBgs, setPurchasedBgs] = useState([]);
    const [appliedBg, setAppliedBg] = useState("home-bg");
    const [notifications, setNotifications] = useState([
        {
            id: "1",
            plantKey: "spaghetti",
            title: "스파게티 물 주는 날",
            speech: "너무 목 말라요..💧",
            time: "오전 9:00",
            read: false,
            isToday: true,
        },
        {
            id: "2",
            plantKey: "rubber",
            title: "미세먼지 좋음",
            speech: "신선한 바람을 쐬고 싶어요 🌿",
            time: "오전 8:30",
            read: false,
            isToday: true,
        },
        {
            id: "3",
            plantKey: "sansevieria",
            title: "산세베리아 분갈이 시기",
            speech: "슬슬 새 집이 필요해요!",
            time: "어제",
            read: true,
            isToday: false,
        },
        {
            id: "4",
            plantKey: "pachira",
            title: "파키라 건강 이상",
            speech: "잎이 노랗게 변하고 있어요 🍂",
            time: "2일 전",
            read: true,
            isToday: false,
        },
    ]);

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
        <NavigationContainer>
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
                            hasUnread={notifications.some((n) => !n.read)}
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
                    name="Settings"
                    options={{ headerShown: false }}
                >
                    {(props) => (
                        <SettingsScreen
                            {...props}
                            username={username}
                            setUsername={setUsername}
                        />
                    )}
                </Stack.Screen>
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
                            notifications={notifications}
                            setNotifications={setNotifications}
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