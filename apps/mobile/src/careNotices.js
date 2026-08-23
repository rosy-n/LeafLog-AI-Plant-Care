/**
 * 개체 목록에서 "돌봄 알림 목록"을 만든다.
 *
 * 실제로 기기에 도착한 알림 이력을 저장하지 않고, 서버 일정에서 매번 계산한다.
 * 사용자가 이 화면에서 알고 싶은 건 "무엇을 해야 하는지"이고, 그건 지금 일정만으로
 * 정확히 답할 수 있다. 도착 이력을 쓰려면 기기에 기록을 남기고 읽음 상태까지
 * 관리해야 하는데, 얻는 것보다 관리 비용이 크다.
 *
 * urgent = 지금 할 일 (예정일이 지났거나 오늘). 종 알림 배지도 이 값으로 판단한다.
 */

/** 떠나보낸 개체는 제외하고, 급한 것부터 정렬 */
export function buildCareNotices(plants) {
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
                characterFaceRemoved: plant.characterFaceRemoved,
                characterFaceBounds: plant.characterFaceBounds,
                status: plant.status,
                daysUntilWatering: plant.daysUntilWatering,
            };
        })
        .sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
