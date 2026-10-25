import { ALL_TABLES, db, type TableName } from "./db";

export interface Backup {
  app: "diet-coach";
  version: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

export const BACKUP_VERSION = 1;

export async function exportBackup(): Promise<Backup> {
  const tables: Backup["tables"] = {};
  for (const name of ALL_TABLES) {
    tables[name] = await db.table(name).toArray();
  }
  return { app: "diet-coach", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function validateBackup(x: unknown): x is Backup {
  if (!x || typeof x !== "object") return false;
  const b = x as Partial<Backup>;
  if (b.app !== "diet-coach" || typeof b.version !== "number" || !b.tables || typeof b.tables !== "object") return false;
  return Object.entries(b.tables).every(([k, v]) => (ALL_TABLES as readonly string[]).includes(k) && Array.isArray(v));
}

/**
 * Importa um backup. "substituir" apaga tudo antes; "mesclar" sobrescreve por chave primária
 * e mantém o que não existe no arquivo.
 */
export async function importBackup(b: Backup, modo: "substituir" | "mesclar"): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const tables = ALL_TABLES.map((n) => db.table(n));
  await db.transaction("rw", tables, async () => {
    for (const name of ALL_TABLES) {
      const rows = b.tables[name];
      if (modo === "substituir") await db.table(name).clear();
      if (!rows?.length) continue;
      await db.table(name).bulkPut(rows);
      counts[name] = rows.length;
    }
  });
  return counts;
}

export function backupFileName(d = new Date()): string {
  return `diet-coach-backup-${d.toISOString().slice(0, 10)}.json`;
}
