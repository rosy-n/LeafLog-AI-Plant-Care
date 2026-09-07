/**
 * 홈 화면 날씨/대기질(getCurrentEnvironment) 응답을 기기에 캐싱한다.
 *
 * 관측값 자체가 보통 1시간 단위로 갱신되므로, 서버 응답의 observed_at을 기준으로
 * 신선도를 판단한다 — fetch 시각이 아니라 "관측된 지 얼마나 됐는지"가 기준이라
 * 서버가 실제로 값을 갱신하는 주기와 어긋나지 않는다.
 *
 * AsyncStorage 대신 expo-file-system 을 쓰는 이유는 notificationSettings.ts 와 같다:
 * react@19.1.0 / react-dom peer 충돌로 @react-native-async-storage 설치가 막혀 있다.
 */
import { Directory, File, Paths } from "expo-file-system";

import type { CurrentEnvironmentResponse } from "./api";

const CACHE_TTL_MS = 60 * 60 * 1000;

const CACHE_DIR = new Directory(Paths.document, "leaflog");
const CACHE_FILE = new File(CACHE_DIR, "environment-cache.json");

// undefined = 아직 파일에서 읽지 않음, null = 캐시 없음(또는 깨짐)
let cached: CurrentEnvironmentResponse | null | undefined;

function readCacheFile(): CurrentEnvironmentResponse | null {
  try {
    if (!CACHE_FILE.exists) return null;
    const parsed = JSON.parse(CACHE_FILE.textSync());
    return parsed?.observed_at ? (parsed as CurrentEnvironmentResponse) : null;
  } catch {
    // 파일이 깨졌으면 캐시 없이 진행한다 (날씨 캐시 때문에 앱이 막히면 안 된다)
    return null;
  }
}

/** 캐시된 값을 즉시 반환한다 (없으면 null) — 화면이 로딩 없이 바로 보여줄 때 쓴다 */
export function getCachedEnvironment(): CurrentEnvironmentResponse | null {
  if (cached === undefined) cached = readCacheFile();
  return cached;
}

/** 캐시가 없거나, 관측된 지 CACHE_TTL_MS 이상 지났으면 true */
export function isEnvironmentCacheStale(): boolean {
  const env = getCachedEnvironment();
  if (!env) return true;
  const observedMs = new Date(env.observed_at).getTime();
  if (!Number.isFinite(observedMs)) return true;
  return Date.now() - observedMs >= CACHE_TTL_MS;
}

export function saveEnvironmentCache(data: CurrentEnvironmentResponse): void {
  cached = data;
  if (!CACHE_DIR.exists) CACHE_DIR.create({ intermediates: true });
  CACHE_FILE.write(JSON.stringify(data));
}
