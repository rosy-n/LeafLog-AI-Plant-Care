import { Directory, File, Paths } from 'expo-file-system';
import type { AddPlantDraft } from './AddPlantFlowContext';

const DIRECTORY = new Directory(Paths.document, 'leaflog');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function draftFile(scope: string) {
  return new File(DIRECTORY, `registration-${encodeURIComponent(scope)}.json`);
}

export function loadRegistrationDraft(scope: string, initial: AddPlantDraft): AddPlantDraft | null {
  try {
    const file = draftFile(scope);
    if (!file.exists || file.size > 100_000) return null;
    const stored = JSON.parse(file.textSync());
    if (stored.version !== 1 || stored.scope !== scope || !Number.isFinite(stored.savedAt)
      || stored.savedAt > Date.now() + 60_000 || Date.now() - stored.savedAt > MAX_AGE_MS) return null;
    const raw = stored.draft;
    if (!raw || typeof raw.generationJobId !== 'string' || !raw.generationJobId
      || raw.generationJobId.length > 100) return null;
    const draft = { ...initial };
    for (const key of Object.keys(initial) as (keyof AddPlantDraft)[]) {
      if (key === 'info' || key === 'infoInput') continue;
      const value = raw[key];
      const valid = typeof initial[key] === 'boolean' ? typeof value === 'boolean'
        : typeof initial[key] === 'string' ? typeof value === 'string' && value.length <= 4000
        : ['speciesId', 'createdPlantId'].includes(key) ? value === null || (Number.isInteger(value) && value > 0)
        : value === null || (typeof value === 'string' && value.length <= 4000);
      if (valid) Object.assign(draft, { [key]: value });
    }
    if (draft.createdPlantId) return null;
    if (!['completed', 'failed'].includes(draft.generationOutcome ?? '')) draft.generationOutcome = null;
    const input = raw.infoInput;
    const validDate = (value: any) => value === null || (value && Number.isInteger(value.month)
      && value.month >= 1 && value.month <= 12 && Number.isInteger(value.day) && value.day >= 1 && value.day <= 31);
    if (input && ['location', 'lightLevel', 'potType'].every(key => input[key] === null
        || (typeof input[key] === 'string' && input[key].length <= 100))
      && ['plantHeight', 'potDiameter'].every(key => typeof input[key] === 'string' && /^\d{0,3}$/.test(input[key]))
      && typeof input.soilNote === 'string' && input.soilNote.length <= 80
      && validDate(input.lastWatered) && validDate(input.lastRepotted)) {
      draft.infoInput = {
        location: input.location, lightLevel: input.lightLevel, potType: input.potType,
        plantHeight: input.plantHeight, potDiameter: input.potDiameter, soilNote: input.soilNote,
        lastWatered: input.lastWatered, lastRepotted: input.lastRepotted,
      };
    }
    const info = raw.info;
    if (info && ['location', 'lightLevel', 'potType', 'soilNote', 'lastWateredAt']
      .every(key => typeof info[key] === 'string' && info[key].length <= 4000)
      && ['plantHeight', 'potDiameter'].every(key => Number.isFinite(info[key]) && info[key] >= 0)
      && (info.lastRepottedAt === null || typeof info.lastRepottedAt === 'string')) {
      draft.info = info;
    }
    // Signed result URLs expire. The result screen fetches fresh candidates by job ID.
    draft.characterImageUrl = null;
    draft.speciesImageUrl = null;
    draft.generationBackgrounded = !draft.generationOutcome;
    return draft;
  } catch {
    return null;
  }
}

export function saveRegistrationDraft(scope: string, draft: AddPlantDraft): void {
  const file = draftFile(scope);
  if (!draft.generationJobId || draft.createdPlantId) {
    if (file.exists) file.delete();
    return;
  }
  if (!DIRECTORY.exists) DIRECTORY.create({ intermediates: true });
  file.write(JSON.stringify({ version: 1, scope, savedAt: Date.now(), draft: {
    ...draft, characterImageUrl: null, speciesImageUrl: null,
  } }));
}

export function registrationResumeScreen(draft: AddPlantDraft): string {
  if (!draft.generationJobId) return 'Character';
  if (draft.generationOutcome === 'failed') return 'CharacterResult';
  if (!draft.commonNameKo) return 'AddPlantIndex';
  if (!draft.info) return 'Info';
  return 'CharacterResult';
}
