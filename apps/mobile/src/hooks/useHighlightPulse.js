import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/*
    튜토리얼이 버튼을 가리킬 때 배경색만 바꾸면(GlassButton/LiquidGlassButton의
    highlighted) 앱 배경 자체가 초록 계열이라 눈에 잘 안 띈다. 커졌다 작아졌다를
    반복하는 펄스를 얹어 배경색과 무관하게 시선이 가게 한다.
*/
export function useHighlightPulse(active) {
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!active) {
            scale.setValue(1);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: 1.12,
                    duration: 480,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 1,
                    duration: 480,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [active, scale]);

    return scale;
}
