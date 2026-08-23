/**
 * 로컬 알림 — 물주기, 그리고 월 1회 캐릭터·개체정보 갱신.
 *
 * 서버 푸시(FCM/APNs)를 쓰지 않는 이유: 알릴 내용이 전부 기기 안에서 계산 가능하다.
 * 개체별 다음 예정일(next_watering_date / next_refresh_date)만 알면 되므로
 * 스케줄러·발송 서버가 필요 없다. 두 예정일 모두 목록 응답에 함께 실려 온다.
 * 기기 여러 대 동기화나 원격 발송이 필요해지면 push_token/notification 테이블로 확장한다.
 *
 * 예약은 개체당 종류별 1건만 유지한다 (identifier = <종류>-<plantId>).
 * 같은 identifier 로 다시 예약하면 이전 예약이 대체되므로 알림이 쌓이지 않는다.
 * 이미 지난 예정일은 예약하지 않는다 — 과거 알림을 몰아 쏘는 것은 역효과이고,
 * 밀린 항목은 화면에서 목록으로 보여주는 쪽이 맞다.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getPlants } from "./api";
import { loadNotificationSettings } from "./notificationSettings";

/** 알림 종류 — content.data.kind 에 실어 보내고, 탭 처리·목록 필터가 이 값을 본다 */
export type ReminderKind = "WATERING" | "MONTHLY_REFRESH";

const CHANNELS: Record<ReminderKind, { id: string; name: string }> = {
  WATERING: { id: "watering", name: "물주기 알림" },
  // 갱신은 급한 일이 아니라 물주기와 채널을 나눈다 — 한쪽만 끄고 싶을 수 있다
  MONTHLY_REFRESH: { id: "monthly-refresh", name: "캐릭터 갱신 알림" },
};

const IDENTIFIER_PREFIX: Record<ReminderKind, string> = {
  WATERING: "watering",
  MONTHLY_REFRESH: "refresh",
};

function identifierFor(kind: ReminderKind, plantId: number | string) {
  return `${IDENTIFIER_PREFIX[kind]}-${plantId}`;
}

/** 앱이 열려 있을 때도 배너를 띄운다 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** 안드로이드는 채널이 있어야 알림이 표시된다 */
export async function prepareNotifications(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Promise.all(
    Object.values(CHANNELS).map((channel) =>
      Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
    ),
  );
}

/** 권한 확인·요청. 거부되면 false */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** 예정일 + 설정된 알림 시각. 이미 지났으면 null */
function triggerDate(dueDate: string, hour: number, minute: number): Date | null {
  const [year, month, day] = dueDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const when = new Date(year, month - 1, day, hour, minute, 0, 0);
  return when.getTime() > Date.now() ? when : null;
}

/** 예약된 알림을 전부 지운다 — 알림 설정을 껐을 때, 그리고 로그아웃할 때 */
export async function cancelAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => {
        const kind = item.content.data?.kind;
        return kind === "WATERING" || kind === "MONTHLY_REFRESH";
      })
      .map((item) =>
        Notifications.cancelScheduledNotificationAsync(item.identifier),
      ),
  );
}

export async function cancelWateringReminder(plantId: number | string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifierFor("WATERING", plantId));
}

export async function cancelRefreshReminder(plantId: number | string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(
    identifierFor("MONTHLY_REFRESH", plantId),
  );
}

/** 개체 하나의 예약을 종류별로 지운다 — 떠나보냈을 때 */
export async function cancelPlantReminders(plantId: number | string): Promise<void> {
  await Promise.all([cancelWateringReminder(plantId), cancelRefreshReminder(plantId)]);
}

/**
 * 예약 한 건을 다시 잡는다 (종류 공통).
 * 예정일이 없거나 이미 지났으면 기존 예약만 지운다.
 */
async function schedule(
  kind: ReminderKind,
  plantId: number | string,
  dueDate: string | null,
  content: { title: string; body: string },
): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(identifierFor(kind, plantId));
  if (!dueDate) return false;

  const settings = await loadNotificationSettings();
  if (!settings.enabled) return false;

  const when = triggerDate(dueDate, settings.hour, settings.minute);
  if (!when) return false;

  if (!(await ensureNotificationPermission())) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: identifierFor(kind, plantId),
    content: {
      ...content,
      // plantId: 알림을 눌렀을 때 어느 개체인지 알기 위함
      // kind: 어느 화면으로 보낼지 (물주기 → 개체탭, 갱신 → 갱신 흐름)
      // dueDate: 예약 시각을 목록에 보여주기 위함. trigger 에서 읽으면 플랫폼마다
      //   모양이 달라(iOS 는 calendar/timeInterval 로 변환됨) 값이 비는 경우가 있다.
      data: { plantId: String(plantId), kind, dueDate },
      ...(Platform.OS === "android" ? { channelId: CHANNELS[kind].id } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });
  return true;
}

/** 개체 하나의 물주기 알림을 다시 예약한다 */
export async function scheduleWateringReminder(
  plantId: number | string,
  plantName: string,
  nextWateringDate: string | null,
): Promise<boolean> {
  return schedule("WATERING", plantId, nextWateringDate, {
    title: `${plantName || "식물"}이 목말라요`,
    body: "흙이 말랐는지 확인하고 물을 주세요.",
  });
}

/**
 * 개체 하나의 월 1회 갱신 알림을 다시 예약한다.
 *
 * 예정일은 서버가 계산해서(마지막 갱신 또는 등록일 + 1개월) 목록·상세에 함께 보낸다.
 * 반복 트리거(monthly)를 쓰지 않는 이유: 갱신을 마치면 기준일이 그 날로 옮겨가므로
 * 반복 주기의 기준점이 매번 바뀐다. 한 건씩 잡고 갱신·앱 시작 때 다시 잡는 편이 어긋나지 않는다.
 */
export async function scheduleRefreshReminder(
  plantId: number | string,
  plantName: string,
  nextRefreshDate: string | null,
): Promise<boolean> {
  return schedule("MONTHLY_REFRESH", plantId, nextRefreshDate, {
    title: `${plantName || "식물"}의 한 달을 기록해요`,
    body: "지금 모습으로 캐릭터를 다시 만들고 화분·크기 정보를 확인해 주세요.",
  });
}

/**
 * 알림이 실제로 오는지 확인하는 테스트용 — 몇 초 뒤에 한 번 쏜다.
 *
 * 실제 알림은 예정일 09:00 에 예약되므로 그날까지 기다려야 확인이 된다.
 * 권한·채널·수신·탭 이동까지 한 번에 점검하려고 둔 경로다.
 * 실제 예약과 섞이지 않도록 identifier 를 따로 쓴다.
 *
 * @returns 예약 성공 여부 (권한이 없으면 false)
 */
export async function sendTestReminder(seconds = 5): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  await prepareNotifications();

  await Notifications.scheduleNotificationAsync({
    identifier: "watering-test",
    content: {
      title: "알림 테스트",
      body: `${seconds}초 뒤에 오도록 예약한 알림이에요. 실제 물주기 알림도 이렇게 옵니다.`,
      data: { kind: "TEST" },
      ...(Platform.OS === "android" ? { channelId: CHANNELS.WATERING.id } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
  return true;
}

/** 예약된 알림 목록 — 무엇이 언제 오도록 잡혀 있는지 확인용 */
export async function listScheduledReminders(): Promise<
  { plantId: string; kind: ReminderKind; title: string; dueDate: string }[]
> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .filter((item) => {
      const kind = item.content.data?.kind;
      return kind === "WATERING" || kind === "MONTHLY_REFRESH";
    })
    .map((item) => ({
      plantId: String(item.content.data?.plantId ?? ""),
      kind: item.content.data?.kind as ReminderKind,
      title: item.content.title ?? "",
      dueDate: String(item.content.data?.dueDate ?? ""),
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * 전체 개체의 알림(물주기 + 월 1회 갱신)을 현재 일정에 맞춰 다시 맞춘다 (앱 시작 시).
 * 다른 기기에서 물을 줬거나 주기를 바꾼 경우, 기기에 남은 예약이 어긋나기 때문.
 * 떠나보낸 개체(DEAD)는 예약하지 않는다.
 *
 * @returns 예약된 건수 (물주기 + 갱신 합계)
 */
export async function syncReminders(): Promise<number> {
  const settings = await loadNotificationSettings();
  if (!settings.enabled) {
    // 설정을 끈 뒤 남아 있던 예약까지 지운다
    await cancelAllReminders();
    return 0;
  }
  if (!(await ensureNotificationPermission())) return 0;
  await prepareNotifications();

  // 목록 응답에 두 예정일이 함께 오므로 개체별 조회가 필요 없다 (호출 1회)
  const plants = await getPlants();
  let scheduled = 0;

  for (const plant of plants) {
    if (plant.status === "DEAD") {
      await cancelPlantReminders(plant.id);
      continue;
    }
    try {
      const results = await Promise.all([
        scheduleWateringReminder(plant.id, plant.nickname, plant.next_watering_date),
        // 예약에는 next_refresh_reminder_date 를 쓴다 — next_refresh_date 는
        // 지난 날짜일 수 있고, 지난 시각으로는 기기 알림을 잡을 수 없다
        scheduleRefreshReminder(plant.id, plant.nickname, plant.next_refresh_reminder_date),
      ]);
      scheduled += results.filter(Boolean).length;
    } catch {
      // 한 개체 실패가 나머지를 막지 않게 한다
    }
  }
  return scheduled;
}
