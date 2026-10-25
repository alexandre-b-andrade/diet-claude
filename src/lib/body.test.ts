import { describe, expect, it } from "vitest";
import { mediaMovel, projecao, tendencia, umPorDia } from "./body";

describe("body", () => {
  it("keeps the latest value per day", () => {
    const r = umPorDia([
      { date: "2026-10-20", valor: 90, createdAt: 1 },
      { date: "2026-10-20", valor: 89.5, createdAt: 2 },
      { date: "2026-10-19", valor: 90.2, createdAt: 1 },
    ]);
    expect(r).toEqual([
      { date: "2026-10-19", valor: 90.2 },
      { date: "2026-10-20", valor: 89.5 },
    ]);
  });

  it("moving average over calendar days", () => {
    const pts = [
      { date: "2026-10-01", valor: 90 },
      { date: "2026-10-03", valor: 89 },
      { date: "2026-10-10", valor: 88 },
    ];
    const ma = mediaMovel(pts, 7);
    expect(ma[1].valor).toBe(89.5); // 01 e 03 dentro de 7 dias
    expect(ma[2].valor).toBe(88); // 10 sozinho
  });

  it("estimates weekly trend and projection", () => {
    const pts = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      valor: 90 - i * 0.1, // -0.7 kg/semana
    }));
    const t = tendencia(pts, 28, "2026-10-14");
    expect(t?.porSemana).toBeCloseTo(-0.7, 1);
    const p = projecao(88.7, 85, t, "2026-10-14");
    expect(p?.semanas).toBeCloseTo(5.3, 0);
    expect(projecao(88.7, 95, t, "2026-10-14")).toBeUndefined(); // direção errada
  });

  it("needs at least 3 points", () => {
    expect(tendencia([{ date: "2026-10-01", valor: 90 }], 28, "2026-10-14")).toBeUndefined();
  });
});
