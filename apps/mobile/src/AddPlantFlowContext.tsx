import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { getCharacterGeneration } from './api';
import { notifyCharacterGenerationReady } from './notifications';

export type AddPlantInfoDraft = {
  location: string;
  lightLevel: string;
  plantHeight: number;
  potDiameter: number;
  potType: string;
  soilNote: string;
  lastWateredAt: string;
  lastRepottedAt: string | null;
};

export type AddPlantDraft = {
  generationJobId: string | null;
  // 사용자가 생성 대기 화면을 벗어나 다른 화면을 보는 동안에도 true인 동안은
  // AddPlantFlowProvider가 대신 폴링하다가 완료되면 로컬 알림을 띄운다.
  // 화면(character.tsx)이 다시 포커스를 얻으면 스스로 폴링을 이어받으며 false로 되돌린다.
  generationBackgrounded: boolean;
  identificationPhotoUri: string | null;
  // 등록 첫 단계에서 촬영 가이드에 맞춰 받은 SDXL 캐릭터 생성용 사진.
  capturedPhotoUri: string | null;
  speciesId: number | null;
  cntntsNo: string;
  scientificName: string | null;
  commonNameKo: string;
  speciesImageUrl: string | null;
  info: AddPlantInfoDraft | null;
  characterId: string | null;
  characterImageUrl: string | null;
  characterChecksum: string;
  nickname: string;
  createdPlantId: number | null;
};

const INITIAL_DRAFT: AddPlantDraft = {
  generationJobId: null,
  generationBackgrounded: false,
  identificationPhotoUri: null,
  capturedPhotoUri: null,
  speciesId: null,
  cntntsNo: '',
  scientificName: null,
  commonNameKo: '',
  speciesImageUrl: null,
  info: null,
  characterId: null,
  characterImageUrl: null,
  characterChecksum: '',
  nickname: '',
  createdPlantId: null,
};

type AddPlantFlowValue = {
  draft: AddPlantDraft;
  updateDraft: (patch: Partial<AddPlantDraft>) => void;
  resetDraft: () => void;
  // 등록된 식물이 하나도 없을 때(=첫 등록) — character.tsx가 튜토리얼을 자동 제안할지 판단
  isFirstPlant: boolean;
};

const AddPlantFlowContext = createContext<AddPlantFlowValue | null>(null);

const BACKGROUND_POLL_INTERVAL_MS = 2000;
// 연속 오류가 이만큼 쌓이면 폴링을 멈춘다 — 잡이 만료/삭제된 경우 등 영원히
// 재시도하며 배터리를 갉아먹는 상황을 막는다. 알림 없이 조용히 멈춘다.
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

export function AddPlantFlowProvider({
  children,
  isFirstPlant = false,
}: {
  children: ReactNode;
  isFirstPlant?: boolean;
}) {
  const [draft, setDraft] = useState<AddPlantDraft>(INITIAL_DRAFT);

  /*
      사용자가 생성 대기 화면(character.tsx)을 벗어나 다른 화면을 보는 동안에도
      완료를 감지할 수 있어야 한다. Provider가 NavigationContainer 바깥, 앱
      최상위에 있어 화면 이동과 무관하게 계속 살아있으므로 여기서 대신 폴링한다.

      화면이 포커스를 다시 얻으면 자기 폴링으로 넘겨받으며 generationBackgrounded를
      false로 되돌리므로(character.tsx), 두 폴러가 동시에 도는 일은 없다.
  */
  const jobIdRef = useRef(draft.generationJobId);
  jobIdRef.current = draft.generationJobId;

  useEffect(() => {
    if (!draft.generationBackgrounded || !draft.generationJobId) return;
    const jobId = draft.generationJobId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let consecutiveErrors = 0;

    const poll = async () => {
      if (cancelled) return;
      try {
        const job = await getCharacterGeneration(jobId);
        if (cancelled || jobIdRef.current !== jobId) return;
        consecutiveErrors = 0;

        if (job.status === 'completed' || job.status === 'failed') {
          setDraft((current) =>
            current.generationJobId === jobId
              ? { ...current, generationBackgrounded: false }
              : current,
          );
          await notifyCharacterGenerationReady(job.status === 'completed');
          return;
        }
      } catch {
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          setDraft((current) =>
            current.generationJobId === jobId
              ? { ...current, generationBackgrounded: false }
              : current,
          );
          return;
        }
      }
      if (!cancelled) timer = setTimeout(poll, BACKGROUND_POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.generationBackgrounded, draft.generationJobId]);

  const value = useMemo<AddPlantFlowValue>(
    () => ({
      draft,
      updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
      resetDraft: () => setDraft(INITIAL_DRAFT),
      isFirstPlant,
    }),
    [draft, isFirstPlant],
  );

  return <AddPlantFlowContext.Provider value={value}>{children}</AddPlantFlowContext.Provider>;
}

export function useAddPlantFlow(): AddPlantFlowValue {
  const value = useContext(AddPlantFlowContext);
  if (!value) {
    throw new Error('useAddPlantFlow must be used inside AddPlantFlowProvider.');
  }
  return value;
}
