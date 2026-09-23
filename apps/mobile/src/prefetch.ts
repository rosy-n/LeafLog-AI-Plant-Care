/*
    화면을 열 때마다 서버를 다녀오느라 늦게 뜨는 것을 막는 메모리 캐시.

    동작 방식은 "캐시 먼저, 뒤에서 갱신"이다.
      - 앱이 시작하면 warmUpAll() 이 화면들이 쓸 응답을 미리 받아 둔다
      - 화면은 peek() 으로 그 값을 즉시 그리고(로딩 스피너 없이),
        동시에 revalidate() 로 최신값을 받아 조용히 갈아끼운다

    캐시를 무효화하는 자리를 따로 두지 않은 것은 의도적이다. 기록을 쓰거나 물을 준
    뒤 화면이 다시 조회하면 revalidate() 가 항상 서버를 다녀오므로, 캐시는 "빈 화면이
    보이는 구간"만 없앨 뿐 옛 값을 붙잡아 두지 않는다.

    세션 범위라 디스크에 쓰지 않는다 — 로그아웃하면 clearPrefetchCache() 로 비운다.
    (기기에 남겨야 하는 날씨 캐시는 environmentCache.ts 가 따로 맡는다.)
*/
import {
  getCareRecords,
  getDiaryMonth,
  getEnvironmentHistory,
  getInquiries,
  getPersonas,
  getPlant,
  getPlantAffinity,
  getPlantCare,
  getPlants,
  getSoilHistory,
  getSoilStatus,
  getUserSettings,
  listConsultations,
} from "./api";

type CacheKey = string;

const values = new Map<CacheKey, unknown>();
const inflight = new Map<CacheKey, Promise<unknown>>();

/** 캐시된 값을 동기로 꺼낸다. 없으면 undefined — 화면의 초기 state 로 쓴다. */
export function peek<T>(key: CacheKey): T | undefined {
  return values.get(key) as T | undefined;
}

/**
 * 서버에서 새로 받아 캐시를 갱신한다.
 * 같은 키의 요청이 이미 날아가 있으면(예: warmUpAll 이 아직 도는 중) 그 요청에 합류해
 * 같은 응답을 두 번 받지 않는다.
 */
export function revalidate<T>(key: CacheKey, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const promise = fetcher()
    .then((value) => {
      values.set(key, value);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * 이미 손에 들고 있는 응답을 캐시에 넣어 둔다.
 * 물주기처럼 화면이 직접 조회한 최신값이 있을 때 쓴다 — revalidate 로 다시 받으면
 * 방금 날아간 요청에 합류해 기록 이전 값을 받을 수 있다.
 */
export function store<T>(key: CacheKey, value: T): T {
  values.set(key, value);
  return value;
}

/** 로그아웃 — 다음 사용자에게 앞사람의 데이터가 보이면 안 된다 */
export function clearPrefetchCache(): void {
  values.clear();
  inflight.clear();
}

/*
    캐시 키 — 화면과 warmUpAll 이 같은 문자열을 쓰도록 여기 한 곳에만 적는다.
    키가 어긋나면 캐시가 조용히 안 맞는 형태로 깨지므로 직접 문자열을 쓰지 말 것.
*/
export const cacheKeys = {
  plants: () => "plants",
  userSettings: () => "user-settings",
  personas: () => "personas",
  inquiries: () => "inquiries",
  environmentHistory: (period: string) => `env-history:${period}`,
  diaryMonth: (year: number, month: number) => `diary:${year}-${month}`,
  plant: (plantId: number | string) => `plant:${plantId}`,
  plantCare: (plantId: number | string) => `plant-care:${plantId}`,
  plantAffinity: (plantId: number | string) => `plant-affinity:${plantId}`,
  soilStatus: (plantId: number | string) => `soil-status:${plantId}`,
  soilHistory: (plantId: number | string, period: string) =>
    `soil-history:${plantId}:${period}`,
  careRecords: (plantId: number | string, careType: string) =>
    `care-records:${plantId}:${careType}`,
  consultations: (plantId: number | string) => `consultations:${plantId}`,
};

/** 센서 데이터탭의 기간 탭 — 셋 다 미리 받아 두면 탭 전환이 즉시 그려진다 */
export const HISTORY_PERIODS = ["day", "week", "month"] as const;

/** 캘린더·영양제·분갈이 화면이 쓰는 돌봄 기록 종류 (서버 CARE_TYPES) */
export const CARE_TYPES = ["WATERING", "FERTILIZING", "REPOTTING"] as const;

/*
    한 번에 던지는 요청 수 제한. 개체가 여러 개면 개체당 열 몇 개씩 생겨서
    제한이 없으면 수십 개가 한꺼번에 나가고, 그 뒤에 선 사용자의 실제 조회가
    밀린다. 백그라운드 작업이므로 조금 느리게 끝나도 된다.
*/
const MAX_CONCURRENT = 4;

async function runPool(tasks: Array<() => Promise<unknown>>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, tasks.length) }, async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      if (!task) break;
      // 하나가 실패해도 나머지 preload 는 계속한다 — 실패하면 화면이 직접 다시 조회한다
      await task().catch(() => {});
    }
  });
  await Promise.all(workers);
}

type WarmUpPlant = { id: number | string };

/**
 * 시작 화면(날씨 조회·이미지 preload)이 도는 동안 함께 시작하는 예열 진입점.
 * 개체 목록부터 받아서 개체별 조회까지 이어 건다 — 본 앱이 마운트되며 부르는
 * 목록 조회는 여기서 이미 날아간 요청에 revalidate 가 합류시키므로 두 번 가지 않는다.
 */
export async function warmUpEverything(): Promise<void> {
  const plants = await revalidate(cacheKeys.plants(), getPlants).catch(() => []);
  await warmUpAll(plants as WarmUpPlant[]);
}

/**
 * 앱 시작 직후 백그라운드로 도는 예열.
 * 탭을 옮길 때 조회가 시작되지 않도록, 화면들이 쓰는 응답을 미리 캐시에 채운다.
 */
export async function warmUpAll(plants: WarmUpPlant[]): Promise<void> {
  const tasks: Array<() => Promise<unknown>> = [];

  const add = <T>(key: CacheKey, fetcher: () => Promise<T>) => {
    // 이미 받아 둔 값은 다시 받지 않는다 (재로그인·목록 갱신으로 두 번 불릴 수 있다)
    if (values.has(key)) return;
    tasks.push(() => revalidate(key, fetcher));
  };

  // ── 개체와 무관한 것들 ──
  add(cacheKeys.userSettings(), getUserSettings);
  add(cacheKeys.personas(), getPersonas);
  add(cacheKeys.inquiries(), getInquiries);
  for (const period of HISTORY_PERIODS) {
    add(cacheKeys.environmentHistory(period), () => getEnvironmentHistory(period));
  }
  const now = new Date();
  add(cacheKeys.diaryMonth(now.getFullYear(), now.getMonth() + 1), () =>
    getDiaryMonth(now.getFullYear(), now.getMonth() + 1),
  );

  // ── 개체별 ──
  for (const plant of plants) {
    const id = Number(plant.id);
    if (!Number.isFinite(id)) continue;

    add(cacheKeys.plant(id), () => getPlant(id));
    add(cacheKeys.plantCare(id), () => getPlantCare(id));
    add(cacheKeys.plantAffinity(id), () => getPlantAffinity(id));
    add(cacheKeys.consultations(id), () => listConsultations(id));
    // 센서가 없는 화분이 기본이라 404 가 정상 — 실패는 runPool 이 삼킨다
    add(cacheKeys.soilStatus(id), () => getSoilStatus(id));
    for (const period of HISTORY_PERIODS) {
      add(cacheKeys.soilHistory(id, period), () => getSoilHistory(id, period));
    }
    for (const careType of CARE_TYPES) {
      add(cacheKeys.careRecords(id, careType), () => getCareRecords(id, careType));
    }
  }

  await runPool(tasks);
}
