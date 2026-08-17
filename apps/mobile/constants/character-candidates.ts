// 도트 캐릭터 후보 (add-plant 2단계)
// ─────────────────────────────────────────────────────────────
// 캐릭터 생성은 후보 3종을 만들고 사용자가 그중 하나를 고르는 흐름이다.
// FLUX 모델이 붙기 전까지는 아래 로컬 샘플 이미지를 후보로 쓰고,
// 선택 결과는 id 로만 화면 간 전달한다(`characterId` 파라미터).
//
// TODO: POST /api/character/generate 연동 시 이 목록을 응답의 후보 3종
//       ({ id, imageUrl })으로 교체하고 source(로컬 asset)는 제거한다.

import type { ImageSourcePropType } from 'react-native';

export type CharacterCandidate = {
  id: string;
  /** 후보 순번 라벨 (접근성·안내 문구용) */
  label: string;
  /** 로컬 샘플 이미지 — API 연동 후 제거 예정 */
  source: ImageSourcePropType;
  /** 서버가 준 이미지 URL. 미연동 상태에서는 빈 문자열 */
  imageUrl: string;
  checksum?: string;
};

export const CHARACTER_CANDIDATES: CharacterCandidate[] = [
  { id: 'candidate-1', label: '1번', source: require('../assets/char-sample-1.png'), imageUrl: '' },
  { id: 'candidate-2', label: '2번', source: require('../assets/char-sample-2.png'), imageUrl: '' },
  { id: 'candidate-3', label: '3번', source: require('../assets/char-sample-3.png'), imageUrl: '' },
];

export const CHARACTER_PLACEHOLDER: ImageSourcePropType =
  require('../assets/dot-character-placeholder.png');

export function getCharacterCandidate(id?: string | null): CharacterCandidate | null {
  if (!id) return null;
  return CHARACTER_CANDIDATES.find((candidate) => candidate.id === id) ?? null;
}

/** 선택된 후보 이미지 — 못 찾으면 기본 placeholder 로 폴백한다. */
export function getCharacterImageSource(id?: string | null): ImageSourcePropType {
  return getCharacterCandidate(id)?.source ?? CHARACTER_PLACEHOLDER;
}
