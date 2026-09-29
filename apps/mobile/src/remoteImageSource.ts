import type { ImageURISource } from 'react-native';

/*
  외부 이미지 주소 → Image source.

  Wikimedia(종 사진)는 연락처 없는 기본 User-Agent 요청을 403으로 막는다
  (https://w.wiki/4wJS). 안드로이드 RN Image 의 기본 UA(okhttp/…)가 여기에 걸려
  종 사진이 아예 안 뜨므로, Wikimedia 주소에만 앱 UA 를 실어 보낸다.
  서버의 app/wikimedia.py 도 같은 이유로 UA 를 붙인다.
*/
const WIKIMEDIA_HOST = /^https:\/\/[^/]*\.wikimedia\.org\//;
const WIKIMEDIA_USER_AGENT = 'LeafLog/1.0 (https://github.com/rosy-n/LeafLog-AI-Plant-Care)';

export function remoteImageSource(uri: string): ImageURISource {
  if (WIKIMEDIA_HOST.test(uri)) {
    return { uri, headers: { 'User-Agent': WIKIMEDIA_USER_AGENT } };
  }
  return { uri };
}
