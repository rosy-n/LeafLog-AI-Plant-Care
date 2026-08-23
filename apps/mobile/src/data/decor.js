import { Image } from "react-native";

import { PLANT_FEET_RATIO } from "./plants";

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

// 개체탭 배경 — 꾸미기 카드의 미리보기와 개체탭 배경이 같은 이미지다.
// store_bg1~5 는 같은 방을 계절·시간대만 바꿔 그린 한 세트고(봄/여름/가을/밤/비),
// store_bg6~7 은 화분으로 채운 밝은 방 한 세트다(선반/서랍장).
export const BACKGROUND_IMAGES = {
    "detail-bg": require("../../assets/images/detail-bg.png"),
    "home-bg": require("../../assets/images/home-bg.png"),
    store_bg1: require("../../assets/images/store_bg1.png"),
    store_bg2: require("../../assets/images/store_bg2.png"),
    store_bg3: require("../../assets/images/store_bg3.png"),
    store_bg4: require("../../assets/images/store_bg4.png"),
    store_bg5: require("../../assets/images/store_bg5.png"),
    store_bg6: require("../../assets/images/store_bg6.png"),
    store_bg7: require("../../assets/images/store_bg7.png"),
};

// 개체가 배경을 고르지 않았을 때의 기본값
// (서버 main.py 의 DEFAULT_BACKGROUND_ITEM_KEY 와 같아야 한다)
export const DEFAULT_BACKGROUND_KEY = "detail-bg";

// 홈 화면 배경은 꾸미기(item_key)로는 바뀌지 않는다 — 날씨별 배경은 HomeScreen.jsx 의
// WEATHER_BACKGROUNDS 가 별도로 갖고 있고, 이 키는 그중 기본값(맑음)을 가리킨다
export const HOME_BACKGROUND_KEY = "home-bg";

/*
    배경마다 캐릭터가 설 자리 — 배경 이미지 안에서의 비율이다.
      fx  캐릭터 상자의 가로 중심
      fy  발끝이 닿는 높이

    store_bg1~5 는 카펫 중앙, store_bg6 은 선반 윗면, store_bg7 은 서랍장 윗면에
    맞춰 941x1672 원본에서 실측했다. detail-bg/home-bg 는 기존 위치를 그대로 옮긴 값.

    화면 px 가 아니라 비율로 두는 이유: 배경은 resizeMode="cover" 라 기기 화면비에
    따라 확대율과 잘려나가는 폭이 달라진다. px 로 적으면 기기가 바뀌는 순간
    캐릭터가 카펫이나 선반을 벗어난다.
*/
export const BACKGROUND_ANCHORS = {
    "detail-bg": { fx: 0.5, fy: 0.645 },
    "home-bg":   { fx: 0.5, fy: 0.645 },
    store_bg1:   { fx: 0.5, fy: 0.722 },  // 카펫 중앙
    store_bg2:   { fx: 0.5, fy: 0.735 },
    store_bg3:   { fx: 0.5, fy: 0.747 },
    store_bg4:   { fx: 0.5, fy: 0.722 },
    store_bg5:   { fx: 0.5, fy: 0.727 },
    store_bg6:   { fx: 0.5, fy: 0.542 },  // 선반 윗면
    store_bg7:   { fx: 0.5, fy: 0.603 },  // 서랍장 윗면
};

/*
    배경 위에서 캐릭터 상자의 왼쪽 위 좌표를 구한다.

    resizeMode="cover" 와 같은 계산을 한다 — 화면을 덮도록 확대한 뒤 넘치는 쪽을
    가운데 기준으로 잘라내고, 그 좌표계에서 앵커 지점을 찾는다. 배경 원본 크기는
    번들 이미지에서 읽으므로(resolveAssetSource) 그림을 갈아도 따라 맞는다.

    backgroundKey  적용된 배경의 item_key (모르는 키면 기본 배경 기준)
    container      배경이 실제로 차지한 영역 {width, height} — onLayout 으로 잰다
    size           캐릭터 상자 한 변(px)

    반환값 { top, offsetX } — top 은 container 기준 캐릭터 상자의 위쪽,
    offsetX 는 가로 중앙에서 얼마나 밀어야 하는지(앵커가 fx 0.5 면 0).
    화면 쪽은 가로 중앙 정렬을 그대로 두고 이 오프셋만 얹으면 된다.
    아직 영역을 재지 못했으면 null.
*/
export function plantPlacement(backgroundKey, container, size) {
    if (!container?.width || !container?.height) return null;

    const key = BACKGROUND_ANCHORS[backgroundKey] ? backgroundKey : DEFAULT_BACKGROUND_KEY;
    const anchor = BACKGROUND_ANCHORS[key];
    const image = Image.resolveAssetSource(BACKGROUND_IMAGES[key]);
    if (!image?.width || !image?.height) return null;

    // cover — 가로/세로 중 더 많이 늘려야 하는 쪽에 맞춰 확대한다
    const scale = Math.max(container.width / image.width, container.height / image.height);
    const drawnWidth = image.width * scale;
    const drawnHeight = image.height * scale;
    // 넘치는 만큼은 양쪽으로 똑같이 잘려나간다 → 그림의 원점이 컨테이너 밖으로 밀린다
    const originX = (container.width - drawnWidth) / 2;
    const originY = (container.height - drawnHeight) / 2;

    return {
        // 발끝이 앵커에 닿도록 상자를 위로 올린다 (상자 아래쪽은 투명 여백이다)
        top: originY + anchor.fy * drawnHeight - size * PLANT_FEET_RATIO,
        offsetX: originX + anchor.fx * drawnWidth - container.width / 2,
    };
}

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