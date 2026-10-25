import { describe, expect, it } from "vitest";
import { REMINDER_DEFAULTS, lembretesDevidos } from "./reminders";

const base = { hoje: "2026-10-26", agora: "09:30", diaSemana: 1, pesouHoje: false, mediuCinturaHoje: false, refeicoesHoje: [] as { hora: string }[] };

describe("reminders", () => {
  it("nothing when disabled", () => {
    expect(lembretesDevidos(REMINDER_DEFAULTS, base)).toEqual([]);
  });

  it("weigh-in and waist due on Monday morning, meal reminder at 09:00", () => {
    const r = lembretesDevidos({ ...REMINDER_DEFAULTS, enabled: true }, base);
    expect(r.map((x) => x.tipo)).toEqual(["pesagem", "cintura", "refeicao"]);
  });

  it("done actions suppress reminders", () => {
    const r = lembretesDevidos({ ...REMINDER_DEFAULTS, enabled: true }, { ...base, pesouHoje: true, mediuCinturaHoje: true, refeicoesHoje: [{ hora: "08:10" }] });
    expect(r).toEqual([]);
  });

  it("not a weigh-in day", () => {
    const r = lembretesDevidos({ ...REMINDER_DEFAULTS, enabled: true }, { ...base, diaSemana: 2, agora: "08:00" });
    expect(r).toEqual([]);
  });
});
