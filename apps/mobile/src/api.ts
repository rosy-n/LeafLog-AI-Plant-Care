import Constants from "expo-constants";

import type { NewPlantPayload } from "../types/plant";

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: {
    id: number;
    email: string;
    nickname: string;
  };
};

export type AvailabilityResponse = {
  available: boolean;
};

export type PlantResponse = {
  id: number;
  nickname: string;
  common_name_ko: string;
  created_at: string;
};

export type PlantListItem = {
  id: number;
  nickname: string;
  common_name_ko: string | null;
  location_name: string | null;
  light_condition: string | null;
  is_favorite: boolean;
  status: string;
  character_image_url: string | null;
  persona: string | null;
  created_at: string;
  // 물주기 일정 요약 — 알림 목록·배지·알림 재예약이 개체마다 조회하지 않도록 함께 온다
  watering_interval_days: number | null;
  next_watering_date: string | null;
  days_until_watering: number | null;
};

// 로그인/회원가입 후 받은 액세스 토큰을 앱 전역에서 공유 (메모리 보관)
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export type PlantImagePreprocessResponse = {
  canvas_size: number;
  sdxl_input_png_base64: string;
  transparent_png_base64: string;
};

export type BackgroundRemovalResponse = {
  canvas_size: number;
  transparent_png_base64: string;
};

export type UploadableImage = {
  uri: string;
  name?: string;
  type?: string;
};

// EXPO_PUBLIC_API_BASE_URL이 명시돼 있으면 그 값을 우선 사용(터널 모드 등).
// 없으면 Expo Go가 이미 연결된 Metro 번들러의 호스트 IP를 그대로 재사용해서
// Wi-Fi가 바뀌어도 .env를 매번 고치지 않아도 되게 한다.
function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:8000`;

  return "http://localhost:8000";
}

const API_BASE_URL = resolveApiBaseUrl();

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error(
      "서버에 연결할 수 없어요. 백엔드가 켜져 있고 API 주소가 휴대폰에서 접근 가능한 PC IP인지 확인해주세요.",
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && typeof detail[0]?.msg === "string"
          ? detail[0].msg.replace(/^Value error,\s*/, "")
          : "요청 처리 중 오류가 발생했어요.";
    throw new Error(message);
  }

  return data as T;
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      body: formData,
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
  } catch {
    throw new Error(
      "서버에 연결할 수 없습니다. 백엔드 서버와 API 주소를 확인해주세요.",
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && typeof detail[0]?.msg === "string"
          ? detail[0].msg.replace(/^Value error,\s*/, "")
          : "이미지 처리 중 오류가 발생했습니다.";
    throw new Error(message);
  }

  return data as T;
}

function createImageFormData(image: UploadableImage): FormData {
  const formData = new FormData();
  formData.append("file", {
    uri: image.uri,
    name: image.name || "plant-photo.jpg",
    type: image.type || "image/jpeg",
  } as unknown as Blob);
  return formData;
}

export function signup(payload: {
  email: string;
  password: string;
  nickname: string;
  marketing_opt_in?: boolean;
}) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// 종 마스터 (plant_species) — 등록 1단계 검색은 외부 API 대신 이 엔드포인트를 사용
// ---------------------------------------------------------------------------

export type SpeciesListItem = {
  species_id: number;
  common_name_ko: string;
  common_name_en: string | null;
  scientific_name: string | null;
  family_name: string | null;
  image_url: string | null;
  difficulty: string;
};

export type SpeciesDetail = {
  species_id: number;
  common_name_ko: string;
  common_name_en: string | null;
  scientific_name: string | null;
  family_name: string | null;
  genus_name: string | null;
  category: string | null;
  description: string | null;
  origin: string | null;
  origin_country: string | null;
  distribution: string | null;
  difficulty: string;
  light_level: string;
  light_min_lux: number | null;
  light_max_lux: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  temp_min_winter_c: number | null;
  humidity_min_pct: number | null;
  humidity_max_pct: number | null;
  watering_interval_days: number | null;
  size_raw: string | null;
  height_min_cm: number | null;
  height_max_cm: number | null;
  flowering_period: string | null;
  fruiting_period: string | null;
  is_toxic: boolean;
  // null = 해당 동물 자료 없음
  toxic_to_dogs: boolean | null;
  toxic_to_cats: boolean | null;
  toxic_to_horses: boolean | null;
  toxicity_info: string | null;
  bug_info: string | null;
  care_tips: string | null;
  image_url: string | null;
  // 돌보기 정보 화면이 카드별로 쓰는 원문 (농사로 원문, 없으면 null)
  water_cycle_label: string | null;
  light_label: string | null;
  fertilizer_info: string | null;
  soil_info: string | null;
  special_manage_info: string | null;
  placement: string | null;
  propagation: string | null;
  growth_rate: string | null;
  flower_color_names: string | null;
  // 출처 표기용 — KFS_STD / RDA_INDOOR / ASPCA / NATURE_KNA
  sources: string[];
};

// 국명·영문명·학명 부분검색 (토큰 자동 첨부)
export function searchSpecies(keyword: string, limit = 20) {
  return request<SpeciesListItem[]>(
    `/api/species?q=${encodeURIComponent(keyword)}&limit=${limit}`,
  );
}

// 종 상세 — 4개 소스를 병합해 둔 돌봄 정보
export function getSpecies(speciesId: number) {
  return request<SpeciesDetail>(`/api/species/${speciesId}`);
}

// 로그인 토큰 필요 (setAuthToken으로 저장된 값이 자동 첨부됨)
export function createPlant(payload: NewPlantPayload) {
  return request<PlantResponse>("/api/plants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 현재 로그인 사용자의 식물 목록 (토큰 자동 첨부)
export function getPlants() {
  return request<PlantListItem[]>("/api/plants");
}

export type PlantDetail = {
  id: number;
  nickname: string;
  common_name_ko: string | null;
  scientific_name: string | null;
  // 종 마스터의 돌봄 정보 — 돌보기 정보 화면이 읽는다.
  // 종이 연결되지 않았거나 마스터에 값이 없으면 null
  species: SpeciesDetail | null;
  status: string;
  location_name: string | null;
  light_condition: string | null;
  pot_type: string | null;
  pot_size: string | null;
  soil_type: string | null;
  height: string | null;
  is_favorite: boolean;
  character_image_url: string | null;
  persona: string | null;
  started_at: string | null;
  created_at: string;
  temp_min_c: number | null;
  temp_max_c: number | null;
  humidity_min_pct: number | null;
  humidity_max_pct: number | null;
};

// 특정 식물의 상세 정보 (토큰 자동 첨부)
export function getPlant(plantId: number) {
  return request<PlantDetail>(`/api/plants/${plantId}`);
}

export type PlantUpdate = {
  // 종을 다시 고르는 경우 (인식이 어긋났거나 마스터 도입 전에 등록한 개체)
  species_id?: number;
  nickname?: string;
  status?: string;
  location_name?: string | null;
  pot_type?: string | null;
  pot_size?: string | null;
  height?: string | null;
  persona?: string;
};

// 식물 프로필 부분 수정 (토큰 자동 첨부)
export function updatePlant(plantId: number, body: PlantUpdate) {
  return request<PlantDetail>(`/api/plants/${plantId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type CareSummary = {
  last_watered_at: string | null;
  days_since_watering: number | null;
  last_fertilized_at: string | null;
  days_since_fertilizing: number | null;
  last_repotted_at: string | null;
  days_since_repotting: number | null;
  // 물주기 일정. watering_schedule_saved 가 false 면 저장된 일정이 아직 없어 계산만 한 값.
  // watering_interval_source 는 주기의 근거 —
  //   SPECIES(종 권장값) / DEFAULT(자료 없어 앱 기본값 7일) / USER(사용자 설정)
  watering_interval_days: number | null;
  watering_interval_source: "SPECIES" | "DEFAULT" | "USER" | null;
  next_watering_date: string | null;
  days_until_watering: number | null;
  watering_schedule_saved: boolean;
};

// 특정 식물의 최근 물주기/분갈이 요약 (토큰 자동 첨부)
// 물주기 주기 변경. intervalDays=null 이면 권장값(종 값 또는 앱 기본값)으로 되돌린다.
// 비료·분갈이는 일정으로 관리하지 않아 물주기 전용이다.
export function updateWateringSchedule(plantId: number, intervalDays: number | null) {
  return request<CareSummary>(`/api/plants/${plantId}/watering-schedule`, {
    method: "PATCH",
    body: JSON.stringify({ interval_days: intervalDays }),
  });
}

export function getPlantCare(plantId: number) {
  return request<CareSummary>(`/api/plants/${plantId}/care`);
}

export type CareRecordItem = {
  id: number;
  care_type: string;
  completed_at: string;
  note: string | null;
};

// 특정 식물의 관리 기록 목록 (care_type: WATERING | FERTILIZING | REPOTTING)
export function getCareRecords(plantId: number, careType: string) {
  return request<CareRecordItem[]>(
    `/api/plants/${plantId}/care-records?care_type=${encodeURIComponent(careType)}`,
  );
}

export function createCareRecord(
  plantId: number,
  body: { care_type: string; note?: string | null; completed_at?: string },
) {
  return request<CareRecordItem>(`/api/plants/${plantId}/care-records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteCareRecord(plantId: number, recordId: number) {
  return request<null>(`/api/plants/${plantId}/care-records/${recordId}`, {
    method: "DELETE",
  });
}

export function login(payload: { email: string; password: string }) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkEmail(email: string) {
  return request<AvailabilityResponse>(
    `/auth/check-email?email=${encodeURIComponent(email)}`,
  );
}

export function preprocessPlantImage(
  image: UploadableImage,
  canvasSize = 1024,
  qualityMode: "fast" | "quality" = "quality",
) {
  return requestForm<PlantImagePreprocessResponse>(
    `/images/preprocess-plant?canvas_size=${canvasSize}&quality_mode=${qualityMode}`,
    createImageFormData(image),
  );
}

export function removeGeneratedImageBackground(
  image: UploadableImage,
  canvasSize = 1024,
  qualityMode: "fast" | "quality" = "quality",
) {
  return requestForm<BackgroundRemovalResponse>(
    `/images/remove-background?canvas_size=${canvasSize}&quality_mode=${qualityMode}`,
    createImageFormData(image),
  );
}

export type PersonaOption = {
  slug: string;
  label: string;
};

// 선택 가능한 페르소나 8종 (slug/한글 라벨) — 서버의 persona_chat.PERSONA_NAMES가 단일 출처
export function getPersonas() {
  return request<PersonaOption[]>("/api/personas");
}

export type PersonaChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type PersonaChatResult = {
  reply: string;
  persona: string;
};

// 캐릭터 대화 한 턴 호출 — 서버는 대화 기록을 저장하지 않으므로 history에는 최근 5턴(최대 10개)만 실어 보낸다.
// 식물에 persona가 아직 설정되지 않았으면 서버가 400을 반환한다 (updatePlant로 먼저 설정 필요).
export function personaChat(
  plantId: number,
  message: string,
  history: PersonaChatTurn[] = [],
) {
  return request<PersonaChatResult>(`/api/plants/${plantId}/persona-chat`, {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export type UserSettingResponse = {
  // region_data.Region.name과 정확히 일치하는 "서울특별시 마포구" 형태, 미설정이면 null
  default_location: string | null;
};

// 현재 위치 설정 조회 — 미설정이면 default_location: null (400이 아님)
export function getUserSettings() {
  return request<UserSettingResponse>("/api/settings");
}

// GPS 좌표로 위치 설정/변경 — 서버가 가장 가까운 시/군/구를 찾아 저장한다
export function updateUserLocation(lat: number, lng: number) {
  return request<UserSettingResponse>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({ lat, lng }),
  });
}

export type CurrentEnvironmentResponse = {
  location_name: string;
  weather_status: string;
  air_quality_status: string;
  temperature_c: number;
  humidity_pct: number;
  pm10_value: number | null;
  pm25_value: number | null;
  khai_value: number | null;
  observed_at: string;
};

// 현재 날씨/대기질 — 위치 미설정이면 서버가 400을 반환한다 (위치 설정 화면으로 유도)
export function getCurrentEnvironment() {
  return request<CurrentEnvironmentResponse>("/api/environment/current");
}

export type WeatherHistoryPoint = {
  observed_at: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  weather_status: string | null;
};

export type AirQualityHistoryPoint = {
  observed_at: string;
  pm10: number | null;
  pm25: number | null;
  air_quality_status: string | null;
};

export type EnvironmentHistoryResponse = {
  weather_points: WeatherHistoryPoint[];
  air_quality_points: AirQualityHistoryPoint[];
};

// 센서데이터탭 그래프용 — "day"는 그때그때 기상청 실황을 재구성, "week"/"month"는 누적 기록
export function getEnvironmentHistory(period: "day" | "week" | "month" = "day") {
  return request<EnvironmentHistoryResponse>(`/api/environment/history?period=${period}`);
}
