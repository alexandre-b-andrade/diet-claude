import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { exportBackup, importBackup, validateBackup } from "./backup";

describe("backup", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("round-trips all tables", async () => {
    await db.meals.add({ date: "2026-10-25", hora: "12:00", refeicao: "Almoço", descricao: "x", itens: [], kcal: 500, proteinaG: 30, carboG: 50, gorduraG: 10, fibraG: 5, classificacao: "dentro", createdAt: 1 });
    await db.profile.put({ id: 1, status: "active", pesoAtualKg: 90, createdAt: 1, updatedAt: 1 });
    await db.daily.put({ date: "2026-10-25", sonoHoras: 7, updatedAt: 1 });
    const b = await exportBackup();
    expect(validateBackup(b)).toBe(true);
    expect(b.tables.meals).toHaveLength(1);

    await db.meals.clear();
    await db.profile.clear();
    expect(await db.meals.count()).toBe(0);

    const counts = await importBackup(b, "substituir");
    expect(counts.meals).toBe(1);
    expect(await db.meals.count()).toBe(1);
    expect((await db.profile.get(1))?.pesoAtualKg).toBe(90);
    expect((await db.daily.get("2026-10-25"))?.sonoHoras).toBe(7);
  });

  it("merge keeps existing rows and overwrites by key", async () => {
    await db.measurements.add({ id: 1, date: "2026-10-20", tipo: "peso", valor: 90, createdAt: 1 });
    await db.measurements.add({ id: 2, date: "2026-10-21", tipo: "peso", valor: 89.5, createdAt: 1 });
    const b = await exportBackup();
    (b.tables.measurements as { valor: number }[])[0].valor = 91;
    await db.measurements.add({ id: 3, date: "2026-10-22", tipo: "peso", valor: 89, createdAt: 1 });
    await importBackup(b, "mesclar");
    expect(await db.measurements.count()).toBe(3);
    expect((await db.measurements.get(1))?.valor).toBe(91);
  });

  it("rejects foreign files", () => {
    expect(validateBackup({ foo: 1 })).toBe(false);
    expect(validateBackup({ app: "diet-coach", version: 1, tables: { nope: [] } })).toBe(false);
  });
});
