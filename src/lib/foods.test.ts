import { describe, expect, it } from "vitest";
import { normalize, porPorcao, scoreName, searchTaco, TACO_TOTAL } from "./foods";

describe("foods", () => {
  it("bundles the TACO table", () => {
    expect(TACO_TOTAL).toBeGreaterThan(500);
  });

  it("normalizes accents and punctuation", () => {
    expect(normalize("Pão, francês")).toBe("pao frances");
  });

  it("finds foods ignoring accents and order", () => {
    const hits = searchTaco("frango peito grelhado");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].nome.toLowerCase()).toContain("frango");
    expect(hits[0].nome.toLowerCase()).toContain("grelhad");
  });

  it("requires every token to match", () => {
    expect(scoreName("Arroz, integral, cozido", ["arroz", "feijao"])).toBe(0);
    expect(scoreName("Arroz, integral, cozido", ["arroz", "coz"])).toBeGreaterThan(0);
  });

  it("scales nutrients per portion", () => {
    const r = porPorcao({ kcal: 124, proteinaG: 2.6, carboG: 25.8, gorduraG: 1, fibraG: 2.7 }, 150);
    expect(r.kcal).toBe(186);
    expect(r.proteinaG).toBe(3.9);
  });
});
