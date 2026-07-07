import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Fonts } from '../constants/fonts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded, fontError] = useFonts({
        [Fonts.neoDunggeunmo]: require('../assets/fonts/NeoDunggeunmoPro-Regular.ttf'),
        [Fonts.nanumSquareNeo]: require('../assets/fonts/NanumSquareNeo-cBd.ttf'),
    });

    useEffect(() => {
        if (fontsLoaded || fontError) SplashScreen.hideAsync();
    }, [fontsLoaded, fontError]);

    if (!fontsLoaded && !fontError) return null;

    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="add-plant" options={{ headerShown: false }} />
        </Stack>
    );
}