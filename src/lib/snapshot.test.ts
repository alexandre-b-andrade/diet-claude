import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { backupSize, deleteSnapshot, getSnapshot, PRE_DEMO, saveSnapshot } from "./snapshot";
import type { Backup } from "./backup";

describe("snapshot", () => {
  it("stores and restores a backup copy", async () => {
    const b: Backup = { app: "diet-coach", version: 1, exportedAt: "x", tables: { meals: [{ id: 1 }], profile: [{ id: 1 }] } };
    expect(backupSize(b)).toBe(2);
    await saveSnapshot(PRE_DEMO, b);
    const s = await getSnapshot(PRE_DEMO);
    expect(s?.backup.tables.meals).toHaveLength(1);
    await deleteSnapshot(PRE_DEMO);
    expect(await getSnapshot(PRE_DEMO)).toBeUndefined();
  });
});
