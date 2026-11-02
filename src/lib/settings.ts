import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODEL, type ModelId } from "./pricing";
import { REMINDER_DEFAULTS, type ReminderSettings } from "./reminders";

export interface Settings {
  model: ModelId;
  /** Guardar a API key no aparelho (localStorage) ou só nesta sessão. */
  rememberKey: boolean;
  /** Cotação usada para a estimativa em R$. */
  brlRate: number;
  /** Orçamento mensal em US$ para aviso (0 = sem aviso). */
  monthlyBudgetUsd: number;
  reminders: ReminderSettings;
  /** Busca complementar no USDA FoodData Central quando TACO não encontrar. */
  usdaEnabled: boolean;
  usdaApiKey: string;
  /** Idioma da interface e do coach. */
  language: "pt-BR" | "en";
  /** Limite diário de cafés (xícaras). */
  coffeeMaxCups: number;
  /** Tom das respostas do coach. */
  coachTone: CoachTone;
}

export type CoachTone = "tecnico" | "direto" | "acolhedor" | "equilibrado";

export const COACH_TONES: { id: CoachTone; label: string; description: string }[] = [
  { id: "tecnico", label: "Técnico e detalhado", description: "Explica o porquê nutricional, cita macros, fibras e qualidade dos alimentos. Números sempre." },
  { id: "direto", label: "Direto e objetivo", description: "Respostas curtas, números na frente, pouca conversa. Aponta erros sem rodeios." },
  { id: "acolhedor", label: "Acolhedor e motivador", description: "Reforço positivo, empatia nos deslizes, foco em consistência, sem perder a precisão." },
  { id: "equilibrado", label: "Direto com toque motivador", description: "Números primeiro, uma frase de incentivo ou alerta no fim." },
];

const ADVANCED_KEY = "dietcoach.advanced";

/** Modo avançado: mostra idioma, modelo, USDA, uso/custo e diagnóstico (ocultos por padrão). */
export function isAdvanced(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdvanced(v: boolean) {
  if (v) localStorage.setItem(ADVANCED_KEY, "1");
  else localStorage.removeItem(ADVANCED_KEY);
  notify();
}

const SETTINGS_KEY = "dietcoach.settings";
const API_KEY = "dietcoach.apiKey";

const DEFAULTS: Settings = { model: DEFAULT_MODEL, rememberKey: true, brlRate: 5.5, monthlyBudgetUsd: 0, reminders: REMINDER_DEFAULTS, usdaEnabled: false, usdaApiKey: "", language: "pt-BR", coffeeMaxCups: 3, coachTone: "tecnico" };

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULTS, ...parsed, reminders: { ...REMINDER_DEFAULTS, ...(parsed.reminders ?? {}) } };
    // Fora do modo avançado o app usa sempre Opus 5.5 e português.
    if (!isAdvanced()) {
      merged.model = DEFAULT_MODEL;
      merged.language = "pt-BR";
    }
    return merged;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  notify();
}

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY) ?? sessionStorage.getItem(API_KEY);
  } catch {
    return null;
  }
}

export function setApiKey(key: string | null, remember: boolean) {
  localStorage.removeItem(API_KEY);
  sessionStorage.removeItem(API_KEY);
  if (key) (remember ? localStorage : sessionStorage).setItem(API_KEY, key);
  saveSettings({ rememberKey: remember });
}

/** Hook reativo para configurações e API key. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [apiKey, setKey] = useState<string | null>(getApiKey);

  useEffect(() => {
    const l = () => {
      setSettings(loadSettings());
      setKey(getApiKey());
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => saveSettings(patch), []);
  const updateApiKey = useCallback((key: string | null, remember: boolean) => setApiKey(key, remember), []);

  return { settings, apiKey, update, updateApiKey };
}
