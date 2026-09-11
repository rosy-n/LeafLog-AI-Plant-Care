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

export default function useMediaSource(source) {
  const uri = source?.uri;
  const [resolved, setResolved] = useState(null);
  const current = useRef(null);
  const activeUri = uri && resolved?.original === uri ? resolved.url : uri;

  useEffect(() => {
    const state = { uri, inFlight: false, failed: false, alive: true, lastAttempt: 0 };
    current.current = state;
    return () => { state.alive = false; };
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
    } catch {
      state.failed = true;
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

  return { source: uri ? { ...source, uri: activeUri } : source, refresh };
}
