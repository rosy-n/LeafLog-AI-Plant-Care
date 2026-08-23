/**
 * 개체 목록에서 "돌봄 알림 목록"을 만든다.
 *
 * 실제로 기기에 도착한 알림 이력을 저장하지 않고, 서버 일정에서 매번 계산한다.
 * 사용자가 이 화면에서 알고 싶은 건 "무엇을 해야 하는지"이고, 그건 지금 일정만으로
 * 정확히 답할 수 있다. 도착 이력을 쓰려면 기기에 기록을 남기고 읽음 상태까지
 * 관리해야 하는데, 얻는 것보다 관리 비용이 크다.
 *
 * urgent = 지금 할 일 (예정일이 지났거나 오늘). 종 알림 배지도 이 값으로 판단한다.
 * kind 는 카드를 눌렀을 때 어디로 보낼지를 정한다 (물주기 → 개체탭, 갱신 → 갱신 흐름).
 */

/** 떠나보낸 개체는 제외하고, 급한 것부터 정렬 */
export function buildCareNotices(plants) {
    return [...wateringNotices(plants), ...refreshNotices(plants)].sort(
        (a, b) => Number(b.urgent) - Number(a.urgent),
    );
}

function wateringNotices(plants) {
    return plants
        .filter((plant) => !plant.memorial && plant.daysUntilWatering != null)
        .map((plant) => {
            const days = plant.daysUntilWatering;
            const urgent = days <= 0;

            let title;
            let speech;
            if (days < 0) {
                title = `${plant.name} 물 줄 때가 지났어요`;
                speech = "목이 너무 말라요..💧";
            } else if (days === 0) {
                title = `${plant.name} 물 주는 날이에요`;
                speech = "오늘 물 한 잔 부탁해요!";
            } else {
                title = `${plant.name} 물 주는 날이 다가와요`;
                speech = "아직은 괜찮아요. 곧 부탁해요!";
            }

            return {
                id: `watering-${plant.id}`,
                kind: "WATERING",
                plantId: plant.id,
                title,
                speech,
                when:
                    days < 0
                        ? `${-days}일 지남`
                        : days === 0
                          ? "오늘"
                          : `${days}일 뒤 (${plant.nextWateringDate})`,
                urgent,
                imageUri: plant.imageUri,
                imageKey: plant.imageKey,
            };
        });
}

/*
    월 1회 갱신(캐릭터 재생성 + 개체 정보 갱신) 안내.

    물주기와 달리 예정일 전에는 목록에 넣지 않는다 — 갱신은 미리 준비할 일이 아니라
    그날 하면 되는 일이고, 개체마다 한 달치 "예정" 카드가 늘 떠 있으면 정작 급한
    물주기가 묻힌다. 그래서 예정일이 되었거나 지난 개체만 넣는다.

    지난 갱신은 목록에 남겨 둔다(기기 알림은 그날 한 번 오고 지나가므로, 놓쳤을 때
    다시 찾을 수 있는 자리가 여기다). 갱신을 마치면 예정일이 한 달 뒤로 밀려 사라진다.
*/
function refreshNotices(plants) {
    return plants
        .filter(
            (plant) =>
                !plant.memorial &&
                plant.daysUntilRefresh != null &&
                plant.daysUntilRefresh <= 0,
        )
        .map((plant) => {
            const days = plant.daysUntilRefresh;
            return {
                id: `refresh-${plant.id}`,
                kind: "MONTHLY_REFRESH",
                plantId: plant.id,
                title:
                    days < 0
                        ? `${plant.name} 캐릭터를 갱신할 때가 지났어요`
                        : `${plant.name} 캐릭터를 갱신하는 날이에요`,
                speech: "지금 내 모습으로 다시 그려줘!",
                when: days < 0 ? `${-days}일 지남` : "오늘",
                // 갱신은 늦어도 식물이 상하지 않지만, 사용자가 이 카드를 보고 들어와야
                // 흐름이 시작되므로 "지금 할 일"에 둔다
                urgent: true,
                imageUri: plant.imageUri,
                imageKey: plant.imageKey,
            };
        });
}