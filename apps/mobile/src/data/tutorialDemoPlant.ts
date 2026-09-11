// 튜토리얼용 가짜 식물 "스파" — 실제 DB row가 아니라 App.js의 toGardenPlant() 출력과
// 같은 모양으로 손으로 채운 상수다. imageUri/imageKey를 비워두면 PlantImage가 이미
// 기본값으로 쓰는 번들 이미지(assets/plants/spaghetti.png)로 폴백하므로 별도 에셋
// 배선이 필요 없다. PlantDetailScreen은 plant.isTutorialDemo로 이 객체를 구분해
// 데이터 페치·돌봄 기록 API 호출을 전부 로컬 시뮬레이션으로 대체한다.
export const TUTORIAL_DEMO_PLANT = {
  id: "tutorial-spa",
  name: "스파",
  favorite: false,
  imageUri: null,
  characterFaceRemoved: false,
  characterFaceBounds: null,
  status: "ALIVE",
  hearts: 0,
  affinityScore: 0,
  affinityLevel: 0,
  memorial: false,
  commonNameKo: "스파티필룸",
  persona: null,
  createdAt: null,
  wateringIntervalDays: 7,
  nextWateringDate: null,
  daysUntilWatering: null,
  isTutorialDemo: true,
};

/*
    튜토리얼 정원(GardenScreen) 데모용 가짜 식물 3개 — 실제 사용자 개체 대신 보여준다.
    imageKey는 src/data/plants.js의 번들 이미지 키를 그대로 쓴다(spaghetti=스파는 제외).
    카드 탭·즐겨찾기 등은 GardenScreen이 튜토리얼 중엔 전부 눌러도 반응 없게 막으므로
    실제 API를 타지 않는다 — id가 숫자가 아니라서 그대로 두면 서버 호출이 깨진다.
*/
export const TUTORIAL_DEMO_GARDEN_PLANTS = [
  {
    id: "tutorial-garden-1",
    name: "고무나무",
    imageUri: null,
    imageKey: "rubber",
    favorite: false,
    hearts: 3,
    memorial: false,
    daysUntilWatering: 2,
    isTutorialDemo: true,
  },
  {
    id: "tutorial-garden-2",
    name: "산세베리아",
    imageUri: null,
    imageKey: "sansevieria",
    favorite: true,
    hearts: 4,
    memorial: false,
    daysUntilWatering: 5,
    isTutorialDemo: true,
  },
  {
    id: "tutorial-garden-3",
    name: "파키라",
    imageUri: null,
    imageKey: "pachira",
    favorite: false,
    hearts: 2,
    memorial: false,
    daysUntilWatering: 0,
    isTutorialDemo: true,
  },
];
