/*
    꾸미기 아이템 이미지 — item_key → 번들 이미지.

    이름과 해금 단계(required_level)는 서버 item 테이블이 단일 출처다(GET /api/items).
    여기엔 이미지만 둔다 — Metro 는 require 경로를 정적으로 읽어서
    URL/문자열 조합으로는 번들에 포함되지 않기 때문이다.
    키는 apps/api/scripts/add-item-tables.sql 의 item_key 와 정확히 같아야 한다.
*/

// 개체에 씌우는 액세서리 — card 는 꾸미기 카드용 아이콘, plant 는 캐릭터에 겹쳐 그리는 이미지
export const ACCESSORY_IMAGES = {
    level1: {
        card: require("../../assets/items/level1_item.png"),
        plant: require("../../assets/items/level1_plants.png"),
    },
    level2: {
        card: require("../../assets/items/level2_item.png"),
        plant: require("../../assets/items/level2_plants.png"),
    },
    level3: {
        card: require("../../assets/items/level3_item.png"),
        plant: require("../../assets/items/level3_plants.png"),
    },
    level4: {
        card: require("../../assets/items/level4_item.png"),
        plant: require("../../assets/items/level4_plants.png"),
    },
    level5: {
        card: require("../../assets/items/level5_item.png"),
        plant: require("../../assets/items/level5_plants.png"),
    },
};

// 홈 배경 — 꾸미기 카드의 미리보기와 홈 화면 배경이 같은 이미지다
export const BACKGROUND_IMAGES = {
    "home-bg": require("../../assets/images/home_clear_bg.png"),
    store_bg1: require("../../assets/images/store_bg1.png"),
    store_bg2: require("../../assets/images/store_bg2.png"),
};

// 배경을 고르기 전의 기본값 (서버 main.py 의 DEFAULT_BACKGROUND_ITEM_KEY 와 같아야 한다)
export const DEFAULT_BACKGROUND_KEY = "home-bg";

/** 캐릭터에 겹쳐 그릴 액세서리 이미지. 착용 안 했거나 모르는 키면 null. */
export function accessoryPlantImage(itemKey) {
    return ACCESSORY_IMAGES[itemKey]?.plant ?? null;
}

/** 홈 배경 이미지. 모르는 키면 기본 배경. */
export function backgroundImage(itemKey) {
    return BACKGROUND_IMAGES[itemKey] ?? BACKGROUND_IMAGES[DEFAULT_BACKGROUND_KEY];
}