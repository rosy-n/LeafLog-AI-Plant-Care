export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: {
    id: number;
    email: string;
    nickname: string;
    marketing_opt_in: boolean;
  };
};

export type AvailabilityResponse = {
  available: boolean;
};

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

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

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
  marketing_opt_in: boolean;
}) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
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
