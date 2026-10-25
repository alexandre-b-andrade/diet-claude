import { useSettings } from "../lib/settings";
import { en } from "./en";
import { pt } from "./pt";

export type Lang = "pt-BR" | "en";
export type Key = keyof typeof pt;

const DICTS: Record<Lang, Partial<Record<Key, string>>> = { "pt-BR": pt, en };

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? pt[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Hook de tradução. Textos sem tradução caem para pt-BR. */
export function useT() {
  const { settings } = useSettings();
  const lang = settings.language;
  return { t: (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), lang };
}
