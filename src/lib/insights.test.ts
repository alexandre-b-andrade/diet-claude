import { describe, expect, it } from "vitest";
import type { Combinados, Meal } from "./db";
import { gerarInsights } from "./insights";

const c = { metaKcal: 2000, metaProteinaG: 150, treinoAjusteKcal: 200, aguaMl: 3000 } as Combinados;
const meal = (date: string, kcal: number, proteinaG: number): Meal => ({ date, hora: "12:00", refeicao: "Almoço", descricao: "", itens: [], kcal, proteinaG, carboG: 0, gorduraG: 0, fibraG: 0, classificacao: "dentro", createdAt: 0 });

describe("insights", () => {
  it("flags low protein across the week", () => {
    const meals = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map((d) => meal(d, 1800, 90));
    const r = gerarInsights({ hoje: "2026-10-25", horaAgora: 10, combinados: c, meals7: meals, water7: [], activities7: [], pesos: [], cinturas: [] });
    expect(r.some((x) => x.nivel === "atencao" && x.texto.includes("Proteína"))).toBe(true);
  });

  it("praises a healthy weight-loss pace", () => {
    const pesos = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(15 + i).padStart(2, "0")}`, tipo: "peso" as const, valor: 90 - i * 0.09, createdAt: 0 }));
    const r = gerarInsights({ hoje: "2026-10-25", horaAgora: 10, profile: { id: 1, status: "active", objetivo: "emagrecer", createdAt: 0, updatedAt: 0 }, combinados: c, meals7: [], water7: [], activities7: [], pesos, cinturas: [] });
    expect(r.some((x) => x.nivel === "positivo" && x.texto.includes("ritmo saudável"))).toBe(true);
  });

  it("warns when weight rises while cutting", () => {
    const pesos = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(15 + i).padStart(2, "0")}`, tipo: "peso" as const, valor: 90 + i * 0.1, createdAt: 0 }));
    const r = gerarInsights({ hoje: "2026-10-25", horaAgora: 10, profile: { id: 1, status: "active", objetivo: "emagrecer", createdAt: 0, updatedAt: 0 }, combinados: c, meals7: [], water7: [], activities7: [], pesos, cinturas: [] });
    expect(r.some((x) => x.nivel === "atencao" && x.texto.includes("tendência de alta"))).toBe(true);
  });

  it("reminds to log after 14h with nothing logged", () => {
    const r = gerarInsights({ hoje: "2026-10-25", horaAgora: 15, combinados: c, meals7: [], water7: [], activities7: [], pesos: [], cinturas: [] });
    expect(r.some((x) => x.texto.includes("Nada registrado hoje"))).toBe(true);
  });
});
