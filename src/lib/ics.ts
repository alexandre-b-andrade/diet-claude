import type { ReminderSettings } from "./reminders";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Data/hora local flutuante (sem fuso), interpretada no fuso do calendário do usuário. */
function dtLocal(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(h)}${pad(m)}00`;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Quebra linhas acima de 75 octetos conforme RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = " " + rest.slice(73);
  }
  out.push(rest);
  return out.join("\r\n");
}

interface Evento {
  uid: string;
  titulo: string;
  descricao: string;
  hora: string;
  rrule: string;
  duracaoMin: number;
}

export function eventosDosLembretes(s: ReminderSettings, appUrl: string): Evento[] {
  const ev: Evento[] = [];
  if (s.pesagemDias.length) {
    ev.push({
      uid: "pesagem@dietcoach",
      titulo: "Diet Coach: pesar",
      descricao: `Suba na balança em jejum e registre o peso no app.\n${appUrl}#/registros/corpo`,
      hora: s.pesagemHora,
      rrule: `FREQ=WEEKLY;BYDAY=${[...s.pesagemDias].sort().map((d) => BYDAY[d]).join(",")}`,
      duracaoMin: 15,
    });
  }
  if (s.cinturaDia !== null) {
    ev.push({
      uid: "cintura@dietcoach",
      titulo: "Diet Coach: medir cintura",
      descricao: `Fita na altura do umbigo, sem apertar. Registre no app.\n${appUrl}#/registros/corpo`,
      hora: s.cinturaHora,
      rrule: `FREQ=WEEKLY;BYDAY=${BYDAY[s.cinturaDia]}`,
      duracaoMin: 15,
    });
  }
  for (const h of s.refeicoesHoras) {
    ev.push({
      uid: `refeicao-${h.replace(":", "")}@dietcoach`,
      titulo: "Diet Coach: registrar refeição",
      descricao: `Conte ao coach o que comeu ou mande a foto.\n${appUrl}#/chat`,
      hora: h,
      rrule: "FREQ=DAILY",
      duracaoMin: 15,
    });
  }
  return ev;
}

/** Gera um calendário .ics com os lembretes recorrentes e alarme na hora do evento. */
export function gerarIcs(s: ReminderSettings, appUrl: string, inicio = new Date(), stamp = new Date()): string {
  const eventos = eventosDosLembretes(s, appUrl);
  const dtstamp = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}00Z`;
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Diet Coach//Lembretes//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Diet Coach",
  ];
  for (const e of eventos) {
    const start = dtLocal(inicio, e.hora);
    const [h, m] = e.hora.split(":").map(Number);
    const fim = new Date(inicio);
    fim.setHours(h, m + e.duracaoMin, 0, 0);
    const end = dtLocal(fim, `${pad(fim.getHours())}:${pad(fim.getMinutes())}`);
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `RRULE:${e.rrule}`,
      fold(`SUMMARY:${esc(e.titulo)}`),
      fold(`DESCRIPTION:${esc(e.descricao)}`),
      fold(`URL:${appUrl}`),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(e.titulo)}`),
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");
  return linhas.join("\r\n") + "\r\n";
}
