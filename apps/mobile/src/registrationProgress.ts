import type { AddPlantDraft, GenerationProgress } from './AddPlantFlowContext';

export type RegistrationProgressView = {
  jobId: string;
  /** 'working' | 'completed' | 'failed' */
  outcome: 'working' | 'completed' | 'failed';
  percent: number;
  title: string;
  hint: string;
  /** 정원 목록 카드처럼 좁은 자리에 쓰는 짧은 이름 */
  shortLabel: string;
};

/**
 * 진행 중인 등록을 화면에 보여줄 값으로 정리한다.
 *
 * 하단 진행 알림과 정원 목록의 마지막 칸이 같은 값을 쓰도록 한곳에 모았다.
 * 등록이 끝났거나(createdPlantId) 진행 중인 작업이 없으면 null.
 */
export function registrationProgressView(
  draft: AddPlantDraft,
  generation: GenerationProgress | null,
): RegistrationProgressView | null {
  const jobId = draft.generationJobId;
  if (!jobId || draft.createdPlantId) return null;

  const live = generation && generation.jobId === jobId ? generation : null;
  const outcome = live
    ? (live.status === 'completed' || live.status === 'failed' ? live.status : null)
    : draft.generationOutcome;

  if (outcome === 'failed') {
    return { jobId, outcome: 'failed', percent: 100, shortLabel: '생성 실패',
      title: '캐릭터를 만들지 못했어요', hint: '눌러서 다시 시도하기' };
  }
  if (outcome === 'completed') {
    return { jobId, outcome: 'completed', percent: 100, shortLabel: '완성! 고르기',
      title: '도트 캐릭터가 완성됐어요!', hint: draft.commonNameKo && draft.info
        ? '눌러서 캐릭터 고르기' : '눌러서 식물 등록 이어가기' };
  }
  const reported = Number.isFinite(live?.progress) ? (live as GenerationProgress).progress : 0;
  return {
    jobId,
    outcome: 'working',
    // 아직 끝나지 않았는데 100%로 보이면 다 된 줄 알고 기다리게 된다.
    percent: Math.max(0, Math.min(99, Math.round(reported))),
    title: '도트 캐릭터를 만들고 있어요',
    hint: live?.message || '잠시만 기다려주세요',
    shortLabel: '만드는 중…',
  };
}
