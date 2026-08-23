/**
 * 배경음악·효과음 볼륨과 진동 사용 여부를 기기에 저장한다.
 * 설정 화면의 "사운드&진동" 카드가 그대로 여기에 대응한다.
 *
 * 소리 크기와 진동은 기기(스피커/이어폰/햅틱 지원 여부)와 사용 환경에 따라
 * 달라지므로 계정이 아니라 기기에 둔다. 알림 설정과 같은 이유다.
 *
 * AsyncStorage 대신 expo-file-system 을 쓰는 이유도 notificationSettings.ts 와 같다:
 * react@19.1.0 / react-dom peer 충돌로 @react-native-async-storage 설치가 막혀 있다.
 */
import { Directory, File, Paths } from "expo-file-system";

/** 볼륨 UI 단계 수 — SettingsScreen 의 VolumeControl 막대 개수와 같아야 한다 */
export const VOLUME_STEPS = 10;

export type AudioSettings = {
  bgmVolume: number; // 0~VOLUME_STEPS (0이면 끔)
  sfxVolume: number; // 0~VOLUME_STEPS (0이면 끔)
  vibration: boolean;
};

// 기본값은 SettingsScreen 이 원래 들고 있던 값을 그대로 옮긴 것이다
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  bgmVolume: 7,
  sfxVolume: 8,
  vibration: true,
};

const SETTINGS_DIR = new Directory(Paths.document, "leaflog");
const SETTINGS_FILE = new File(SETTINGS_DIR, "audio-settings.json");

function clampStep(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(VOLUME_STEPS, Math.max(0, n));
}

function normalize(raw: unknown): AudioSettings {
  const value = (raw ?? {}) as Partial<AudioSettings>;
  return {
    bgmVolume: clampStep(value.bgmVolume, DEFAULT_AUDIO_SETTINGS.bgmVolume),
    sfxVolume: clampStep(value.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
    // 저장된 적 없으면 켬 — 진동은 기본으로 있는 편이 자연스럽다
    vibration: value.vibration !== false,
  };
}

/*
    최근 설정 캐시.

    효과음과 진동은 화면 밖(feedback.ts)에서 훅 없이 즉시 호출되는데,
    누를 때마다 파일을 읽을 수는 없어서 마지막으로 읽고 쓴 값을 여기 들고 있는다.
    아래 load/save 를 거치면 항상 최신이라 별도로 갱신해 줄 필요가 없다.
*/
let cached: AudioSettings = DEFAULT_AUDIO_SETTINGS;

export function getAudioSettings(): AudioSettings {
  return cached;
}

export async function loadAudioSettings(): Promise<AudioSettings> {
  try {
    if (!SETTINGS_FILE.exists) return (cached = DEFAULT_AUDIO_SETTINGS);
    return (cached = normalize(JSON.parse(SETTINGS_FILE.textSync())));
  } catch {
    // 파일이 깨졌으면 기본값으로 진행한다 (소리 설정 때문에 앱이 막히면 안 된다)
    return (cached = DEFAULT_AUDIO_SETTINGS);
  }
}

export async function saveAudioSettings(settings: AudioSettings): Promise<void> {
  cached = normalize(settings);
  if (!SETTINGS_DIR.exists) SETTINGS_DIR.create({ intermediates: true });
  SETTINGS_FILE.write(JSON.stringify(cached));
}
