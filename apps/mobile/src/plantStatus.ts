/*
  개체가 "떠나보낸 상태(추모정원)"인지 판정하는 단 하나의 자리.

  화면마다 받는 개체 스냅샷의 모양이 조금씩 다르다 —
  정원 목록이 넘겨주는 형태(App.js 의 toGardenPlant)에는 memorial 이 있고,
  서버 상세(GET /api/plants/{id})에는 status 만 있다. 둘 중 하나만 보고 판정하면
  들어온 경로에 따라 같은 개체가 다르게 보이므로 여기서 함께 본다.

  서버 쪽 같은 규칙은 main.py 의 _reject_if_memorial 이다.
*/

type PlantLike = {
  memorial?: boolean | null;
  status?: string | null;
} | null | undefined;

export function isMemorialPlant(plant: PlantLike): boolean {
  if (!plant) return false;
  return plant.memorial === true || plant.status === "DEAD";
}
