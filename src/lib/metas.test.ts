import { describe, expect, it } from "vitest";
import { calcularMetas, idadeAnos, tmbMifflin } from "./metas";

describe("metas", () => {
  it("Mifflin-St Jeor homem 80kg 175cm 40 anos", () => {
    // 10*80 + 6.25*175 - 5*40 + 5 = 800 + 1093.75 - 200 + 5 = 1698.75
    expect(tmbMifflin("masculino", 80, 175, 40)).toBe(1699);
  });

  it("Mifflin-St Jeor mulher 60kg 165cm 30 anos", () => {
    // 600 + 1031.25 - 150 - 161 = 1320.25
    expect(tmbMifflin("feminino", 60, 165, 30)).toBe(1320);
  });

  it("idade a partir da data de nascimento", () => {
    expect(idadeAnos("1986-05-10", new Date("2026-05-09"))).toBe(39);
    expect(idadeAnos("1986-05-10", new Date("2026-05-10"))).toBe(40);
  });

  it("metas para emagrecer com atividade moderada", () => {
    const m = calcularMetas({
      sexo: "masculino",
      pesoKg: 90,
      alturaCm: 180,
      idade: 40,
      nivelAtividade: "moderado",
      objetivo: "emagrecer",
    });
    expect(m.tmbKcal).toBe(1830);
    expect(m.gastoTotalKcal).toBe(2837);
    expect(m.metaKcal).toBe(2337);
    expect(m.metaProteinaG).toBe(180);
    expect(m.carboMinG).toBeLessThanOrEqual(m.carboMaxG);
    expect(m.gorduraMinG).toBeLessThan(m.gorduraMaxG);
    expect(m.aguaMl).toBe(3150);
  });

  it("usa TMB medida e massa magra quando informadas", () => {
    const m = calcularMetas({
      sexo: "masculino",
      pesoKg: 90,
      alturaCm: 180,
      idade: 40,
      nivelAtividade: "leve",
      objetivo: "emagrecer",
      tmbMedidaKcal: 1900,
      massaMagraKg: 65,
    });
    expect(m.tmbKcal).toBe(1900);
    expect(m.metaProteinaG).toBe(156); // 65 * 2.4
  });

  it("nunca propõe menos de 1200 kcal", () => {
    const m = calcularMetas({
      sexo: "feminino",
      pesoKg: 48,
      alturaCm: 155,
      idade: 60,
      nivelAtividade: "sedentario",
      objetivo: "emagrecer",
      ajusteKcal: -800,
    });
    expect(m.metaKcal).toBe(1200);
  });
});
