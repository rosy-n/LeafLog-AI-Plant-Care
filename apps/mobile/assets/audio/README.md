# 배경음악·효과음 음원

## sfx-typing.mp3 — 아직 무음 placeholder 입니다

페르소나 대화창에서 캐릭터 대사가 타이핑되는 동안 나는 효과음이다.
지금 들어있는 파일은 **소리가 나지 않는 0.1초짜리 더미 파일**이다(ffmpeg `anullsrc`로 생성).
mp3 파일이 아예 없으면 `require()` 가 번들 단계에서 실패해 앱이 켜지지 않으므로 자리만 잡아둔 것이다.
실제 "틱" 효과음(예: 동물의숲 스타일 타이핑 사운드)을 구해서 **같은 이름(`sfx-typing.mp3`)으로 덮어쓰면** 바로 재생된다.

- 재생 로직: `src/screens/PlantDetailScreen.jsx` 의 `TYPING_SFX_CHAR_STEP` 글자마다 한 번씩 재생(매 글자마다 재생하면 소리가 밀려서 부자연스럽다)
- 길이는 **0.1초 안팎으로 아주 짧게** — 다음 재생 전에 안 끝나면 잘려서 재생된다
- 곡을 바꿔도 코드 수정은 필요 없다. 파일명만 `sfx-typing.mp3` 로 유지하면 된다

## bgm-main.mp3 — 아직 무음 placeholder 입니다

지금 들어있는 `bgm-main.mp3` 는 **소리가 나지 않는 2초짜리 더미 파일**이다.
mp3 파일이 아예 없으면 `require()` 가 번들 단계에서 실패해 앱이 켜지지 않으므로
자리만 잡아둔 것이다. 아래 음원을 받아 **같은 이름으로 덮어쓰면** 바로 재생된다.

## 받아야 할 음원

- 곡: **Kalimba Research Notes (cozy lofi)**
- 아티스트: Turning_Pages
- 길이: 2:20
- 출처: https://pixabay.com/music/lofi-kalimba-research-notes-cozy-lofi-462748/
- 라이선스: Pixabay Content License
  - 상업적 이용 가능, **출처 표기 의무 없음**
  - 음원 자체를 재배포·판매하는 것은 금지 (앱 BGM 사용은 허용 범위)
  - 아티스트가 크레딧을 권장하고 있어, 표기한다면 `Music by Turning Pages`

## 넣는 방법

1. 위 링크에서 mp3 다운로드 (Pixabay 로그인 필요)
2. 파일명을 `bgm-main.mp3` 로 바꿔 이 폴더에 덮어쓰기
3. Metro 캐시를 비우고 재시작: `npx expo start -c`

## 교체할 때 주의

- 앱 번들에 그대로 들어가므로 **모노 / 128kbps 정도로 줄여서** 넣는 것이 좋다
- 곡을 바꿔도 코드 수정은 필요 없다. 파일명만 `bgm-main.mp3` 로 유지하면 된다
