/**
 * 배경음악·효과음 볼륨을 기기에 저장한다.
 *
 * 소리 크기는 기기(스피커/이어폰)와 사용 환경에 따라 달라지므로
 * 계정이 아니라 기기에 둔다. 알림 설정과 같은 이유다.
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
};

// 기본값은 SettingsScreen 이 원래 들고 있던 값을 그대로 옮긴 것이다
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  bgmVolume: 7,
  sfxVolume: 8,
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
  };
}

export async function loadAudioSettings(): Promise<AudioSettings> {
  try {
    if (!SETTINGS_FILE.exists) return DEFAULT_AUDIO_SETTINGS;
    return normalize(JSON.parse(SETTINGS_FILE.textSync()));
  } catch {
    // 파일이 깨졌으면 기본값으로 진행한다 (소리 설정 때문에 앱이 막히면 안 된다)
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export async function saveAudioSettings(settings: AudioSettings): Promise<void> {
  if (!SETTINGS_DIR.exists) SETTINGS_DIR.create({ intermediates: true });
  SETTINGS_FILE.write(JSON.stringify(normalize(settings)));
}
