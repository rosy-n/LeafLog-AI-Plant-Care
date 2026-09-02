/**
 * 효과음·진동 — 화면에서 바로 부르는 손맛 담당.
 *
 * 설정(효과음 볼륨 / 진동 켜기)은 audioSettings 의 캐시에서 읽는다.
 * 훅이 아니라 그냥 함수인 이유: 진동은 애니메이션 타이머 안이나 제스처 콜백처럼
 * 렌더링 바깥에서도 울려야 해서, 화면마다 컨텍스트를 끌어다 쓰게 하면 번거롭다.
 *
 * 배경음악은 화면 이동과 무관하게 이어져야 해서 Provider(backgroundMusic.tsx)가
 * 들고 있지만, 효과음은 그때그때 짧게 나고 끝이라 여기서 직접 재생한다.
 */
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

import { VOLUME_STEPS, getAudioSettings } from "./audioSettings";

// 진동 세기 — 화면이 expo-haptics 를 따로 import 하지 않도록 여기서 다시 내보낸다
export { ImpactFeedbackStyle } from "expo-haptics";

/*
    음원을 바꿀 때는 이 파일이 아니라 wav 만 덮어쓰면 된다.
    출처·라이선스·교체 방법은 assets/audio/README.md 참고.
    (지금 들어있는 파일은 전부 무음 placeholder — 실제 음원을 넣기 전에는 소리가 안 난다)
*/
const SFX_SOURCES = {
  water: require("../assets/audio/sfx-water.mp3"),
  pet: require("../assets/audio/sfx-pet.wav"),
  pickup: require("../assets/audio/sfx-pickup.wav"),
  tap: require("../assets/audio/sfx-tap.wav"),
  typing: require("../assets/audio/sfx-typing.wav"),
};

export type SfxName = keyof typeof SFX_SOURCES;

/*
    소리마다 플레이어를 하나씩 만들어 두고 계속 재사용한다.
    누를 때마다 새로 만들면 첫 소리가 눈에 띄게 늦고, 앱을 쓰는 동안
    다 쓴 플레이어가 계속 쌓인다.
*/
const players: Partial<Record<SfxName, AudioPlayer>> = {};

function playerFor(name: SfxName): AudioPlayer {
  let player = players[name];
  if (!player) {
    player = createAudioPlayer(SFX_SOURCES[name]);
    players[name] = player;
  }
  return player;
}

/**
 * 효과음 한 번 재생. 볼륨이 0이면 아무것도 하지 않는다.
 *
 * 소리가 안 나는 기기·형식이어도 조용히 넘어간다 — 효과음 때문에
 * 물주기 같은 실제 동작이 막히면 안 된다.
 */
export function playSfx(name: SfxName): void {
  const { sfxVolume } = getAudioSettings();
  if (sfxVolume <= 0) return;

  try {
    const player = playerFor(name);
    player.volume = sfxVolume / VOLUME_STEPS;
    /*
        재생이 끝난 플레이어는 커서가 끝에 멈춰 있어서 play() 만으로는
        다시 나지 않는다. 연달아 누르는 경우까지 생각해 항상 처음으로 되감는다.
    */
    player
      .seekTo(0)
      .then(() => player.play())
      .catch((e: any) => console.warn("효과음 재생 실패:", e?.message));
  } catch (e: any) {
    console.warn("효과음 재생 실패:", e?.message);
  }
}

/**
 * 재생 중인 효과음을 멈춘다.
 *
 * 물소리처럼 애니메이션보다 긴 음원이 있어서, 동작이 끝났거나 화면을 벗어나면
 * 소리도 같이 끊어줘야 한다. 재생된 적 없는 소리는 그냥 넘어간다.
 */
export function stopSfx(name: SfxName): void {
  const player = players[name];
  if (!player) return;
  try {
    player.pause();
    player.seekTo(0).catch(() => {});
  } catch (e: any) {
    console.warn("효과음 정지 실패:", e?.message);
  }
}

/**
 * 버튼을 눌렀을 때의 손맛 — 소리와 진동을 함께 낸다.
 *
 * 화면에서 직접 부르지 말고 공용 버튼 컴포넌트(ActionButton 등)에 맡긴다 —
 * 버튼마다 손으로 넣으면 새 버튼에서 빠뜨리게 된다.
 *
 * 소리와 진동은 설정에서 따로 끌 수 있고, 각자 자기 스위치만 본다.
 */
export function tapFeedback(): void {
  playSfx("tap");
  hapticSelection();
}

/**
 * 선택 진동 — 버튼처럼 가볍게 짚고 넘어가는 동작용.
 *
 * impactAsync 보다 약하다. 버튼은 앱에서 가장 자주 눌리는 곳이라
 * 물주기·집어들기와 같은 세기로 울리면 금방 피곤해진다.
 */
export function hapticSelection(): void {
  if (!getAudioSettings().vibration) return;
  Haptics.selectionAsync().catch((e: any) =>
    console.warn("진동 실패:", e?.message),
  );
}

/**
 * 진동 — 설정에서 꺼두면 울리지 않는다.
 *
 * 화면에서 Haptics 를 직접 부르면 이 스위치를 빠뜨리게 되므로,
 * 진동은 전부 이 함수를 거치게 한다.
 * (햅틱이 없는 기기·시뮬레이터에서는 조용히 무시된다)
 */
export function hapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
): void {
  if (!getAudioSettings().vibration) return;
  Haptics.impactAsync(style).catch((e: any) =>
    console.warn("진동 실패:", e?.message),
  );
}
