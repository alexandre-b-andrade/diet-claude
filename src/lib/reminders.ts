import type { Activity, Meal, Measurement } from "./db";

export interface ReminderSettings {
  enabled: boolean;
  /** Dias da semana para pesar (0 = domingo … 6 = sábado). */
  pesagemDias: number[];
  pesagemHora: string; // HH:MM
  cinturaDia: number | null;
  cinturaHora: string;
  /** Horários de lembrete para registrar refeições. */
  refeicoesHoras: string[];
}

export const REMINDER_DEFAULTS: ReminderSettings = {
  enabled: false,
  pesagemDias: [1, 3, 5],
  pesagemHora: "07:00",
  cinturaDia: 1,
  cinturaHora: "07:05",
  refeicoesHoras: ["09:00", "14:00", "21:00"],
};

export interface DueReminder {
  id: string; // único por dia, ex. "2026-10-25:pesagem"
  tipo: "pesagem" | "cintura" | "refeicao";
  hora: string;
  titulo: string;
  corpo: string;
}

interface Estado {
  hoje: string;
  agora: string; // HH:MM
  diaSemana: number;
  pesouHoje: boolean;
  mediuCinturaHoje: boolean;
  refeicoesHoje: Pick<Meal, "hora">[];
}

/** Lembretes marcados como feitos ou adiados: id → timestamp até quando ficam ocultos. */
export type Dismissed = Record<string, number>;

/** Lembretes cujo horário já passou hoje, cuja ação ainda não foi feita e que não foram dispensados. */
export function lembretesDevidos(s: ReminderSettings, e: Estado, dismissed: Dismissed = {}, agoraMs = Date.now()): DueReminder[] {
  if (!s.enabled) return [];
  const out: DueReminder[] = [];
  if (s.pesagemDias.includes(e.diaSemana) && e.agora >= s.pesagemHora && !e.pesouHoje) {
    out.push({ id: `${e.hoje}:pesagem`, tipo: "pesagem", hora: s.pesagemHora, titulo: "Dia de pesar", corpo: "Suba na balança em jejum e registre o peso." });
  }
  if (s.cinturaDia !== null && s.cinturaDia === e.diaSemana && e.agora >= s.cinturaHora && !e.mediuCinturaHoje) {
    out.push({ id: `${e.hoje}:cintura`, tipo: "cintura", hora: s.cinturaHora, titulo: "Medir a cintura", corpo: "Fita na altura do umbigo, sem apertar." });
  }
  for (const h of s.refeicoesHoras) {
    if (e.agora < h) continue;
    // Considera feito se houve refeição registrada nas 3 horas anteriores ao lembrete.
    const [hh, mm] = h.split(":").map(Number);
    const minLembrete = hh * 60 + mm;
    const feito = e.refeicoesHoje.some((m) => {
      const [a, b] = m.hora.split(":").map(Number);
      const t = a * 60 + b;
      return t >= minLembrete - 180 && t <= minLembrete + 30;
    });
    if (!feito) out.push({ id: `${e.hoje}:refeicao:${h}`, tipo: "refeicao", hora: h, titulo: "Registrar refeição", corpo: "Conte ao coach o que comeu ou mande a foto." });
  }
  return out.filter((r) => !(dismissed[r.id] && dismissed[r.id] > agoraMs));
}

export function estadoDoDia(hoje: string, now: Date, medidasHoje: Measurement[], refeicoesHoje: Meal[], _treinos: Activity[] = []): Estado {
  return {
    hoje,
    agora: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    diaSemana: now.getDay(),
    pesouHoje: medidasHoje.some((m) => m.tipo === "peso"),
    mediuCinturaHoje: medidasHoje.some((m) => m.tipo === "cintura"),
    refeicoesHoje,
  };
}
