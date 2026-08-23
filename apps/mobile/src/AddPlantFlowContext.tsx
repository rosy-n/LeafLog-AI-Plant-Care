import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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
};

const AddPlantFlowContext = createContext<AddPlantFlowValue | null>(null);

export function AddPlantFlowProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<AddPlantDraft>(INITIAL_DRAFT);

  const value = useMemo<AddPlantFlowValue>(
    () => ({
      draft,
      updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
      resetDraft: () => setDraft(INITIAL_DRAFT),
    }),
    [draft],
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
