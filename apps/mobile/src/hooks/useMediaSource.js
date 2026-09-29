import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getAuthToken, refreshMediaUrl } from '../api';

export function signedUrlExpiry(uri) {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.amazonaws.com')) return null;
    const date = url.searchParams.get('X-Amz-Date');
    const seconds = Number(url.searchParams.get('X-Amz-Expires'));
    if (!date || !/^\d{8}T\d{6}Z$/.test(date) || !(seconds > 0)) return null;
    return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1,
      Number(date.slice(6, 8)), Number(date.slice(9, 11)), Number(date.slice(11, 13)),
      Number(date.slice(13, 15))) + seconds * 1000;
  } catch {
    return null;
  }
}

/*
  이미지 로드가 실패했을 때 같은 주소를 다시 불러오는 간격. 네트워크가 바뀌는 순간
  (Wi-Fi ↔ LTE) 받던 이미지가 실패하면, RN Image 는 같은 주소를 스스로 다시 부르지 않아서
  계속 떠 있는 화면(정원 등)에서는 그대로 빈 칸으로 남는다. 몇 번만 늦춰 가며 다시 부른다.
*/
const RELOAD_DELAYS_MS = [3_000, 10_000, 30_000, 30_000, 30_000];

export default function useMediaSource(source) {
  const uri = source?.uri;
  const [resolved, setResolved] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const current = useRef(null);
  const activeUri = uri && resolved?.original === uri ? resolved.url : uri;

  useEffect(() => {
    const state = {
      uri, inFlight: false, failed: false, alive: true, lastAttempt: 0, reloads: 0, reloadTimer: null,
    };
    current.current = state;
    return () => {
      state.alive = false;
      clearTimeout(state.reloadTimer);
    };
  }, [uri]);

  const refresh = useCallback(async () => {
    const state = current.current;
    const token = getAuthToken();
    if (!state?.alive || state.uri !== uri || state.inFlight || state.failed ||
        !token || signedUrlExpiry(uri) === null || Date.now() - state.lastAttempt < 30_000) return;
    state.inFlight = true;
    state.lastAttempt = Date.now();
    try {
      const result = await refreshMediaUrl(uri);
      if (state.alive && token === getAuthToken()) setResolved({ original: uri, url: result.url });
    } catch (error) {
      // 서버가 거절한 경우(4xx)만 다시 묻지 않는다. 네트워크가 끊겨 실패한 건 일시적이라
      // 막아 두면 네트워크가 돌아와도 이미지가 영영 안 뜬다 (30초 간격 제한은 그대로).
      const status = error?.status;
      if (typeof status === 'number' && status >= 400 && status < 500) state.failed = true;
    } finally {
      state.inFlight = false;
    }
  }, [uri]);

  useEffect(() => {
    const expiry = signedUrlExpiry(activeUri);
    if (expiry === null) return;
    const timer = setTimeout(refresh, Math.max(1000, expiry - Date.now() - 60_000));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() > expiry - 60_000) {
        if (current.current) current.current.failed = false;
        refresh();
      }
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [activeUri, refresh]);

  // 이미지 onError 용 — 서명 주소면 새로 받아 오고, 같은 주소라도 잠시 뒤 다시 불러오게 한다.
  // 다시 부르는 건 reloadKey 를 올려 Image 를 새로 그리는 방식이다 (key 로 쓴다).
  const handleError = useCallback(() => {
    refresh();
    const state = current.current;
    if (!uri || !state?.alive || state.uri !== uri || state.reloadTimer ||
        state.reloads >= RELOAD_DELAYS_MS.length) return;
    state.reloadTimer = setTimeout(() => {
      state.reloadTimer = null;
      if (!state.alive) return;
      state.reloads += 1;
      setReloadKey((key) => key + 1);
    }, RELOAD_DELAYS_MS[state.reloads]);
  }, [uri, refresh]);

  return { source: uri ? { ...source, uri: activeUri } : source, refresh, onError: handleError, reloadKey };
}
