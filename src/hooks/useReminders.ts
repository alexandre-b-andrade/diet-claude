import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { todayKey } from "../lib/dates";
import { estadoDoDia, lembretesDevidos, type DueReminder } from "../lib/reminders";
import { useSettings } from "../lib/settings";

const FIRED_KEY = "dietcoach.remindersFired";

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

/** Lembretes devidos agora (reativo ao banco) e disparo de notificação local uma vez por lembrete por dia. */
export function useReminders(tickMs = 60_000) {
  const { settings } = useSettings();
  const hoje = todayKey();
  const medidas = useLiveQuery(() => db.measurements.where("date").equals(hoje).toArray(), [hoje]);
  const refeicoes = useLiveQuery(() => db.meals.where("date").equals(hoje).toArray(), [hoje]);

  const due = medidas && refeicoes ? lembretesDevidos(settings.reminders, estadoDoDia(hoje, new Date(), medidas, refeicoes)) : [];

  useEffect(() => {
    if (!settings.reminders.enabled) return;
    const check = () => {
      if (!medidas || !refeicoes) return;
      const now = lembretesDevidos(settings.reminders, estadoDoDia(todayKey(), new Date(), medidas, refeicoes));
      const fired = firedSet();
      for (const r of now) {
        if (!fired.has(r.id)) {
          markFired(r.id);
          void showNotification(r);
        }
      }
    };
    check();
    const t = setInterval(check, tickMs);
    return () => clearInterval(t);
  }, [settings.reminders, medidas, refeicoes, tickMs]);

  return due;
}
