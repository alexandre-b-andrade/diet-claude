import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { importBackup, validateBackup } from "./backup";
import { buildDemoBackup } from "./demo";
import { calcularSaldo, somarRefeicoes } from "./diary";

describe("demo backup", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("is a valid backup with plausible data", async () => {
    const b = buildDemoBackup(new Date(2026, 9, 30, 12));
    expect(validateBackup(b)).toBe(true);
    const meals = b.tables.meals as { date: string; kcal: number; proteinaG: number; carboG: number; gorduraG: number; fibraG: number }[];
    expect(meals.length).toBeGreaterThan(150);
    const dias = [...new Set(meals.map((m) => m.date))];
    expect(dias.length).toBeGreaterThan(45);
    // média diária plausível para a meta de 1.850–1.900 kcal
    const medias = dias.map((d) => somarRefeicoes(meals.filter((m) => m.date === d)).kcal);
    const media = medias.reduce((a, x) => a + x, 0) / medias.length;
    expect(media).toBeGreaterThan(1400);
    expect(media).toBeLessThan(2300);
    const c = (b.tables.combinados as { status: string }[]).find((x) => x.status === "aprovado");
    expect(c).toBeDefined();
    const saldo = calcularSaldo(somarRefeicoes(meals.filter((m) => m.date === dias[dias.length - 1])), c as never);
    expect(saldo.metaKcal).toBe(1850);
    expect((b.tables.measurements as { tipo: string }[]).filter((m) => m.tipo === "peso").length).toBeGreaterThan(18);
    expect((b.tables.reviews as unknown[]).length).toBeGreaterThanOrEqual(6);
    expect((b.tables.messages as unknown[]).length).toBeGreaterThan(15);
  });

  it("imports into the database", async () => {
    const b = buildDemoBackup(new Date(2026, 9, 30, 12));
    const counts = await importBackup(b, "substituir");
    expect(counts.meals).toBeGreaterThan(150);
    expect((await db.profile.get(1))?.nome).toContain("demonstração");
    expect(await db.reviews.count()).toBeGreaterThanOrEqual(6);
  });

  it("is deterministic for the same date", () => {
    const a = JSON.stringify(buildDemoBackup(new Date(2026, 9, 30, 12)).tables.meals);
    const b = JSON.stringify(buildDemoBackup(new Date(2026, 9, 30, 12)).tables.meals);
    expect(a).toBe(b);
  });
});
