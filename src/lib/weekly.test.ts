import { describe, expect, it } from "vitest";
import type { Combinados, Meal } from "./db";
import { inicioSemana, metricasSemana, semanaAnterior } from "./weekly";

const c = { metaKcal: 2000, metaProteinaG: 150, treinoAjusteKcal: 200 } as Combinados;
const meal = (date: string, kcal: number, proteinaG: number, classificacao: Meal["classificacao"] = "dentro"): Meal => ({
  date,
  hora: "12:00",
  refeicao: "Almoço",
  descricao: "x",
  itens: [],
  kcal,
  proteinaG,
  carboG: 0,
  gorduraG: 0,
  fibraG: 0,
  classificacao,
  createdAt: 0,
});

describe("weekly", () => {
  it("week starts on Monday", () => {
    expect(inicioSemana("2026-10-25")).toBe("2026-10-19"); // domingo → segunda anterior
    expect(inicioSemana("2026-10-19")).toBe("2026-10-19");
    expect(semanaAnterior("2026-10-27")).toEqual({ inicio: "2026-10-19", fim: "2026-10-25" });
  });

  it("computes weekly metrics", () => {
    const m = metricasSemana(
      "2026-10-19",
      "2026-10-25",
      [meal("2026-10-19", 1900, 160), meal("2026-10-20", 2300, 100, "fora"), meal("2026-10-21", 2100, 150)],
      [{ date: "2026-10-19", ml: 2000, createdAt: 0 }],
      [{ date: "2026-10-21", tipo: "musculação", duracaoMin: 60, intensidade: "intensa", createdAt: 0 }],
      [
        { date: "2026-10-18", tipo: "peso", valor: 90, createdAt: 0 },
        { date: "2026-10-25", tipo: "peso", valor: 89, createdAt: 0 },
      ],
      c,
    );
    expect(m.diasRegistrados).toBe(3);
    expect(m.mediaKcal).toBe(2100);
    expect(m.diasDentroKcal).toBe(2); // 2300 estoura; 2100 em dia de treino (meta 2200) conta como dentro
    expect(m.diasProteinaOk).toBe(2);
    expect(m.refeicoesFora).toBe(1);
    expect(m.treinos).toBe(1);
    expect(m.variacaoPesoKg).toBe(-1); // média 7d: 90 antes da semana, 89 no fim
  });
});
