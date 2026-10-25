import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODEL, type ModelId } from "./pricing";

export interface Settings {
  model: ModelId;
  /** Guardar a API key no aparelho (localStorage) ou só nesta sessão. */
  rememberKey: boolean;
  /** Cotação usada para a estimativa em R$. */
  brlRate: number;
}

const SETTINGS_KEY = "dietcoach.settings";
const API_KEY = "dietcoach.apiKey";

const DEFAULTS: Settings = { model: DEFAULT_MODEL, rememberKey: true, brlRate: 5.5 };

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
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
