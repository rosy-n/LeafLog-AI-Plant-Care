/*
    꾸미기 아이템의 번들 이미지 — item_key → 이미지. **fallback 전용**이다.

    이름·해금 단계·이미지는 서버 item 테이블이 단일 출처다(GET /api/items).
    이미지는 S3(media_asset)에 올린 게 있으면 URL로 오고, 아직 없거나 URL 발급이
    안 되면 null 로 온다 — 그때 여기 있는 번들 이미지로 그린다.
    (앱을 새로 배포하지 않아도 서버에서 이미지를 갈아끼울 수 있게 하되,
     네트워크가 끊겨도 화면이 비지 않도록 번들 사본을 남겨 둔다.)

    Metro 는 require 경로를 정적으로 읽어서 URL/문자열 조합으로는 번들에 포함되지
    않으므로 파일을 하나씩 적어야 한다. 키는 서버 item.item_key 와 같아야 한다.
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

// 개체탭 배경 — 꾸미기 카드의 미리보기와 개체탭 배경이 같은 이미지다
export const BACKGROUND_IMAGES = {
    "detail-bg": require("../../assets/images/detail-bg.png"),
    "home-bg": require("../../assets/images/home-bg.png"),
    store_bg1: require("../../assets/images/store_bg1.png"),
    store_bg2: require("../../assets/images/store_bg2.png"),
};

// 개체가 배경을 고르지 않았을 때의 기본값
// (서버 main.py 의 DEFAULT_BACKGROUND_ITEM_KEY 와 같아야 한다)
export const DEFAULT_BACKGROUND_KEY = "detail-bg";

// 홈 화면 배경은 꾸미기(item_key)로는 바뀌지 않는다 — 날씨별 배경은 HomeScreen.jsx 의
// WEATHER_BACKGROUNDS 가 별도로 갖고 있고, 이 키는 그중 기본값(맑음)을 가리킨다
export const HOME_BACKGROUND_KEY = "home-bg";

/*
    아래 *Bundle 함수는 번들 사본만 돌려준다 — DecorImage 가 원격 이미지를 받는 동안
    먼저 그릴 그림이다. 원격/번들 중 하나만 필요한 곳은 그 아래 *Source 를 쓴다.
*/

/** 꾸미기 카드 아이콘의 번들 사본 */
export function accessoryCardBundle(itemKey) {
    return ACCESSORY_IMAGES[itemKey]?.card ?? null;
}

/** 아이템을 착용한 캐릭터 이미지의 번들 사본 */
export function accessorySpriteBundle(itemKey) {
    return ACCESSORY_IMAGES[itemKey]?.plant ?? null;
}

/** 홈 배경의 번들 사본. 모르는 키면 기본 배경. */
export function backgroundBundle(itemKey) {
    return BACKGROUND_IMAGES[itemKey] ?? BACKGROUND_IMAGES[DEFAULT_BACKGROUND_KEY];
}

/** URL 이 있으면 원격 이미지, 없으면 번들 fallback. 둘 다 없으면 null. */
function source(url, bundled) {
    if (url) return { uri: url };
    return bundled ?? null;
}

/*
    액세서리는 *Source 를 두지 않는다 — 카드·캐릭터 모두 DecorImage 가
    번들과 원격을 함께 받아 교체하기 때문에 한 장으로 합칠 일이 없다.
*/

/** 홈 배경 이미지. background 는 { key, url } — 모르는 키면 기본 배경. */
export function backgroundSource(background) {
    return source(
        background?.url,
        BACKGROUND_IMAGES[background?.key] ?? BACKGROUND_IMAGES[DEFAULT_BACKGROUND_KEY],
    );
}