/**
 * 농촌진흥청 농사로 OpenAPI - 실내정원용 식물 서비스
 * 코드 매핑 테이블
 *
 * ※ 코드 표 자체는 ./nongsaro-codes.json 에만 정의한다.
 *   백엔드 적재 스크립트(apps/api/scripts/ingest/nongsaro_codes.py)가 같은 JSON 을 읽으므로,
 *   표를 고칠 때는 JSON 만 수정하면 앱·백엔드 양쪽에 반영된다.
 *   이 파일은 JSON 에 타입을 붙여 다시 내보내는 역할만 한다.
 *
 * plant_species 테이블 컬럼에 대응하는 코드만 정리
 * 출처: 농사로 OpenAPI 매뉴얼 (실내정원용 식물 서비스)
 */

import codes from './nongsaro-codes.json';

type Range = { min: number; max: number };

// ─────────────────────────────────────────────
// difficulty  ←  managelevelCode
// plant_species.difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'UNKNOWN'
// ─────────────────────────────────────────────
export const MANAGE_LEVEL_CODE: Record<string, string> = codes.MANAGE_LEVEL_CODE;

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

// 라벨 (UI 표시용)
export const MANAGE_LEVEL_LABEL: Record<string, string> = codes.MANAGE_LEVEL_LABEL;


// ─────────────────────────────────────────────
// light_level, light_min_lux, light_max_lux  ←  lighttdemanddoCode
// plant_species.light_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'INDIRECT' | 'UNKNOWN'
//
// ※ API는 광도 요구 코드를 lighttdemanddoCode 로 내려줌
//    055001 = 낮은 광도 → LOW,  055002 = 중간 광도 → INDIRECT 또는 MEDIUM,
//    055003 = 높은 광도 → HIGH
//    INDIRECT(반음지) 구분은 API에 없으므로 055001 을 LOW·INDIRECT 대표값으로 처리
// ─────────────────────────────────────────────
export const LIGHT_CODE: Record<string, string> = codes.LIGHT_CODE;

export const LIGHT_LEVEL_MAP: Record<string, string> = codes.LIGHT_LEVEL_MAP;

// Lux 범위 매핑
export const LIGHT_LUX_RANGE: Record<string, Range> = codes.LIGHT_LUX_RANGE;


// ─────────────────────────────────────────────
// temp_min_winter_c  ←  winterLwetTpCode  (겨울 최저 온도)
// temp_min_c / temp_max_c  ←  grwhTpCode  (생육 적정 온도)
// ─────────────────────────────────────────────

// 겨울 최저 온도 → temp_min_winter_c 에 저장 (057001 은 정확한 값 불명이라 null)
export const WINTER_LOW_TEMP_CODE: Record<string, number | null> = codes.WINTER_LOW_TEMP_CODE;

export const WINTER_LOW_TEMP_LABEL: Record<string, string> = codes.WINTER_LOW_TEMP_LABEL;

// 생육 온도 → temp_min_c / temp_max_c 범위로 분리
export const GROWTH_TEMP_CODE: Record<string, Range> = codes.GROWTH_TEMP_CODE;

export const GROWTH_TEMP_LABEL: Record<string, string> = codes.GROWTH_TEMP_LABEL;


// ─────────────────────────────────────────────
// humidity_min_pct, humidity_max_pct  ←  hdCode
// ─────────────────────────────────────────────
export const HUMIDITY_CODE: Record<string, Range> = codes.HUMIDITY_CODE;

export const HUMIDITY_LABEL: Record<string, string> = codes.HUMIDITY_LABEL;


// ─────────────────────────────────────────────
// watering_interval_days  ←  watercycle*Code (봄·여름·가을·겨울)
//
// ※ API는 물주기 빈도를 정성적 코드로만 제공 (일수 없음)
//    아래 interval_days 는 LeafLog 팀이 정의한 "대표 일수" 추정값
//    실제 UX에서는 label 을 그대로 노출하는 것도 고려 가능
// ─────────────────────────────────────────────
export const WATER_CYCLE_CODE: Record<string, string> = codes.WATER_CYCLE_CODE;

// 대표 물주기 일수 (추정값 — 팀 협의 후 조정 권장)
export const WATER_CYCLE_INTERVAL_DAYS: Record<string, number> = codes.WATER_CYCLE_INTERVAL_DAYS;


// ─────────────────────────────────────────────
// is_toxic, toxicity_info  ←  toxctyInfo (텍스트 필드)
//
// ※ API 는 독성 정보를 코드가 아닌 자유 텍스트로 내려줌
//    → toxctyInfo 값이 비어있으면 is_toxic = false
//    → 값이 있으면 is_toxic = true, 내용을 toxicity_info 에 저장
//    ※ 반려동물별(개/고양이/말) 구분은 ASPCA 소스에서 채운다
// ─────────────────────────────────────────────
// (코드 매핑 없음 — 파싱 로직으로 처리)


// ─────────────────────────────────────────────
// bugInfo  ←  dlthtsCode (병충해 코드, 콤마 구분)
// ─────────────────────────────────────────────
export const PEST_CODE: Record<string, string> = codes.PEST_CODE;


// ─────────────────────────────────────────────
// category  ←  clCode (분류 코드, 콤마 구분)
// ─────────────────────────────────────────────
export const CATEGORY_CODE: Record<string, string> = codes.CATEGORY_CODE;


// ─────────────────────────────────────────────
// 생육형태  ←  grwhstleCode  (plant_species 직접 저장 컬럼은 없지만
//              metadata JSONB 또는 description 보조 정보로 활용)
// ─────────────────────────────────────────────
export const GROWTH_STYLE_CODE: Record<string, string> = codes.GROWTH_STYLE_CODE;


// ─────────────────────────────────────────────
// 냄새  ←  smellCode  (metadata JSONB 활용)
// ─────────────────────────────────────────────
export const SMELL_CODE: Record<string, string> = codes.SMELL_CODE;


// ─────────────────────────────────────────────
// 생장속도  ←  grwtveCode  (metadata JSONB 활용)
// ─────────────────────────────────────────────
export const GROWTH_RATE_CODE: Record<string, string> = codes.GROWTH_RATE_CODE;


// ─────────────────────────────────────────────
// 배치 장소  ←  postngplaceCode  (metadata JSONB 활용)
// ─────────────────────────────────────────────
export const PLACEMENT_CODE: Record<string, string> = codes.PLACEMENT_CODE;


// ─────────────────────────────────────────────
// 번식방법  ←  prpgtmthCode  (metadata JSONB 활용)
// ─────────────────────────────────────────────
export const PROPAGATION_CODE: Record<string, string> = codes.PROPAGATION_CODE;


// ─────────────────────────────────────────────
// 관리요구도  ←  managedemanddoCode  (difficulty 보조 또는 metadata)
// ─────────────────────────────────────────────
export const MANAGE_DEMAND_CODE: Record<string, string> = codes.MANAGE_DEMAND_CODE;


// ─────────────────────────────────────────────
// 꽃 피는 계절  ←  ignSeasonCode  (콤마 구분, 복수 선택 가능)
// ─────────────────────────────────────────────
export const FLOWERING_SEASON_CODE: Record<string, string> = codes.FLOWERING_SEASON_CODE;


// ─────────────────────────────────────────────
// 꽃색  ←  flclrCode  (콤마 구분, 복수 선택 가능)
// ─────────────────────────────────────────────
export const FLOWER_COLOR_CODE: Record<string, string> = codes.FLOWER_COLOR_CODE;


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
        .map((c) => codeMap[c] as string);
}