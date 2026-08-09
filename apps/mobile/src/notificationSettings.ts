/**
 * 알림 설정(켜기/끄기, 알림 시각)을 기기에 저장한다.
 *
 * 로컬 알림은 기기별로 예약되므로 설정도 기기에 둔다.
 * (여러 기기에서 같은 시각을 쓰려면 user_setting 테이블로 옮겨야 한다 — 지금은 과함)
 *
 * AsyncStorage 대신 expo-file-system 을 쓰는 이유:
 * 이 프로젝트에 react@19.1.0 / react-dom@19.2.8 peer 충돌이 있어
 * @react-native-async-storage/async-storage 설치가 막힌다. 그 충돌을 건드리지 않기 위해
 * 이미 의존성에 있는 expo-file-system 으로 작은 JSON 파일 하나를 읽고 쓴다.
 */
import { Directory, File, Paths } from "expo-file-system";

export type NotificationSettings = {
  enabled: boolean;
  hour: number; // 0~23
  minute: number; // 0~59
};

// 알림 시각 기본값 — 아침에 확인하고 물을 줄 수 있는 시간
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  hour: 9,
  minute: 0,
};

const SETTINGS_DIR = new Directory(Paths.document, "leaflog");
const SETTINGS_FILE = new File(SETTINGS_DIR, "notification-settings.json");

function normalize(raw: unknown): NotificationSettings {
  const value = (raw ?? {}) as Partial<NotificationSettings>;
  const hour = Number(value.hour);
  const minute = Number(value.minute);
  return {
    enabled: value.enabled !== false,
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23
      ? hour
      : DEFAULT_NOTIFICATION_SETTINGS.hour,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59
      ? minute
      : DEFAULT_NOTIFICATION_SETTINGS.minute,
  };
}

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    if (!SETTINGS_FILE.exists) return DEFAULT_NOTIFICATION_SETTINGS;
    return normalize(JSON.parse(SETTINGS_FILE.textSync()));
  } catch {
    // 파일이 깨졌으면 기본값으로 진행한다 (알림 설정 때문에 앱이 막히면 안 된다)
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<void> {
  if (!SETTINGS_DIR.exists) SETTINGS_DIR.create({ intermediates: true });
  SETTINGS_FILE.write(JSON.stringify(normalize(settings)));
}