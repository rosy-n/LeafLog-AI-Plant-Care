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
import { gardenPlants } from "./src/data/plants";

const Stack = createNativeStackNavigator();

const imageAssets = [
    require("./assets/images/home-bg.png"),
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
    const [imagesLoaded, setImagesLoaded] = useState(false);

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
                <Stack.Screen name="Home" component={HomeScreen} />

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

            </Stack.Navigator>
        </NavigationContainer>
    );
}