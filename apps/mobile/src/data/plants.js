// 정원/도트 캐릭터용 기본 이미지 — AI 캐릭터(FLUX) 미구현 상태의 fallback으로 사용
export const plantImages = {
    spaghetti: require("../../assets/plants/spaghetti.png"),
    rubber: require("../../assets/plants/rubber.png"),
    sansevieria: require("../../assets/plants/sansevieria.png"),
    pachira: require("../../assets/plants/pachira.png"),
    myeongrani: require("../../assets/plants/myeongrani.png"),
    test: require("../../assets/plants/test.png"),
};

/*
    도트 캐릭터 그림에서 발끝이 오는 높이 비율 — 위쪽에 투명 여백이 있어서
    상자 맨 아래가 아니라 84.6% 지점이 바닥에 닿는다 (에셋 5종 실측).

    개체를 바닥·가구 위에 세우는 계산이 홈(들판 원근)과 개체탭(배경별 앵커)
    양쪽에 있어서 여기 한 곳에만 둔다 — 두 곳에 적으면 에셋을 다시 그릴 때 어긋난다.
*/
export const PLANT_FEET_RATIO = 0.846;
