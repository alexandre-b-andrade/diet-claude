import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { todayKey } from "../lib/dates";
import { estadoDoDia, lembretesDevidos, type Dismissed, type DueReminder } from "../lib/reminders";
import { useSettings } from "../lib/settings";

const FIRED_KEY = "dietcoach.remindersFired";
const DISMISSED_KEY = "dietcoach.remindersDismissed";

function firedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    const hoje = todayKey();
    return new Set(arr.filter((id) => id.startsWith(hoje)));
  } catch {
    return new Set();
  }
}

function markFired(id: string) {
  const s = firedSet();
  s.add(id);
  localStorage.setItem(FIRED_KEY, JSON.stringify([...s]));
}

function loadDismissed(): Dismissed {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const d = raw ? (JSON.parse(raw) as Dismissed) : {};
    const now = Date.now();
    // Limpa entradas vencidas.
    return Object.fromEntries(Object.entries(d).filter(([, until]) => until > now));
  } catch {
    return {};
  }
}

function saveDismissed(d: Dismissed) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(d));
}

export async function showNotification(r: DueReminder) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const opts: NotificationOptions = { body: r.corpo, tag: r.id, icon: "icons/icon-192.png" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(r.titulo, opts);
    else new Notification(r.titulo, opts);
  } catch {
    /* alguns navegadores bloqueiam fora de gesto do usuário */
  }
}

function setBadge(n: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (n > 0) void nav.setAppBadge?.(n);
    else void nav.clearAppBadge?.();
  } catch {
    /* sem suporte */
  }
}

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Lembretes devidos agora (reativo ao banco e às dispensas), notificação local uma vez por
 * lembrete por dia, badge no ícone do app e rechecagem ao voltar para o app.
 */
export function useReminders(tickMs = 60_000) {
  const { settings } = useSettings();
  const hoje = todayKey();
  const medidas = useLiveQuery(() => db.measurements.where("date").equals(hoje).toArray(), [hoje]);
  const refeicoes = useLiveQuery(() => db.meals.where("date").equals(hoje).toArray(), [hoje]);
  const [dismissed, setDismissed] = useState<Dismissed>(loadDismissed);
  const [tick, setTick] = useState(0);

  const due = medidas && refeicoes ? lembretesDevidos(settings.reminders, estadoDoDia(hoje, new Date(), medidas, refeicoes), dismissed) : [];

  // Rechecagem periódica e ao voltar para o app.
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const t = setInterval(bump, tickMs);
    const onVis = () => document.visibilityState === "visible" && bump();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", bump);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", bump);
    };
  }, [tickMs]);

  // Notificação e badge.
  useEffect(() => {
    setBadge(settings.reminders.enabled ? due.length : 0);
    if (!settings.reminders.enabled) return;
    const fired = firedSet();
    for (const r of due) {
      if (!fired.has(r.id)) {
        markFired(r.id);
        void showNotification(r);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due.map((d) => d.id).join("|"), settings.reminders.enabled, tick]);

  const dismiss = useCallback((id: string, until: number) => {
    const next = { ...loadDismissed(), [id]: until };
    saveDismissed(next);
    setDismissed(next);
  }, []);

  /** Marca como feito por hoje. */
  const done = useCallback((id: string) => dismiss(id, endOfToday()), [dismiss]);
  /** Adia por N minutos (padrão 60). */
  const snooze = useCallback((id: string, minutos = 60) => dismiss(id, Date.now() + minutos * 60_000), [dismiss]);

  return { due, done, snooze };
}
