// ---------------------------------------------------------------------------
// PlantNet API
// ---------------------------------------------------------------------------

export interface PlantNetResult {
  score: number;
  scientificName: string;
  commonNames: string[];
  family: string;
  iucnCategory: string | null;
  referenceImages: { url: string }[];
}

// ---------------------------------------------------------------------------
// 농사로 OpenAPI
// ---------------------------------------------------------------------------

export interface NongsaroPlant {
  cntntsNo: string;
  cntntsSj: string;
  rtnThumbFileUrl: string | null;
}

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
export type LightLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface NongsaroPlantDetail {
  cntntsNo: string;
  commonNameKo: string;
  commonNameEn: string | null;
  scientificName: string;
  difficulty: DifficultyLevel | null;
  lightLevel: LightLevel | null;
  tempRange: string | null;
  humidityRange: string | null;
  wateringDays: number | null;
  isToxic: boolean;
  toxicityInfo: string | null;
  pests: string[];
  imageUrls: { original: string; thumb: string }[];
}

// ---------------------------------------------------------------------------
// add-plant 4단계 전체 상태
// ---------------------------------------------------------------------------

export interface PlantSpecies {
  cntntsNo: string;
  scientificName: string | null;
  commonNameKo: string;
  detail: NongsaroPlantDetail | null;
}

export interface AddPlantState {
  // 1단계: 종 선택
  plantSpecies: PlantSpecies | null;
  plantNetResult: PlantNetResult | null;

  // 2단계: 도트 캐릭터
  capturedPhotoUri: string | null;
  characterImageUrl: string | null;

  // 3단계: 이름
  nickname: string;

  // 4단계: 개체 정보
  location: string | null;
  lightLevel: string | null;
  plantHeight: number | null;
  potDiameter: number | null;
  soilNote: string;
  lastWateredAt: Date | null;
  lastRepottedAt: Date | null;
}

// ---------------------------------------------------------------------------
// POST /api/plants 요청 바디
// ---------------------------------------------------------------------------

export interface NewPlantPayload {
  cntntsNo: string;
  scientificName: string | null;
  commonNameKo: string;
  nickname: string;
  characterImageUrl: string;
  capturedPhotoUri: string;
  location: string;
  lightLevel: string;
  plantHeight: number;
  potDiameter: number;
  soilNote: string;
  lastWateredAt: string;
  lastRepottedAt: string | null;
}
