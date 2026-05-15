import type { PlantNetResult } from '../types/plant';

const API_KEY = process.env.EXPO_PUBLIC_PLANTNET_API_KEY ?? '';
const BASE_URL = 'https://my-api.plantnet.org/v2/identify/all';

export async function identifyPlant(
  imageUris: string | string[],
  organs: string | string[] = 'auto',
): Promise<PlantNetResult[]> {
  const uriList = Array.isArray(imageUris) ? imageUris : [imageUris];
  const organList = Array.isArray(organs) ? organs : Array(uriList.length).fill(organs);

  const formData = new FormData();
  uriList.forEach((uri, i) => {
    formData.append('images', { uri, type: 'image/jpeg', name: `plant_${i}.jpg` } as any);
    formData.append('organs', organList[i] ?? 'auto');
  });

  const url = `${BASE_URL}?api-key=${API_KEY}&lang=en&include-related-images=true`;
  const res = await fetch(url, { method: 'POST', body: formData });

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    console.error('[PlantNet raw error]', detail);
    throw new Error(`식물 인식 요청 실패 (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const results: any[] = data.results ?? [];

  if (results.length === 0) return [];

  return results.slice(0, 3).map((r): PlantNetResult => ({
    score: r.score,
    scientificName: r.species?.scientificNameWithoutAuthor ?? '',
    commonNames: ((r.species?.commonNames ?? []) as string[]).slice(0, 2),
    family: r.species?.family?.scientificNameWithoutAuthor ?? '',
    iucnCategory: r.iucn?.category ?? null,
    referenceImages: ((r.images ?? []) as any[]).map((img) => ({ url: img.url?.m ?? '' })),
  }));
}
