/**
 * 배경음악 재생 + 소리 설정(볼륨) 공유.
 *
 * 플레이어는 앱 전체에서 하나만 둔다. 화면을 옮겨도 음악이 끊기지 않아야 하므로
 * 네비게이터 바깥(App.js 최상단)에서 Provider 로 감싸고, 볼륨 조절은
 * SettingsScreen 이 useBackgroundMusic() 으로 같은 플레이어를 건드린다.
 *
 * expo-av 가 아니라 expo-audio 를 쓰는 이유: expo-av 는 SDK 54 에서 deprecated 다.
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";

import {
    DEFAULT_AUDIO_SETTINGS,
    VOLUME_STEPS,
    loadAudioSettings,
    saveAudioSettings,
    type AudioSettings,
} from "./audioSettings";

/*
    음원을 바꿀 때는 이 파일이 아니라 mp3 만 덮어쓰면 된다.
    곡 출처·라이선스·교체 방법은 assets/audio/README.md 참고.
    (지금 들어있는 파일은 무음 placeholder — 실제 음원을 아직 안 넣었다면 소리가 안 난다)
*/
const BGM_SOURCE = require("../assets/audio/bgm-main.mp3");

type BackgroundMusicValue = AudioSettings & {
    setBgmVolume: (step: number) => void;
    setSfxVolume: (step: number) => void;
};

const BackgroundMusicContext = createContext<BackgroundMusicValue | null>(null);

export function BackgroundMusicProvider({ children }: { children: React.ReactNode }) {
    const player = useAudioPlayer(BGM_SOURCE);

    const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
    // 저장된 설정을 읽기 전에는 재생하지 않는다.
    // 볼륨 0으로 꺼둔 사용자에게 앱 켜자마자 기본값(7)으로 소리가 새는 걸 막는다.
    const [loaded, setLoaded] = useState(false);
    const [isForeground, setIsForeground] = useState(
        () => AppState.currentState === "active",
    );

    // 오디오 세션 설정 — 한 번만
    useEffect(() => {
        setAudioModeAsync({
            /*
                iOS 무음 스위치를 켜둬도 BGM 이 들리게 한다.
                무음 모드는 보통 알림음을 막으려고 켜두는 것이라,
                사용자가 설정에서 직접 올린 BGM 볼륨까지 함께 막히면 안 된다.
                (BGM 을 끄고 싶으면 설정에서 볼륨 0 으로 내리면 된다)
            */
            playsInSilentMode: true,
            // 앱을 나가면 음악도 멈춘다 (백그라운드 재생 앱이 아니다)
            shouldPlayInBackground: false,
            /*
                사용자가 듣던 음악(스포티파이 등)을 끊지 않는다.
                겹치는 게 싫은 사용자는 설정에서 BGM 볼륨을 0으로 내리면 된다.
            */
            interruptionMode: "mixWithOthers",
        }).catch((e: any) => console.warn("오디오 모드 설정 실패:", e?.message));

        player.loop = true;
    }, []);

    // 저장된 볼륨 불러오기
    useEffect(() => {
        let mounted = true;
        loadAudioSettings().then((saved) => {
            if (!mounted) return;
            setSettings(saved);
            setLoaded(true);
        });
        return () => {
            mounted = false;
        };
    }, []);

    // 포그라운드에 있을 때만 재생 — 홈 버튼으로 나갔다 돌아오면 이어서 재생된다
    useEffect(() => {
        const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
            setIsForeground(state === "active");
        });
        return () => sub.remove();
    }, []);

    // 볼륨/포그라운드 상태에 맞춰 실제 플레이어를 맞춘다
    useEffect(() => {
        if (!loaded) return;
        player.volume = settings.bgmVolume / VOLUME_STEPS;
        if (settings.bgmVolume > 0 && isForeground) player.play();
        else player.pause();
    }, [loaded, settings.bgmVolume, isForeground]);

    // 볼륨을 바꾸면 화면에는 즉시 반영하고, 저장은 뒤에서 처리한다
    const update = useCallback((patch: Partial<AudioSettings>) => {
        setSettings((prev) => {
            const next = { ...prev, ...patch };
            saveAudioSettings(next).catch((e: any) =>
                console.warn("소리 설정 저장 실패:", e?.message),
            );
            return next;
        });
    }, []);

    const setBgmVolume = useCallback(
        (step: number) => update({ bgmVolume: step }),
        [update],
    );
    const setSfxVolume = useCallback(
        (step: number) => update({ sfxVolume: step }),
        [update],
    );

    return (
        <BackgroundMusicContext.Provider
            value={{ ...settings, setBgmVolume, setSfxVolume }}
        >
            {children}
        </BackgroundMusicContext.Provider>
    );
}

export function useBackgroundMusic(): BackgroundMusicValue {
    const value = useContext(BackgroundMusicContext);
    if (!value) {
        throw new Error("useBackgroundMusic 은 BackgroundMusicProvider 안에서만 쓸 수 있다");
    }
    return value;
}
