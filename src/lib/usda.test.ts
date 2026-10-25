import { describe, expect, it } from "vitest";
import { parseUsdaFood } from "./usda";

describe("usda", () => {
  it("maps FoodData Central nutrients to per-100g values", () => {
    const hit = parseUsdaFood({
      fdcId: 171287,
      description: "Egg, whole, cooked, hard-boiled",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: 1008, value: 155, unitName: "KCAL" },
        { nutrientId: 1003, value: 12.58 },
        { nutrientId: 1005, value: 1.12 },
        { nutrientId: 1004, value: 10.61 },
        { nutrientId: 1079, value: 0 },
      ],
    });
    expect(hit).toMatchObject({ ref: "usda:171287", kcal: 155, proteinaG: 12.6, carboG: 1.1, gorduraG: 10.6, fonte: "usda" });
  });

  it("returns null without energy", () => {
    expect(parseUsdaFood({ fdcId: 1, description: "x", foodNutrients: [{ nutrientId: 1003, value: 1 }] })).toBeNull();
  });
});
