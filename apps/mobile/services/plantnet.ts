import type { PlantNetResult } from '../types/plant';

const API_KEY = process.env.EXPO_PUBLIC_PLANTNET_API_KEY ?? '';
const BASE_URL = 'https://my-api.plantnet.org/v2/identify/all';

export async function identifyPlant(
  imageUri: string,
  organ: string = 'auto',
): Promise<PlantNetResult[]> {
  const formData = new FormData();
  formData.append('images', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'plant.jpg',
  } as any);
  formData.append('organs', organ);

  const url = `${BASE_URL}?api-key=${API_KEY}&lang=en&include-related-images=true`;

  const res = await fetch(url, { method: 'POST', body: formData });

  if (!res.ok) throw new Error(`식물 인식 요청 실패 (${res.status})`);

  const data = await res.json();
  const results: any[] = data.results ?? [];

  if (results.length === 0 || results[0].score < 0.1) return [];

  return results.slice(0, 3).map((r): PlantNetResult => ({
    score: r.score,
    scientificName: r.species?.scientificNameWithoutAuthor ?? '',
    commonNames: ((r.species?.commonNames ?? []) as string[]).slice(0, 2),
    family: r.species?.family?.scientificNameWithoutAuthor ?? '',
    iucnCategory: r.iucn?.category ?? null,
    referenceImages: ((r.images ?? []) as any[]).map((img) => ({ url: img.url?.m ?? '' })),
  }));
}
