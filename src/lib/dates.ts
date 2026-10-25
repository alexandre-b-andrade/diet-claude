/** Datas no fuso do aparelho, formato YYYY-MM-DD. */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short" }): string {
  return fromDateKey(key).toLocaleDateString("pt-BR", opts);
}

/** Chaves dos últimos n dias terminando em `end` (inclusive), em ordem crescente. */
export function lastDays(n: number, end = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}
