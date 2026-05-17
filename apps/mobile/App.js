import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useFonts } from "expo-font";
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
import { gardenPlants } from "./src/data/plants";

const Stack = createNativeStackNavigator();

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

export default function App() {
    const [plants, setPlants] = useState(gardenPlants);
    const [appliedItem, setAppliedItem] = useState(null);
    const [username, setUsername] = useState("식물집사");
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
        NeoDunggeunmo: require("./assets/fonts/NeoDunggeunmoPro-Regular.ttf"),
        NanumSquareNeo: require("./assets/fonts/NanumSquareNeo-cBd.ttf"),
    });

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