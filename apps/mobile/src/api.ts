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
  // 애정도 — 정원 목록 하트/호감도순 정렬용 (돌봄 기록에서 서버가 계산)
  affinity_score: number;
  affinity_hearts: number;
  affinity_level: number;
  // 개체에 적용된 꾸미기. *_url 이 null 이면 item_key 로 번들 이미지(src/data/decor.js)를 쓴다.
  // decoration_* 는 착용 액세서리(없으면 null), background_* 는 개체탭 배경(기본 배경 키)
  decoration_item_key: string | null;
  decoration_sprite_url: string | null;
  background_item_key: string | null;
  background_image_url: string | null;
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

export type CharacterGenerationCandidate = {
  id: string;
  image_url: string;
  checksum: string;
  seed: number;
};

export type CharacterGenerationJob = {
  id: string;
  status:
    | "queued"
    | "preprocessing"
    | "starting_gpu"
    | "generating"
    | "postprocessing"
    | "completed"
    | "failed";
  progress: number;
  message: string;
  current_candidate: number;
  candidate_count: number;
  candidates: CharacterGenerationCandidate[];
  error: string | null;
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
  // 정원탭의 별 — 서버가 원본이라 앱을 다시 켜도 유지된다
  is_favorite?: boolean;
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

// 애정도 현황 — 점수 규칙(상호작용별 점수, 하트 환산)은 서버(app/affinity.py)가 단일 출처.
// 앱은 이 응답을 그대로 표시하고 점수표를 다시 정의하지 않는다.
export type AffinityStatus = {
  score: number;
  // 0~5, 0.5 단위 — HeartsRow가 빈/반/가득 하트로 그린다
  hearts: number;
  // 꽉 찬 하트 수 = 해금된 꾸미기 아이템 단계 (0~5)
  level: number;
  max_score: number;
  max_hearts: number;
  // 단계별 누적 기준 점수 (Lv1~Lv5). 단계가 올라갈수록 간격이 넓어진다
  level_thresholds: number[];
  // 다음 단계에 필요한 총점. 만점이면 null
  next_level_score: number | null;
  level_progress_pct: number;
};

// 돌봄 기록 저장 응답 — 이 기록으로 얻은 애정도가 함께 온다.
// affinity_awarded === 0 이면 그날 같은 종류를 이미 기록했거나 만점이라 점수가 오르지 않은 것.
export type CareRecordCreated = CareRecordItem & {
  affinity_awarded: number;
  affinity: AffinityStatus;
};

// 개체의 애정도 현황
export function getPlantAffinity(plantId: number) {
  return request<AffinityStatus>(`/api/plants/${plantId}/affinity`);
}

export type AffinityAward = {
  affinity_awarded: number;
  affinity: AffinityStatus;
};

// 캐릭터 문지르기 — 하루 한 번 소량의 애정도를 받는다.
// 이미 오늘 받았거나 만점이면 affinity_awarded 가 0으로 온다 (에러가 아니다).
export function petPlant(plantId: number) {
  return request<AffinityAward>(`/api/plants/${plantId}/pet`, {
    method: "POST",
  });
}

// 꾸미기 아이템 — 이름·해금 단계·이미지 모두 서버(item 테이블)가 단일 출처다.
// *_url 이 null 이면 아직 S3에 이미지가 없다는 뜻 → item_key 로 번들 이미지를 쓴다.
export type Item = {
  id: number;
  item_key: string;
  item_name: string;
  item_type: "ACCESSORY" | "BACKGROUND";
  // 해금에 필요한 꽉 찬 하트 수 (0 = 기본 제공)
  required_level: number;
  // 목록 카드 이미지 (액세서리 아이콘 / 배경 미리보기)
  image_url: string | null;
  // 그 액세서리를 착용한 캐릭터 이미지. 배경은 항상 null
  sprite_url: string | null;
};

export function getItems(itemType?: "ACCESSORY" | "BACKGROUND") {
  const query = itemType ? `?item_type=${itemType}` : "";
  return request<Item[]>(`/api/items${query}`);
}

// 개체가 착용 중인 액세서리. 착용 안 했으면 필드가 모두 null.
export type PlantDecoration = {
  item_id: number | null;
  item_key: string | null;
  sprite_url: string | null;
};

// 개체탭 배경 — 액세서리와 같이 개체마다 적용되고 그 개체의 애정도로 해금된다.
// 고르지 않았으면 item_id 는 null 이고 item_key 는 기본 배경("home-bg")이 온다.
export type PlantBackground = {
  item_id: number | null;
  item_key: string | null;
  image_url: string | null;
};

export function getPlantBackground(plantId: number) {
  return request<PlantBackground>(`/api/plants/${plantId}/background`);
}

// 배경 변경(itemId) 또는 기본으로 되돌리기(null). 해금 검증은 서버가 하고 못 미치면 403.
export function setPlantBackground(plantId: number, itemId: number | null) {
  return request<PlantBackground>(`/api/plants/${plantId}/background`, {
    method: "PUT",
    body: JSON.stringify({ item_id: itemId }),
  });
}

export function getPlantDecoration(plantId: number) {
  return request<PlantDecoration>(`/api/plants/${plantId}/decoration`);
}

// 액세서리 착용(itemId) 또는 해제(null).
// 해금(애정도 단계) 검증은 서버가 하고, 못 미치면 403이 온다.
export function setPlantDecoration(plantId: number, itemId: number | null) {
  return request<PlantDecoration>(`/api/plants/${plantId}/decoration`, {
    method: "PUT",
    body: JSON.stringify({ item_id: itemId }),
  });
}

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
  return request<CareRecordCreated>(`/api/plants/${plantId}/care-records`, {
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

export type CurrentUser = AuthResponse["user"];

// 내 프로필 수정 (설정 화면의 이름 변경).
// 닉네임 규칙은 회원가입과 같아서(2~10자, 한글/영문/숫자) 어기면 서버가 400을 준다.
export function updateMe(body: { nickname: string }) {
  return request<CurrentUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// 계정 삭제 — 개체·돌봄 기록·상담 내역까지 서버에서 함께 지워지고 되돌릴 수 없다.
// 본인 확인용으로 로그인 비밀번호를 다시 보낸다 (틀리면 401).
// 성공하면 토큰이 가리키는 사용자가 사라지므로 호출한 쪽에서 로그아웃 처리를 해야 한다.
export function deleteMe(password: string) {
  return request<null>("/auth/me", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

// 설정 화면의 문의하기 — 지원 메일함으로 전달된다.
// 보낸 사람 정보는 서버가 토큰에서 꺼내므로 본문만 보낸다.
// 메일 설정이 안 돼 있으면 503, 발송 실패면 502 가 온다.
export function sendInquiry(content: string) {
  return request<null>("/api/inquiries", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
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

// Qwen에게 근거로 넘긴, CLIP 임베딩으로 검색한 유사 사례 — "RAG 검색 결과" 토글용
export type DiagnosisSimilarCase = {
  score: number;
  plant_species: string | null;
  symptom_group: string | null;
  suspected_cause: string | null;
  plant_part: string | null;
  // 레퍼런스 이미지가 아직 media_asset에 적재되지 않았으면 null — 그때는 텍스트만 보여준다
  image_url: string | null;
};

export type DiagnosisResult = {
  diagnosis: string;
  // chat_session.session_id — 같은 상담을 이어가려면 다음 호출에 그대로 넘긴다.
  session_id: number;
  // 사진 없이(symptom_text만으로) 상담한 턴은 빈 배열
  similar_cases: DiagnosisSimilarCase[];
  // RAG 코퍼스 전체 크기("전체 N장 중 몇 건 매칭" 표시용) — 검색을 안 한 턴은 null
  reference_dataset_size: number | null;
};

// 병해충/증상 상담 — CLIP 검색 + Qwen 생성이 한 번에 돌기 때문에 수초~수십초 걸릴 수 있다.
// image가 없으면(자연어만 입력) 서버가 CLIP/Qdrant 검색을 건너뛰고 symptomText만으로 답변한다 —
// 이 경우 symptomText는 필수.
// plantId가 있으면(개체 상세에서 진입한 경우) 서버가 그 개체의 종 관리 기준·물주기 일정을 답변에 참고한다.
// sessionId가 없으면 서버가 새 상담 세션을 만들어 응답에 session_id로 돌려준다 — 같은 화면 안에서
// 이어지는 질문은 그 값을 그대로 넘겨야 이전 대화 맥락(chat_message 이력)이 유지된다.
export function diagnosePlantPhoto(
  image: UploadableImage | null,
  symptomText?: string,
  plantId?: number,
  sessionId?: number,
) {
  const formData = image ? createImageFormData(image) : new FormData();
  if (symptomText) formData.append("symptom_text", symptomText);
  if (plantId != null) formData.append("plant_id", String(plantId));
  if (sessionId != null) formData.append("session_id", String(sessionId));
  return requestForm<DiagnosisResult>("/api/diagnosis", formData);
}

// 상담 기록(chat_session, session_type=DIAGNOSIS) 목록 카드용 — preview는 마지막 답변 일부
export type ConsultationSummary = {
  id: number;
  title: string | null;
  preview: string | null;
  started_at: string;
  updated_at: string;
};

// 특정 식물의 과거 진단 상담 목록 (최근 순, 토큰 자동 첨부)
export function listConsultations(plantId: number) {
  return request<ConsultationSummary[]>(`/api/plants/${plantId}/consultations`);
}

export type ConsultationMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  // 사진과 함께 보낸 메시지만 값이 있음
  image_url: string | null;
  // assistant 메시지가 진단 당시 참고한 RAG 유사 사례 — 저장돼 있어서 과거 상담도 다시 볼 수 있음
  similar_cases: DiagnosisSimilarCase[];
  // 그 진단 시점의 RAG 코퍼스 전체 크기 (DiagnosisResult와 동일한 의미)
  reference_dataset_size: number | null;
  created_at: string;
};

export type ConsultationDetail = {
  id: number;
  title: string | null;
  plant_id: number | null;
  started_at: string;
  updated_at: string;
  messages: ConsultationMessage[];
};

// 상담 기록 상세(메시지 전체 + 사진 URL), 토큰 자동 첨부
export function getConsultation(sessionId: number) {
  return request<ConsultationDetail>(`/api/consultations/${sessionId}`);
}

// 상담 기록 삭제 — 세션과 그 안의 메시지 전체를 지운다 (되돌릴 수 없음)
export function deleteConsultation(sessionId: number) {
  return request<null>(`/api/consultations/${sessionId}`, { method: "DELETE" });
}

export function startCharacterGeneration(image: UploadableImage) {
  return requestForm<CharacterGenerationJob>(
    "/api/character-generations",
    createImageFormData(image),
  );
}

export function getCharacterGeneration(jobId: string) {
  return request<CharacterGenerationJob>(
    `/api/character-generations/${encodeURIComponent(jobId)}`,
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
