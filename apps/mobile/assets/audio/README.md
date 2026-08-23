# 오디오 음원

배경음악(`bgm-main.mp3`) 1개와 효과음(`sfx-*.wav`) 4개가 들어간다.

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

---

# 효과음 — 전부 무음 placeholder 입니다

효과음 4개 중 **`sfx-water.mp3` 만 실제 음원**이고, 나머지 3개는 아직
**소리가 나지 않는 더미 wav** 다 (버튼음 0.15초, 나머지 0.3초). BGM 과 같은 이유로
(`require()` 가 번들 단계에서 실패하지 않도록) 자리만 잡아둔 것이고,
실제 음원을 **같은 이름으로 덮어쓰면** 바로 재생된다.

| 파일 | 언제 나는지 | 어울리는 소리 |
| --- | --- | --- |
| `sfx-water.mp3` | 개체탭에서 물주기를 시작할 때 1회 | 물 붓는 소리, 0.5~1초 |
| `sfx-pet.wav` | 캐릭터를 문지를 때 (하트가 뜰 때마다) | 아주 짧고 가벼운 소리, 0.2초 이하 |
| `sfx-pickup.wav` | 홈에서 캐릭터를 길게 눌러 집어들 때 | 톡/뽁 하는 짧은 소리 |
| `sfx-tap.wav` | **모든 공용 버튼**을 누를 때 | 아주 담백한 클릭음, 0.15초 이하 |

## 고를 때

- 출처는 BGM 과 같이 [Pixabay 효과음](https://pixabay.com/sound-effects/) 을 쓰면
  라이선스 조건이 같아 편하다 (상업적 이용 가능, 출처 표기 의무 없음)
- **`sfx-tap` 은 가장 많이 들리는 소리다.** 앱의 모든 버튼에서 나므로 조금만 튀어도
  금방 피곤해진다. 짧고 낮고 담백한 클릭음을 고른다 (Kenney Interface Sounds 추천)
- **길이가 가장 중요하다.** `sfx-pet` 은 문지르는 동안 0.13초 간격으로 불릴 수 있어서
  길면 앞소리가 잘리며 지저분해진다. 짧을수록 좋다
- 볼륨은 코드에서 설정값(0~10)에 맞춰 조절하므로, 파일 자체는 **최대 음량 기준**으로
  정규화된 것을 쓰면 된다

## 넣는 방법

1. 음원을 받아 **wav / mp3 / m4a 중 하나**로 준비한다 (아래 "쓸 수 있는 형식" 참고)
2. 위 표의 이름으로 이 폴더에 덮어쓰기
   (확장자를 바꾼다면 `src/feedback.ts` 의 `SFX_SOURCES` 도 함께 고친다)
3. Metro 캐시를 비우고 재시작: `npx expo start -c`

## 쓸 수 있는 형식 — ogg 는 안 된다

번들러가 받아주는 오디오 확장자는 `wav` `mp3` `m4a` `aac` `aiff` `caf` 뿐이다
(metro 기본값 + Expo 가 더하는 `heic`/`avif`/`db`. **`ogg` 는 목록에 없다**).

설령 `metro.config.js` 로 `assetExts` 에 `ogg` 를 넣더라도 **iOS 에서는 소리가 안 난다** —
expo-audio 는 iOS 에서 AVFoundation 을 쓰는데 Ogg Vorbis 코덱을 지원하지 않는다.
Android 에서만 들리는 효과음이 되므로 쓰지 않는다.

Kenney 등 게임 에셋 팩은 보통 `.ogg` 와 `.wav` 를 함께 배포하니 **`.wav` 쪽을 쓰면 된다.**

> 지금 폴더에 있는 `sfx-pickup.ogg` 는 위 이유로 **쓰이지 않는다.**
> 같은 팩의 `sfx-pickup.wav` 를 넣고 나면 지워도 된다.

## 물소리는 애니메이션보다 길어도 된다

지금 들어있는 `sfx-water.mp3` 는 약 6초로, 물주기 애니메이션(물방울 8개 ×
110ms + 낙하 1.1초 ≈ 2초)보다 길다. 화면을 벗어나면 `stopSfx("water")` 로
끊기 때문에 다른 화면까지 따라가지는 않지만, 개체탭에 머무는 동안에는
애니메이션이 끝난 뒤에도 물소리가 남는다.

거슬리면 1~2초짜리 짧은 음원으로 바꾸면 된다. 파일만 덮어쓰면 코드는 그대로다.

## 버튼음은 어디서 나나

`sfx-tap` 은 화면이 아니라 **공용 버튼 컴포넌트**가 낸다. 새 버튼을 만들 때
아래 컴포넌트를 쓰면 소리가 자동으로 따라온다 (직접 `playSfx` 를 부를 필요 없다).

`ActionButton` · `IconCircleButton` · `GlassMenuItem` · `PhotoPickerButton` ·
`LiquidGlassButton` · `BackButton`(=ScreenHeader 뒤로가기) · `PixelButton`(=SocialButton) · `AppButton`
