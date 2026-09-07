/**
 * 로그인 토큰을 기기에 남겨 앱을 다시 켜도 로그인 상태가 유지되게 한다(자동 로그인).
 *
 * 저장 위치가 기기라서 계정이 아니라 "이 기기"에 묶인다 — 다른 기기에서는 다시
 * 로그인해야 하고, 여기서 로그아웃하면 이 기기에서만 풀린다. 요청받은 동작이 그렇다.
 *
 * AsyncStorage 대신 expo-file-system 을 쓰는 이유는 notificationSettings.ts 와 같다:
 * react@19.1.0 / react-dom@19.2.8 peer 충돌로 @react-native-async-storage/async-storage
 * 설치가 막혀 있어, 이미 의존성에 있는 expo-file-system 으로 작은 JSON 파일을 읽고 쓴다.
 *
 * 보안 참고: 이 파일은 앱 전용 저장 공간에 평문으로 남는다. 다른 앱은 읽을 수 없지만
 * 기기 백업이나 루팅된 기기에서는 노출될 수 있다. 더 강하게 보관해야 하면
 * expo-secure-store(Keychain/Keystore)로 이 모듈 안쪽만 바꾸면 된다 —
 * 호출부는 아래 세 함수만 알고 있어서 교체 범위가 이 파일로 끝난다.
 */
import { Directory, File, Paths } from "expo-file-system";

const AUTH_DIR = new Directory(Paths.document, "leaflog");
const AUTH_FILE = new File(AUTH_DIR, "auth.json");

type StoredAuth = { access_token?: unknown };

/** 저장된 토큰 — 없거나 파일이 깨졌으면 null */
export function loadStoredToken(): string | null {
  try {
    if (!AUTH_FILE.exists) return null;
    const parsed = JSON.parse(AUTH_FILE.textSync()) as StoredAuth;
    const token = parsed?.access_token;
    return typeof token === "string" && token ? token : null;
  } catch {
    // 파일이 깨졌으면 자동 로그인만 포기한다 (앱 시작을 막으면 안 된다)
    return null;
  }
}

export function saveStoredToken(token: string): void {
  try {
    if (!AUTH_DIR.exists) AUTH_DIR.create({ intermediates: true });
    AUTH_FILE.write(JSON.stringify({ access_token: token }));
  } catch (error) {
    // 저장에 실패해도 이번 세션 로그인은 이미 끝났다 — 다음 실행에 자동 로그인만 안 된다
    console.warn("로그인 상태 저장 실패:", (error as Error)?.message);
  }
}

export function clearStoredToken(): void {
  try {
    if (AUTH_FILE.exists) AUTH_FILE.delete();
  } catch (error) {
    console.warn("로그인 상태 삭제 실패:", (error as Error)?.message);
  }
}
