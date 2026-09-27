import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState } from 'react-native';

import { getCharacterGeneration } from './api';
import { notifyCharacterGenerationReady } from './notifications';
import { loadRegistrationDraft, saveRegistrationDraft } from './registrationStorage';

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

export type AddPlantInfoInput = {
  location: string | null;
  lightLevel: string | null;
  plantHeight: string;
  potDiameter: string;
  potType: string | null;
  soilNote: string;
  lastWatered: { month: number; day: number } | null;
  lastRepotted: { month: number; day: number } | null;
};

export type AddPlantDraft = {
  generationJobId: string | null;
  notifiedJobId: string | null;
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
  infoInput: AddPlantInfoInput | null;
  speciesSearch: string;
  characterId: string | null;
  characterImageUrl: string | null;
  characterChecksum: string;
  nickname: string;
  createdPlantId: number | null;
  // 앱을 껐다 켰을 때도 "완성/실패"를 바로 보여주기 위해 마지막 결과만 보관한다.
  generationOutcome: 'completed' | 'failed' | null;
};

// 등록 화면 밖(정원 목록·하단 진행 알림)에서도 진행 상황을 보여주기 위한 값.
// 파일에 저장하지 않고, 폴링하는 쪽(대기 화면 또는 Provider)이 계속 갱신한다.
export type GenerationProgress = {
  jobId: string;
  status: string;
  progress: number;
  message: string;
};

const INITIAL_DRAFT: AddPlantDraft = {
  generationJobId: null,
  notifiedJobId: null,
  generationBackgrounded: false,
  identificationPhotoUri: null,
  capturedPhotoUri: null,
  speciesId: null,
  cntntsNo: '',
  scientificName: null,
  commonNameKo: '',
  speciesImageUrl: null,
  info: null,
  infoInput: null,
  speciesSearch: '',
  characterId: null,
  characterImageUrl: null,
  characterChecksum: '',
  nickname: '',
  createdPlantId: null,
  generationOutcome: null,
};

type AddPlantFlowValue = {
  draft: AddPlantDraft;
  updateDraft: (patch: Partial<AddPlantDraft>) => void;
  resetDraft: () => void;
  backgroundGeneration: () => void;
  consumePreservedExit: () => boolean;
  handleRegistrationExit: () => void;
  generation: GenerationProgress | null;
  reportGeneration: (progress: GenerationProgress) => void;
  cancelGeneration: () => void;
  scope: string;
  // 등록된 식물이 하나도 없을 때(=첫 등록) — character.tsx가 튜토리얼을 자동 제안할지 판단
  isFirstPlant: boolean;
};

const AddPlantFlowContext = createContext<AddPlantFlowValue | null>(null);

const BACKGROUND_POLL_INTERVAL_MS = 2000;
const MAX_RETRY_INTERVAL_MS = 30_000;

export function AddPlantFlowProvider({
  children,
  isFirstPlant = false,
  scope,
}: {
  children: ReactNode;
  isFirstPlant?: boolean;
  scope: string;
}) {
  const [draft, setDraft] = useState<AddPlantDraft>(() => loadRegistrationDraft(scope, INITIAL_DRAFT) ?? INITIAL_DRAFT);
  const [generation, setGeneration] = useState<GenerationProgress | null>(null);
  const draftRef = useRef(draft);
  const preservedExitRef = useRef(false);
  const storageWarningRef = useRef(false);

  const updateDraft = useCallback((patch: Partial<AddPlantDraft>) => {
    const next = { ...draftRef.current, ...patch };
    if ('generationJobId' in patch && patch.generationJobId !== draftRef.current.generationJobId) {
      next.generationOutcome = null;
      next.notifiedJobId = null;
      setGeneration(null);
    }
    draftRef.current = next;
    setDraft(next);
    try {
      saveRegistrationDraft(scope, next);
    } catch {
      if (!storageWarningRef.current) {
        storageWarningRef.current = true;
        Alert.alert('임시 저장 실패', '기기 저장 공간을 확인해주세요. 앱을 종료하면 등록 내용을 복원하지 못할 수 있어요.');
      }
    }
  }, [scope]);
  const resetDraft = useCallback(() => {
    preservedExitRef.current = false;
    updateDraft(INITIAL_DRAFT);
  }, [updateDraft]);
  const backgroundGeneration = useCallback(() => {
    // Navigation can remove the screen before React commits its next render.
    preservedExitRef.current = true;
    updateDraft({ generationBackgrounded: !draftRef.current.generationOutcome });
  }, [updateDraft]);
  // 대기 화면과 Provider 폴링이 같은 값을 쓰도록 진행 상황을 한곳에 모은다.
  const reportGeneration = useCallback((progress: GenerationProgress) => {
    if (progress.jobId !== draftRef.current.generationJobId) return;
    setGeneration(current => (current && current.jobId === progress.jobId
      && current.status === progress.status && current.progress === progress.progress
      && current.message === progress.message ? current : progress));
  }, []);
  // "그만두기" — 기기에 보관한 등록 내용을 지운다. 이미 접수된 생성 작업 자체는
  // 서버에서 그대로 끝나지만, 앱은 더 이상 그 작업을 이어받지 않는다.
  const cancelGeneration = useCallback(() => {
    setGeneration(null);
    resetDraft();
  }, [resetDraft]);
  const consumePreservedExit = useCallback(() => {
    const preserve = preservedExitRef.current;
    preservedExitRef.current = false;
    return preserve;
  }, []);
  const handleRegistrationExit = useCallback(() => {
    preservedExitRef.current = false;
    const current = draftRef.current;
    if (current.generationJobId && !current.createdPlantId) {
      updateDraft({ generationBackgrounded: !current.generationOutcome });
    } else {
      resetDraft();
    }
  }, [updateDraft, resetDraft]);

  /*
      사용자가 생성 대기 화면(character.tsx)을 벗어나 다른 화면을 보는 동안에도
      완료를 감지할 수 있어야 한다. Provider가 NavigationContainer 바깥, 앱
      최상위에 있어 화면 이동과 무관하게 계속 살아있으므로 여기서 대신 폴링한다.

      화면이 포커스를 다시 얻으면 자기 폴링으로 넘겨받으며 generationBackgrounded를
      false로 되돌리므로(character.tsx), 두 폴러가 동시에 도는 일은 없다.
  */
  useEffect(() => {
    if (!draft.generationBackgrounded || !draft.generationJobId) return;
    const jobId = draft.generationJobId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let requestVersion = 0;
    let finished = false;
    let consecutiveErrors = 0;

    const poll = async () => {
      if (cancelled || finished || (AppState.currentState && AppState.currentState !== 'active')) return;
      const version = ++requestVersion;
      controller = new AbortController();
      try {
        const job = await getCharacterGeneration(jobId, controller.signal);
        if (cancelled || requestVersion !== version || draftRef.current.generationJobId !== jobId) return;
        consecutiveErrors = 0;
        reportGeneration({
          jobId,
          status: job.status,
          progress: Number.isFinite(job.progress) ? job.progress : 0,
          message: job.message || '',
        });

        if (job.status === 'completed' || job.status === 'failed') {
          if (draftRef.current.notifiedJobId !== jobId) {
            // Notification delivery must not prevent saving a completed result.
            try { await notifyCharacterGenerationReady(job.status === 'completed', { jobId, scope }); } catch { /* The garden card remains available. */ }
            if (cancelled || requestVersion !== version || draftRef.current.generationJobId !== jobId) return;
          }
          finished = true;
          updateDraft({ generationBackgrounded: false, notifiedJobId: jobId, generationOutcome: job.status });
          return;
        }
      } catch (error: any) {
        if (cancelled || requestVersion !== version || draftRef.current.generationJobId !== jobId) return;
        if ([401, 403, 404, 410].includes(error?.status)) {
          finished = true;
          reportGeneration({ jobId, status: 'failed', progress: 0, message: '생성 상태를 확인하지 못했어요' });
          updateDraft({ generationBackgrounded: false, generationOutcome: 'failed' });
          Alert.alert('생성 작업 확인', '생성 상태를 확인할 수 없어요. 로그인 상태를 확인한 뒤 식물 등록에서 다시 확인해주세요.');
          return;
        }
        consecutiveErrors += 1;
      }
      if (!cancelled) timer = setTimeout(poll, Math.min(MAX_RETRY_INTERVAL_MS,
        BACKGROUND_POLL_INTERVAL_MS * 2 ** Math.min(consecutiveErrors, 4)));
    };

    poll();
    const subscription = AppState.addEventListener('change', state => {
      clearTimeout(timer);
      requestVersion += 1;
      controller?.abort();
      if (state === 'active') {
        consecutiveErrors = 0;
        poll();
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
      subscription.remove();
    };
  }, [draft.generationBackgrounded, draft.generationJobId, scope, updateDraft, reportGeneration]);

  const value = useMemo<AddPlantFlowValue>(
    () => ({
      draft,
      updateDraft,
      resetDraft,
      backgroundGeneration,
      consumePreservedExit,
      handleRegistrationExit,
      generation,
      reportGeneration,
      cancelGeneration,
      scope,
      isFirstPlant,
    }),
    [draft, generation, isFirstPlant, scope, updateDraft, resetDraft, backgroundGeneration,
      consumePreservedExit, handleRegistrationExit, reportGeneration, cancelGeneration],
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
