export const CHARACTER_EXPRESSION_KEYS = {
    DEFAULT: "default",
    PETTED: "1",
    WATER_DUE: "2",
    SICK: "3",
    WATER_VERY_OVERDUE: "4",
    IDLE_5: "5",
    IDLE_6: "6",
};

export const CHARACTER_EXPRESSIONS = {
    [CHARACTER_EXPRESSION_KEYS.DEFAULT]: require("../../assets/expressions/expression-default.png"),
    [CHARACTER_EXPRESSION_KEYS.PETTED]: require("../../assets/expressions/expression-1.png"),
    [CHARACTER_EXPRESSION_KEYS.WATER_DUE]: require("../../assets/expressions/expression-2.png"),
    [CHARACTER_EXPRESSION_KEYS.SICK]: require("../../assets/expressions/expression-3.png"),
    [CHARACTER_EXPRESSION_KEYS.WATER_VERY_OVERDUE]: require("../../assets/expressions/expression-4.png"),
    [CHARACTER_EXPRESSION_KEYS.IDLE_5]: require("../../assets/expressions/expression-5.png"),
    [CHARACTER_EXPRESSION_KEYS.IDLE_6]: require("../../assets/expressions/expression-6.png"),
};

const VERY_OVERDUE_DAYS = -3;

export function hasFaceRemovedChecksum(checksum) {
    return getFaceBoundsFromChecksum(checksum) !== null;
}

/** @returns {[number, number, number, number] | null} */
export function getFaceBoundsFromChecksum(checksum) {
    if (typeof checksum !== "string" || !checksum.startsWith("face-v1:")) return null;
    const bounds = checksum.split(":", 3)[1]?.split(",").map(Number);
    if (
        bounds?.length !== 4
        || bounds.some((value) => !Number.isFinite(value))
        || bounds[0] < 0
        || bounds[1] < 0
        || bounds[2] <= bounds[0]
        || bounds[3] <= bounds[1]
    ) {
        return null;
    }
    return /** @type {[number, number, number, number]} */ (bounds);
}

export function getPlantExpressionKey(
    plant,
    { idleKey = CHARACTER_EXPRESSION_KEYS.DEFAULT, transientKey = null } = {},
) {
    if (String(plant?.status ?? "").toUpperCase() === "SICK") {
        return CHARACTER_EXPRESSION_KEYS.SICK;
    }
    if (transientKey) return transientKey;

    const days = plant?.daysUntilWatering;
    if (typeof days === "number" && days <= VERY_OVERDUE_DAYS) {
        return CHARACTER_EXPRESSION_KEYS.WATER_VERY_OVERDUE;
    }
    if (typeof days === "number" && days <= 0) {
        return CHARACTER_EXPRESSION_KEYS.WATER_DUE;
    }
    return idleKey;
}

export function getPlantExpressionSource(plant, options) {
    return CHARACTER_EXPRESSIONS[getPlantExpressionKey(plant, options)];
}
