import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";

describe("upgrade v1 -> current", () => {
  it("opens a database created by the F0 schema", async () => {
    // Banco como a F0 criava
    const old = new Dexie("dietcoach");
    old.version(1).stores({
      conversations: "++id, updatedAt",
      messages: "++id, conversationId, createdAt",
      usage: "++id, createdAt, model",
    });
    await old.open();
    const cid = await old.table("conversations").add({ title: "Teste", createdAt: 1, updatedAt: 1 });
    await old.table("messages").add({ conversationId: cid, role: "user", content: "oi", createdAt: 1 });
    await old.table("usage").add({ createdAt: 1, model: "x", inputTokens: 1, outputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 0, costUsd: 0 });
    old.close();

    const { db } = await import("./db");
    await db.open();
    expect(db.verno).toBe(6);
    const conv = await db.conversations.get(cid as number);
    expect(conv?.kind).toBe("coach");
    expect(await db.messages.count()).toBe(1);
    // gravações pós-migração
    const id = await db.messages.add({ conversationId: cid as number, role: "user", content: "nova", createdAt: 2 });
    expect(id).toBeGreaterThan(1);
    await db.profile.put({ id: 1, status: "onboarding", createdAt: 1, updatedAt: 1 });
    expect((await db.profile.get(1))?.status).toBe("onboarding");
  });
});
