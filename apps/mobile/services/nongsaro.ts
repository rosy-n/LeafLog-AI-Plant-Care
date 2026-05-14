import { XMLParser } from 'fast-xml-parser';
import type { DifficultyLevel, LightLevel, NongsaroPlant, NongsaroPlantDetail } from '../types/plant';
import {
  GROWTH_TEMP_LABEL,
  HUMIDITY_LABEL,
  LIGHT_LEVEL_MAP,
  MANAGE_LEVEL_CODE,
  parseCodes,
  PEST_CODE,
  WATER_CYCLE_INTERVAL_DAYS,
} from '../constants/nongsaro-codes';

const API_KEY = process.env.EXPO_PUBLIC_NONGSARO_API_KEY ?? '';
const BASE_URL = 'http://api.nongsaro.go.kr/service/garden';

// parseTagValue: false → 숫자형 resultCode("00")를 문자열로 유지
const parser = new XMLParser({ parseTagValue: false });

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function assertResultCode(code: string): void {
  if (code !== '00') throw new Error(`농사로 API 오류 (${code})`);
}

// ---------------------------------------------------------------------------
// searchPlants — gardenList
// ---------------------------------------------------------------------------

export async function searchPlants(keyword: string): Promise<NongsaroPlant[]> {
  const url =
    `${BASE_URL}/gardenList` +
    `?apiKey=${API_KEY}` +
    `&sType=sCntntsSj` +
    `&sText=${encodeURIComponent(keyword)}` +
    `&numOfRows=10` +
    `&pageNo=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`네트워크 오류: ${res.status}`);

  const { response } = parser.parse(await res.text());
  assertResultCode(response.header.resultCode);

  return toArray<any>(response.body?.items?.item).map(
    (item): NongsaroPlant => ({
      cntntsNo: String(item.cntntsNo),
      cntntsSj: item.cntntsSj ?? '',
      rtnThumbFileUrl: item.rtnThumbFileUrl ?? null,
    }),
  );
}

// ---------------------------------------------------------------------------
// getPlantDetail — gardenDtl
// ---------------------------------------------------------------------------

export async function getPlantDetail(cntntsNo: string): Promise<NongsaroPlantDetail> {
  const url = `${BASE_URL}/gardenDtl?apiKey=${API_KEY}&cntntsNo=${cntntsNo}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`네트워크 오류: ${res.status}`);

  const { response } = parser.parse(await res.text());
  assertResultCode(response.header.resultCode);

  const items = toArray<any>(response.body?.items?.item);
  if (items.length === 0) throw new Error('식물 상세 정보를 찾을 수 없어요.');
  const item = items[0];

  return {
    cntntsNo,
    commonNameKo: item.distbNm || item.cntntsSj || '',
    commonNameEn: item.plntzrNm || null,
    scientificName: item.plntbneNm ?? '',
    difficulty: ((MANAGE_LEVEL_CODE as Record<string, DifficultyLevel>)[item.managelevelCode]) ?? null,
    lightLevel: (LIGHT_LEVEL_MAP[item.lighttdemanddoCode] as LightLevel) ?? null,
    tempRange: GROWTH_TEMP_LABEL[item.grwhTpCode] ?? null,
    humidityRange: HUMIDITY_LABEL[item.hdCode] ?? null,
    wateringDays: WATER_CYCLE_INTERVAL_DAYS[item.watercycleSprngCode] ?? null,
    pests: parseCodes(item.dlthtsCode, PEST_CODE),
    isToxic: Boolean(item.toxctyInfo),
    toxicityInfo: item.toxctyInfo || null,
    imageUrls: [],
  };
}

// ---------------------------------------------------------------------------
// getPlantImages — gardenFileList
// ---------------------------------------------------------------------------

export async function getPlantImages(
  cntntsNo: string,
): Promise<{ url: string; thumbUrl: string }[]> {
  const url = `${BASE_URL}/gardenFileList?apiKey=${API_KEY}&cntntsNo=${cntntsNo}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`네트워크 오류: ${res.status}`);

  const { response } = parser.parse(await res.text());
  assertResultCode(response.header.resultCode);

  return toArray<any>(response.body?.items?.item).map((item) => ({
    url: item.rtnFileUrl ?? '',
    thumbUrl: item.rtnThumbFileUrl ?? '',
  }));
}
