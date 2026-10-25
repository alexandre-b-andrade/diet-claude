/** Registro local dos últimos erros para a tela de diagnóstico. */
export interface ErrorEntry {
  at: string;
  scope: string;
  message: string;
  stack?: string;
}

const KEY = "dietcoach.errors";
const MAX = 20;

export function logError(scope: string, err: unknown) {
  const e = err as { message?: string; stack?: string; status?: number; name?: string };
  const entry: ErrorEntry = {
    at: new Date().toISOString(),
    scope,
    message: `${e?.name ? `${e.name}: ` : ""}${e?.message ?? String(err)}${e?.status ? ` (HTTP ${e.status})` : ""}`,
    stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 4).join("\n") : undefined,
  };
  try {
    const list = loadErrors();
    list.unshift(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* sem storage */
  }
  console.error(`[${scope}]`, err);
}

export function loadErrors(): ErrorEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ErrorEntry[];
  } catch {
    return [];
  }
}

export function clearErrors() {
  localStorage.removeItem(KEY);
}

/** Captura erros não tratados da página inteira. */
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (ev) => logError("window.error", ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => logError("unhandledrejection", ev.reason));
}

export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
