import Dexie, { type EntityTable } from "dexie";
import type { Backup } from "./backup";

/** Cópias internas de segurança (ex.: dados do usuário antes de carregar a demonstração). */
interface Snapshot {
  id: string;
  createdAt: number;
  backup: Backup;
}

class SnapshotDB extends Dexie {
  snapshots!: EntityTable<Snapshot, "id">;
  constructor() {
    super("dietcoach-snapshots");
    this.version(1).stores({ snapshots: "id" });
  }
}

const sdb = new SnapshotDB();

export const PRE_DEMO = "pre-demo";
const DEMO_FLAG = "dietcoach.demoActive";

export async function saveSnapshot(id: string, backup: Backup) {
  await sdb.snapshots.put({ id, createdAt: Date.now(), backup });
}

export async function getSnapshot(id: string): Promise<{ createdAt: number; backup: Backup } | undefined> {
  const s = await sdb.snapshots.get(id);
  return s ? { createdAt: s.createdAt, backup: s.backup } : undefined;
}

export async function deleteSnapshot(id: string) {
  await sdb.snapshots.delete(id);
}

export function isDemoActive(): boolean {
  return localStorage.getItem(DEMO_FLAG) === "1";
}

export function setDemoActive(v: boolean) {
  if (v) localStorage.setItem(DEMO_FLAG, "1");
  else localStorage.removeItem(DEMO_FLAG);
  window.dispatchEvent(new Event("dietcoach:demo"));
}

/** Quantos registros um backup contém (para saber se há algo a preservar). */
export function backupSize(b: Backup): number {
  return Object.values(b.tables).reduce((s, t) => s + (t?.length ?? 0), 0);
}
