import { addDays, fromDateKey, todayKey } from "./dates";

export interface Ponto {
  date: string;
  valor: number;
}

/** Último valor por dia (se houver mais de um registro no mesmo dia, fica o mais recente). */
export function umPorDia(pontos: { date: string; valor: number; createdAt?: number }[]): Ponto[] {
  const m = new Map<string, { valor: number; createdAt: number }>();
  for (const p of pontos) {
    const cur = m.get(p.date);
    if (!cur || (p.createdAt ?? 0) >= cur.createdAt) m.set(p.date, { valor: p.valor, createdAt: p.createdAt ?? 0 });
  }
  return [...m.entries()].map(([date, v]) => ({ date, valor: v.valor })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Média móvel dos últimos `janela` dias corridos (não registros). */
export function mediaMovel(pontos: Ponto[], janela = 7): Ponto[] {
  return pontos.map((p) => {
    const inicio = addDays(p.date, -(janela - 1));
    const dentro = pontos.filter((q) => q.date >= inicio && q.date <= p.date);
    const media = dentro.reduce((s, q) => s + q.valor, 0) / dentro.length;
    return { date: p.date, valor: Math.round(media * 100) / 100 };
  });
}

export interface Tendencia {
  /** Variação por semana na unidade do valor (kg/semana, cm/semana). */
  porSemana: number;
  /** Quantidade de pontos usados. */
  n: number;
  dias: number;
}

/** Regressão linear simples sobre os últimos `dias` dias. */
export function tendencia(pontos: Ponto[], dias = 28, hoje = todayKey()): Tendencia | undefined {
  const inicio = addDays(hoje, -(dias - 1));
  const sel = pontos.filter((p) => p.date >= inicio);
  if (sel.length < 3) return undefined;
  const x = sel.map((p) => (fromDateKey(p.date).getTime() - fromDateKey(sel[0].date).getTime()) / 86400000);
  const y = sel.map((p) => p.valor);
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  if (den === 0) return undefined;
  const porDia = num / den;
  return { porSemana: Math.round(porDia * 7 * 100) / 100, n: sel.length, dias };
}

export interface Projecao {
  semanas: number;
  dataPrevista: string;
}

/** Quando a meta será atingida no ritmo atual. Indefinido se a tendência vai na direção errada ou é nula. */
export function projecao(atual: number, meta: number, t: Tendencia | undefined, hoje = todayKey()): Projecao | undefined {
  if (!t || Math.abs(t.porSemana) < 0.01) return undefined;
  const falta = meta - atual;
  if (falta === 0) return { semanas: 0, dataPrevista: hoje };
  if (Math.sign(falta) !== Math.sign(t.porSemana)) return undefined;
  const semanas = Math.round((falta / t.porSemana) * 10) / 10;
  if (semanas > 260) return undefined;
  return { semanas, dataPrevista: addDays(hoje, Math.round(semanas * 7)) };
}

/** Classifica a velocidade de perda ou ganho em relação ao peso corporal. */
export function ritmoSemanalPct(porSemana: number, pesoKg: number): number {
  return pesoKg ? Math.round((porSemana / pesoKg) * 1000) / 10 : 0;
}
