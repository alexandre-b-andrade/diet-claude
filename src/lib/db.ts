import Dexie, { type EntityTable } from "dexie";

export interface Conversation {
  id?: number;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id?: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  /** Preenchido quando a resposta foi interrompida ou falhou. */
  error?: string;
}

export interface UsageRecord {
  id?: number;
  createdAt: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

class DietCoachDB extends Dexie {
  conversations!: EntityTable<Conversation, "id">;
  messages!: EntityTable<ChatMessage, "id">;
  usage!: EntityTable<UsageRecord, "id">;

  constructor() {
    super("dietcoach");
    this.version(1).stores({
      conversations: "++id, updatedAt",
      messages: "++id, conversationId, createdAt",
      usage: "++id, createdAt, model",
    });
  }
}

export const db = new DietCoachDB();

export async function wipeAllData() {
  await db.delete();
  await db.open();
}
