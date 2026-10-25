import type { Activity, Combinados, Meal, Measurement, WaterEntry } from "./db";
import { addDays, fromDateKey, toDateKey } from "./dates";
import { mediaMovel, umPorDia } from "./body";
import { somarRefeicoes } from "./diary";

/** Segunda-feira da semana que contém `key`. */
export function inicioSemana(key: string): string {
  const d = fromDateKey(key);
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dow);
  return toDateKey(d);
}

/** Semana completa anterior a `hoje` (segunda a domingo). */
export function semanaAnterior(hoje: string): { inicio: string; fim: string } {
  const inicioAtual = inicioSemana(hoje);
  return { inicio: addDays(inicioAtual, -7), fim: addDays(inicioAtual, -1) };
}

export interface MetricasSemana {
  inicio: string;
  fim: string;
  diasRegistrados: number;
  mediaKcal: number | null;
  mediaProteinaG: number | null;
  mediaCarboG: number | null;
  mediaGorduraG: number | null;
  diasDentroKcal: number;
  diasProteinaOk: number;
  refeicoesFora: number;
  refeicoesAtencao: number;
  totalRefeicoes: number;
  mediaAguaMl: number | null;
  treinos: number;
  minutosTreino: number;
  pesoInicioKg: number | null;
  pesoFimKg: number | null;
  variacaoPesoKg: number | null;
}

export function metricasSemana(
  inicio: string,
  fim: string,
  meals: Meal[],
  water: WaterEntry[],
  activities: Activity[],
  pesos: Measurement[],
  combinados?: Combinados,
): MetricasSemana {
  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = addDays(d, 1)) dias.push(d);
  const porDia = dias.map((d) => {
    const ms = meals.filter((m) => m.date === d);
    const treino = activities.some((a) => a.date === d);
    const t = somarRefeicoes(ms);
    const meta = combinados ? combinados.metaKcal + (treino ? combinados.treinoAjusteKcal : 0) : null;
    return { d, ms, t, meta, registrado: ms.length > 0, agua: water.filter((w) => w.date === d).reduce((s, w) => s + w.ml, 0) };
  });
  const reg = porDia.filter((x) => x.registrado);
  const avg = (f: (x: (typeof reg)[number]) => number) => (reg.length ? Math.round((reg.reduce((s, x) => s + f(x), 0) / reg.length) * 10) / 10 : null);

  const serie = mediaMovel(umPorDia(pesos), 7);
  const pesoAte = (key: string) => serie.filter((p) => p.date <= key).at(-1)?.valor ?? null;
  const pesoInicio = pesoAte(addDays(inicio, -1)) ?? serie.find((p) => p.date >= inicio)?.valor ?? null;
  const pesoFim = pesoAte(fim);

  const acts = activities.filter((a) => a.date >= inicio && a.date <= fim);
  const aguaDias = porDia.filter((x) => x.agua > 0);
  return {
    inicio,
    fim,
    diasRegistrados: reg.length,
    mediaKcal: avg((x) => x.t.kcal) === null ? null : Math.round(avg((x) => x.t.kcal)!),
    mediaProteinaG: avg((x) => x.t.proteinaG),
    mediaCarboG: avg((x) => x.t.carboG),
    mediaGorduraG: avg((x) => x.t.gorduraG),
    diasDentroKcal: reg.filter((x) => x.meta !== null && x.t.kcal <= x.meta * 1.05).length,
    diasProteinaOk: combinados ? reg.filter((x) => x.t.proteinaG >= combinados.metaProteinaG * 0.9).length : 0,
    refeicoesFora: meals.filter((m) => m.classificacao === "fora").length,
    refeicoesAtencao: meals.filter((m) => m.classificacao === "atencao").length,
    totalRefeicoes: meals.length,
    mediaAguaMl: aguaDias.length ? Math.round(aguaDias.reduce((s, x) => s + x.agua, 0) / aguaDias.length) : null,
    treinos: acts.length,
    minutosTreino: acts.reduce((s, a) => s + a.duracaoMin, 0),
    pesoInicioKg: pesoInicio,
    pesoFimKg: pesoFim,
    variacaoPesoKg: pesoInicio !== null && pesoFim !== null ? Math.round((pesoFim - pesoInicio) * 100) / 100 : null,
  };
}

export function metricasEmTexto(m: MetricasSemana): string {
  const l = [
    `Semana ${m.inicio} a ${m.fim}`,
    `Dias com refeições registradas: ${m.diasRegistrados}/7`,
    m.mediaKcal !== null ? `Média nos dias registrados: ${m.mediaKcal} kcal, ${m.mediaProteinaG} g proteína, ${m.mediaCarboG} g carbo, ${m.mediaGorduraG} g gordura` : "Sem refeições registradas",
    `Dias dentro da meta de kcal: ${m.diasDentroKcal}; dias com proteína ≥ 90% da meta: ${m.diasProteinaOk}`,
    `Refeições: ${m.totalRefeicoes} (atenção ${m.refeicoesAtencao}, fora ${m.refeicoesFora})`,
    m.mediaAguaMl !== null ? `Água média: ${m.mediaAguaMl} ml/dia` : "Água não registrada",
    `Treinos: ${m.treinos} (${m.minutosTreino} min)`,
    m.variacaoPesoKg !== null ? `Peso (média 7d): ${m.pesoInicioKg} → ${m.pesoFimKg} kg (${m.variacaoPesoKg > 0 ? "+" : ""}${m.variacaoPesoKg} kg)` : "Peso: dados insuficientes",
  ];
  return l.join("\n");
}
