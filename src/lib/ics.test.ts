import { describe, expect, it } from "vitest";
import { eventosDosLembretes, gerarIcs } from "./ics";
import { REMINDER_DEFAULTS } from "./reminders";

describe("ics", () => {
  const s = { ...REMINDER_DEFAULTS, enabled: true };

  it("maps weekdays and meal times to recurring events", () => {
    const ev = eventosDosLembretes(s, "https://x/");
    expect(ev.find((e) => e.uid === "pesagem@dietcoach")?.rrule).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(ev.find((e) => e.uid === "cintura@dietcoach")?.rrule).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(ev.filter((e) => e.rrule === "FREQ=DAILY")).toHaveLength(3);
  });

  it("produces a valid calendar with alarms and floating local times", () => {
    const ics = gerarIcs(s, "https://x/", new Date(2026, 9, 27, 12, 0), new Date(Date.UTC(2026, 9, 25, 17, 0)));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261027T070000");
    expect(ics).toContain("DTEND:20261027T071500");
    expect(ics).toContain("DTSTAMP:20261025T170000Z");
    expect(ics).toContain("TRIGGER:PT0M");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(5);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    // Sem linhas acima de 75 octetos
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });

  it("skips waist when disabled", () => {
    expect(eventosDosLembretes({ ...s, cinturaDia: null }, "u").some((e) => e.uid === "cintura@dietcoach")).toBe(false);
  });
});
