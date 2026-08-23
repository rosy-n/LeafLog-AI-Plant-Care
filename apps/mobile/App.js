import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, AppState, Image } from "react-native";
import { useFonts } from "expo-font";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Fonts } from "./constants/fonts";
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
import NotificationsScreen from "./src/screens/NotificationsScreen";
import CalendarScreen from "./src/screens/CalendarScreen";
import MemorialPlantScreen from "./src/screens/MemorialPlantScreen";
import AddPlantNavigator from "./src/screens/AddPlantNavigator";
import { getItems, getPlants } from "./src/api";
import { DEFAULT_BACKGROUND_KEY } from "./src/data/decor";
import { syncWateringReminders } from "./src/notifications";
import { buildCareNotices } from "./src/careNotices";
import { preloadBundledImages } from "./src/data/assets";
import { BackgroundMusicProvider } from "./src/backgroundMusic";

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
        characterFaceRemoved: plant.character_face_removed ?? false,
        characterFaceBounds: plant.character_face_bounds ?? null,
        status: plant.status,
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

// 번들 이미지 목록과 preload 는 src/data/assets.js 가 단일 출처 (아이콘까지 포함)

// onLogout — 인증 상태는 App.tsx 가 들고 있어서 여기서는 콜백을 받아 설정 화면까지 내려준다
function MainAppContent({ user, onLogout }) {
    const [plants, setPlants] = useState([]);
    /*
        개체별 꾸미기 —
        { [plantId]: { accessory: { key, spriteUrl } | null, background: { key, url } } }

        액세서리도 배경도 개체 단위이고 그 개체의 애정도로 해금된다(홈 배경은 고정).
        서버(plant_decoration)가 원본이고 목록 응답에 실려 온다. 화면들이 route 로 받은
        식물 스냅샷 대신 이 맵을 보게 해서, 꾸미고 돌아왔을 때 옛 값이 남지 않게 한다.
        url 이 없으면(아직 S3에 이미지가 없으면) key 로 번들 이미지를 쓴다.
    */
    const [decorations, setDecorations] = useState({});
    // 꾸미기 아이템 마스터 (이름·해금 단계·이미지 URL). 서버가 단일 출처다
    const [items, setItems] = useState([]);
    const [username, setUsername] = useState(user?.nickname ?? "식물집사");
    const [imagesLoaded, setImagesLoaded] = useState(false);
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
        // Ionicons/MaterialCommunityIcons 는 폰트로 그려진다 — 미리 안 올리면
        // 17개 화면의 벡터 아이콘이 첫 진입 때 빈 칸으로 있다가 뒤늦게 나타난다
        ...Ionicons.font,
        ...MaterialCommunityIcons.font,
    });

    // DB에서 현재 사용자의 식물 목록 로드 (정원 진입 시 갱신도 이 함수 재사용)
    const loadPlants = useCallback(() => {
        getPlants()
            .then((rows) => {
                const mapped = rows.map(toGardenPlant);
                setPlants(mapped);
                // 적용된 꾸미기도 목록에 함께 와서 개체마다 조회하지 않는다
                setDecorations(
                    Object.fromEntries(
                        rows.map((row) => [
                            String(row.id),
                            {
                                accessory: row.decoration_item_key
                                    ? {
                                          key: row.decoration_item_key,
                                          spriteUrl: row.decoration_sprite_url ?? null,
                                      }
                                    : null,
                                background: {
                                    key: row.background_item_key ?? DEFAULT_BACKGROUND_KEY,
                                    url: row.background_image_url ?? null,
                                },
                            },
                        ]),
                    ),
                );
                // 캐릭터 이미지는 번들이 아니라 S3 URL이라 preload 대상이 아니다 —
                // 목록을 받은 즉시 미리 받아둬서 정원/개체탭에서 늦게 뜨지 않게 한다
                mapped.forEach((plant) => {
                    if (plant.imageUri) {
                        Image.prefetch(plant.imageUri).catch(() => {});
                    }
                });
                // 꾸미기 이미지도 S3 URL 이면 마찬가지로 미리 받아둔다
                rows.forEach((row) => {
                    [row.decoration_sprite_url, row.background_image_url].forEach((url) => {
                        if (url) Image.prefetch(url).catch(() => {});
                    });
                });
            })
            .catch((error) => console.warn("식물 목록 로드 실패:", error?.message));
    }, []);

    useEffect(() => {
        loadPlants();
    }, [loadPlants]);

    /*
        꾸미기 아이템 목록 — 꾸미기 탭에 들어간 뒤 조회하면 왕복 시간만큼 빈 화면이 보여서
        시작할 때 미리 받아 둔다. 이미지도 함께 미리 받아 두면 탭을 열자마자 그려진다
        (번들 사본이 있어 그동안에도 빈 칸은 아니지만, 원격으로 바뀌는 순간이 빨라진다).
    */
    const loadItems = useCallback(() => {
        getItems()
            .then((rows) => {
                setItems(rows);
                rows.forEach((row) => {
                    [row.image_url, row.sprite_url].forEach((url) => {
                        if (url) Image.prefetch(url).catch(() => {});
                    });
                });
            })
            .catch((error) => console.warn("꾸미기 아이템 로드 실패:", error?.message));
    }, []);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    /*
        꾸미기 화면이 슬롯 하나를 바꿀 때 호출한다 (낙관적 반영 → 서버 저장 → 확정).
        slot 은 'accessory' | 'background', value 는 { key, ... } 또는 null(액세서리 해제).
        배경은 해제 대신 기본 배경 키가 들어온다.
    */
    const applyDecoration = useCallback((plantId, slot, value) => {
        setDecorations((prev) => {
            const id = String(plantId);
            return { ...prev, [id]: { ...(prev[id] ?? {}), [slot]: value } };
        });
    }, []);

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

        preloadBundledImages()
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
                            plants={plants}
                            decorations={decorations}
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
                            decorations={decorations}
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
                        <PlantDetailScreen
                            {...props}
                            decorations={decorations}
                            reloadPlants={loadPlants}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen
                    name="AddPlant"
                    component={AddPlantNavigator}
                    options={{ headerShown: false, animation: "slide_from_bottom" }}
                />

                <Stack.Screen name="Profile" options={{ headerShown: false }}>
                    {(props) => <ProfileScreen {...props} decorations={decorations} />}
                </Stack.Screen>
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
                <Stack.Screen name="SensorData" options={{ headerShown: false }}>
                    {(props) => <SensorDataScreen {...props} decorations={decorations} />}
                </Stack.Screen>
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
                            items={items}
                            reloadItems={loadItems}
                            decorations={decorations}
                            applyDecoration={applyDecoration}
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
                            decorations={decorations}
                        />
                    )}
                </Stack.Screen>

                <Stack.Screen
                    name="Calendar"
                    options={{ headerShown: false }}
                >
                    {/* 캘린더는 개체 목록으로 돌봄 기록을 조회하고 캐릭터를 그린다 */}
                    {(props) => <CalendarScreen {...props} plants={plants} />}
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
                        <MemorialPlantScreen {...props} decorations={decorations} />
                    )}
                </Stack.Screen>

            </Stack.Navigator>
        </NavigationContainer>
    );
}

/*
    배경음악 플레이어는 네비게이터보다 바깥에 둔다.
    화면을 옮길 때마다 플레이어가 다시 만들어지면 음악이 끊기기 때문이다.
    로그아웃하면 MainApp 이 통째로 사라지면서 음악도 함께 멈춘다.
*/
export default function MainApp(props) {
    return (
        <BackgroundMusicProvider>
            <MainAppContent {...props} />
        </BackgroundMusicProvider>
    );
}
