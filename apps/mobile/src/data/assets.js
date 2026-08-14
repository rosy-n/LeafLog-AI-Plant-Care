import { Asset } from "expo-asset";

import { plantImages } from "./plants";
import { ACCESSORY_IMAGES, BACKGROUND_IMAGES } from "./decor";

/*
    앱이 쓰는 번들 이미지 목록 — 시작할 때 한 번에 캐시로 올린다.

    이 목록에 없는 이미지는 그 화면을 처음 열 때 비동기로 로드돼서
    아이콘이 한 박자 늦게 뜬다(특히 Expo Go 개발 모드는 Metro 에서
    파일을 받아오므로 더 늦다). 아이콘 26개가 빠져 있어서 탭을 옮길 때마다
    깜빡였고, 그래서 여기로 모았다.

    Metro 는 require 경로를 정적으로 읽는다 — 디렉터리 순회나 문자열 조합으로는
    번들에 포함되지 않으므로 파일을 하나씩 적어야 한다.
    아이콘/이미지를 추가하면 이 목록에도 추가할 것.
*/

// 화면 곳곳의 아이콘 (홈·개체탭 버튼, 날씨/대기질, 하트, 독성 표시 등)
const ICONS = [
    require("../../assets/icons/air_bad_icon.png"),
    require("../../assets/icons/air_good_icon.png"),
    require("../../assets/icons/air_moderate_icon.png"),
    require("../../assets/icons/air_veryBad_icon.png"),
    require("../../assets/icons/all_icon.png"),
    require("../../assets/icons/calendar_icon.png"),
    require("../../assets/icons/chat_icon.png"),
    require("../../assets/icons/close_icon.png"),
    require("../../assets/icons/cloudy_icon.png"),
    require("../../assets/icons/counsel_icon.png"),
    require("../../assets/icons/diary_icon.png"),
    require("../../assets/icons/emptyheart_icon.png"),
    require("../../assets/icons/fullheart_icon.png"),
    require("../../assets/icons/halfheart_icon.png"),
    require("../../assets/icons/hamburger_icon.png"),
    require("../../assets/icons/home_icon.png"),
    require("../../assets/icons/notification_icon.png"),
    require("../../assets/icons/nutrients_icon.png"),
    require("../../assets/icons/rainy_icon.png"),
    require("../../assets/icons/snow_icon.png"),
    require("../../assets/icons/sunny_icon.png"),
    require("../../assets/icons/toxicity-cat.png"),
    require("../../assets/icons/toxicity-dog.png"),
    require("../../assets/icons/toxicity-human.png"),
    require("../../assets/icons/water_icon.png"),
    require("../../assets/icons/watering_icon.png"),
];

// login-bg 는 로그인 전 랜딩에서 이미 로드되므로 여기 넣지 않는다

export const BUNDLED_IMAGES = [
    ...ICONS,
    // 꾸미기 아이템(카드 아이콘 + 캐릭터에 겹칠 이미지)과 배경 —
    // decor.js 가 단일 출처라 여기서 다시 적지 않는다
    ...Object.values(ACCESSORY_IMAGES).flatMap((images) => [images.card, images.plant]),
    ...Object.values(BACKGROUND_IMAGES),
    // 도트 캐릭터 fallback — plants.js 가 단일 출처라 여기서 다시 적지 않는다
    ...Object.values(plantImages),
];

/** 번들 이미지를 모두 캐시에 올린다. 하나가 실패해도 나머지는 계속 로드한다. */
export async function preloadBundledImages() {
    await Promise.all(
        BUNDLED_IMAGES.map((image) =>
            Asset.fromModule(image)
                .downloadAsync()
                .catch((error) =>
                    console.warn("이미지 preload 실패:", error?.message),
                ),
        ),
    );
}