/**
 * 농촌진흥청 농사로 OpenAPI - 실내정원용 식물 서비스
 * 코드 매핑 테이블
 *
 * plant_species 테이블 컬럼에 대응하는 코드만 정리
 * 출처: 농사로 OpenAPI 매뉴얼 (실내정원용 식물 서비스)
 */

// ─────────────────────────────────────────────
// difficulty  ←  managelevelCode
// plant_species.difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'UNKNOWN'
// ─────────────────────────────────────────────
export const MANAGE_LEVEL_CODE = {
    '089001': 'EASY',   // 초보자
    '089002': 'MEDIUM', // 경험자
    '089003': 'HARD',   // 전문가
} as const;

export type Difficulty = typeof MANAGE_LEVEL_CODE[keyof typeof MANAGE_LEVEL_CODE];

// 라벨 (UI 표시용)
export const MANAGE_LEVEL_LABEL: Record<string, string> = {
    '089001': '초보자',
    '089002': '경험자',
    '089003': '전문가',
};


// ─────────────────────────────────────────────
// light_level, light_min_lux, light_max_lux  ←  lighttdemanddoCode
// plant_species.light_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'INDIRECT' | 'UNKNOWN'
//
// ※ API는 광도 요구 코드를 lighttdemanddoCode 로 내려줌
//    055001 = 낮은 광도 → LOW,  055002 = 중간 광도 → INDIRECT 또는 MEDIUM,
//    055003 = 높은 광도 → HIGH
//    INDIRECT(반음지) 구분은 API에 없으므로 055001 을 LOW·INDIRECT 대표값으로 처리
// ─────────────────────────────────────────────
export const LIGHT_CODE = {
    '055001': '낮은 광도 (300~800 Lux)',
    '055002': '중간 광도 (800~1,500 Lux)',
    '055003': '높은 광도 (1,500~10,000 Lux)',
} as const;

export const LIGHT_LEVEL_MAP: Record<string, string> = {
    '055001': 'LOW',
    '055002': 'MEDIUM',
    '055003': 'HIGH',
};

// Lux 범위 매핑
export const LIGHT_LUX_RANGE: Record<string, { min: number; max: number }> = {
    '055001': { min: 300, max: 800 },
    '055002': { min: 800, max: 1500 },
    '055003': { min: 1500, max: 10000 },
};


// ─────────────────────────────────────────────
// temp_min_c  ←  winterLwetTpCode   (겨울 최저 온도)
// temp_max_c  ←  grwhTpCode         (생육 온도 상한 추정)
// ─────────────────────────────────────────────

// 겨울 최저 온도 → temp_min_c 에 저장
export const WINTER_LOW_TEMP_CODE: Record<string, number | null> = {
    '057001': null, // 0℃ 이하 (정확한 값 불명)  → null 처리 권장
    '057002': 5,
    '057003': 7,
    '057004': 10,
    '057005': 13,   // 13℃ 이상 (최솟값 기준)
};

export const WINTER_LOW_TEMP_LABEL: Record<string, string> = {
    '057001': '0℃ 이하',
    '057002': '5℃',
    '057003': '7℃',
    '057004': '10℃',
    '057005': '13℃ 이상',
};

// 생육 온도 → temp_min_c / temp_max_c 범위로 분리
export const GROWTH_TEMP_CODE: Record<string, { min: number; max: number }> = {
    '082001': { min: 10, max: 15 },
    '082002': { min: 16, max: 20 },
    '082003': { min: 21, max: 25 },
    '082004': { min: 26, max: 30 },
};

export const GROWTH_TEMP_LABEL: Record<string, string> = {
    '082001': '10~15℃',
    '082002': '16~20℃',
    '082003': '21~25℃',
    '082004': '26~30℃',
};


// ─────────────────────────────────────────────
// humidity_min_pct, humidity_max_pct  ←  hdCode
// ─────────────────────────────────────────────
export const HUMIDITY_CODE: Record<string, { min: number; max: number }> = {
    '083001': { min: 0, max: 39 }, // 40% 미만
    '083002': { min: 40, max: 70 }, // 40~70%
    '083003': { min: 70, max: 100 }, // 70% 이상
};

export const HUMIDITY_LABEL: Record<string, string> = {
    '083001': '40% 미만',
    '083002': '40~70%',
    '083003': '70% 이상',
};


// ─────────────────────────────────────────────
// watering_interval_days  ←  watercycle*Code (봄·여름·가을·겨울)
//
// ※ API는 물주기 빈도를 정성적 코드로만 제공 (일수 없음)
//    아래 interval_days 는 LeafLog 팀이 정의한 "대표 일수" 추정값
//    실제 UX에서는 label 을 그대로 노출하는 것도 고려 가능
// ─────────────────────────────────────────────
export const WATER_CYCLE_CODE = {
    '053001': '항상 흙을 촉촉하게 유지 (물에 잠김)',
    '053002': '흙을 촉촉하게 유지 (잠기지 않도록 주의)',
    '053003': '표면이 말랐을 때 충분히 관수',
    '053004': '흙 대부분 말랐을 때 충분히 관수',
} as const;

// 대표 물주기 일수 (추정값 — 팀 협의 후 조정 권장)
export const WATER_CYCLE_INTERVAL_DAYS: Record<string, number> = {
    '053001': 1,  // 매일
    '053002': 3,  // 2~3일
    '053003': 5,  // 4~6일
    '053004': 10, // 7~14일
};


// ─────────────────────────────────────────────
// is_toxic, toxicity_info  ←  toxctyInfo (텍스트 필드)
//
// ※ API 는 독성 정보를 코드가 아닌 자유 텍스트로 내려줌
//    → toxctyInfo 값이 비어있으면 is_toxic = false
//    → 값이 있으면 is_toxic = true, 내용을 toxicity_info 에 저장
// ─────────────────────────────────────────────
// (코드 매핑 없음 — 파싱 로직으로 처리)


// ─────────────────────────────────────────────
// bugInfo  ←  dlthtsCode (병충해 코드, 콤마 구분)
// ─────────────────────────────────────────────
export const PEST_CODE: Record<string, string> = {
    '088001': '진딧물',
    '088002': '응애',
    '088003': '깍지벌레',
    '088004': '총채벌레',
    '088005': '온실가루이',
};


// ─────────────────────────────────────────────
// category  ←  clCode (분류 코드, 콤마 구분)
// ─────────────────────────────────────────────
export const CATEGORY_CODE: Record<string, string> = {
    '072001': '잎보기식물',
    '072002': '잎·꽃보기식물',
    '072003': '꽃보기식물',
    '072004': '열매보기식물',
    '072005': '선인장·다육식물',
};


// ─────────────────────────────────────────────
// 생육형태  ←  grwhstleCode  (plant_species 직접 저장 컬럼은 없지만
//              metadata JSONB 또는 description 보조 정보로 활용)
// ─────────────────────────────────────────────
export const GROWTH_STYLE_CODE: Record<string, string> = {
    '054001': '직립형',
    '054002': '관목형',
    '054003': '덩굴성',
    '054004': '풀모양',
    '054005': '로제트형',
    '054006': '다육형',
};


// ─────────────────────────────────────────────
// 냄새  ←  smellCode  (metadata JSONB 활용)
// ─────────────────────────────────────────────
export const SMELL_CODE: Record<string, string> = {
    '079001': '강함',
    '079002': '중간',
    '079003': '약함',
    '079004': '거의 없음',
};


// ─────────────────────────────────────────────
// 생장속도  ←  grwtveCode  (metadata JSONB 활용)
// ─────────────────────────────────────────────
export const GROWTH_RATE_CODE: Record<string, string> = {
    '090001': '빠름',
    '090002': '보통',
    '090003': '느림',
};


// ─────────────────────────────────────────────
// 배치 장소  ←  postngplaceCode  (metadata JSONB 활용)
// ─────────────────────────────────────────────
export const PLACEMENT_CODE: Record<string, string> = {
    '064001': '실내 어두운 곳 (실내깊이 500cm 이상)',
    '064002': '거실 내측 (실내깊이 300~500cm)',
    '064003': '거실 창측 (실내깊이 150~300cm)',
    '064004': '발코니 내측 (실내깊이 50~150cm)',
    '064005': '발코니 창측 (실내깊이 0~50cm)',
    '064006': '습한 곳',
    '064007': '넓은 곳',
    '064008': '좁은 곳',
};


// ─────────────────────────────────────────────
// 번식방법  ←  prpgtmthCode  (metadata JSONB 활용)
// ─────────────────────────────────────────────
export const PROPAGATION_CODE: Record<string, string> = {
    '060001': '파종',
    '060002': '삽목',
    '060003': '분주',
    '060004': '접목',
    '060005': '취목',
    '060006': '기타',
};


// ─────────────────────────────────────────────
// 관리요구도  ←  managedemanddoCode  (difficulty 보조 또는 metadata)
// ─────────────────────────────────────────────
export const MANAGE_DEMAND_CODE: Record<string, string> = {
    '058001': '낮음 (잘 견딤)',
    '058002': '보통 (약간 잘 견딤)',
    '058003': '필요함',
    '058004': '특별 관리 요구',
    '058005': '기타',
};


// ─────────────────────────────────────────────
// 꽃 피는 계절  ←  ignSeasonCode  (콤마 구분, 복수 선택 가능)
// ─────────────────────────────────────────────
export const FLOWERING_SEASON_CODE: Record<string, string> = {
    '073001': '봄',
    '073002': '여름',
    '073003': '가을',
    '073004': '겨울',
};


// ─────────────────────────────────────────────
// 꽃색  ←  flclrCode  (콤마 구분, 복수 선택 가능)
// ─────────────────────────────────────────────
export const FLOWER_COLOR_CODE: Record<string, string> = {
    '071001': '파랑색',
    '071002': '보라색',
    '071003': '분홍색',
    '071004': '빨강색',
    '071005': '오렌지색',
    '071006': '노랑색',
    '071007': '흰색',
    '071008': '혼합색',
    '071009': '기타',
};


// ─────────────────────────────────────────────
// 유틸: 콤마로 구분된 코드 문자열 → 라벨 배열 변환
// ex) parseCodes('088001,088003', PEST_CODE) → ['진딧물', '깍지벌레']
// ─────────────────────────────────────────────
export function parseCodes(
    codeString: string | undefined | null,
    codeMap: Record<string, string>,
): string[] {
    if (!codeString) return [];
    return codeString
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c in codeMap)
        .map((c) => codeMap[c]);
}
