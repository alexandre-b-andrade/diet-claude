import { db, getCombinadosAtivos, getCombinadosPendentes, getProfile, type Activity, type Combinados, type Meal, type Profile, type UserDocument } from "../lib/db";
import { addDays, todayKey } from "../lib/dates";
import { calcularSaldo, resumoDia, somarRefeicoes, type Saldo } from "../lib/diary";
import { mediaMovel, projecao, tendencia, umPorDia } from "../lib/body";

/** Tudo o que o coach precisa saber além do prompt fixo. */
export interface CoachContext {
  profile?: Profile;
  combinados?: Combinados;
  /** Proposta ainda não aprovada, diferente da vigente. */
  combinadosPendentes?: Combinados;
  hoje: string;
  refeicoesHoje: Meal[];
  aguaHojeMl: number;
  saldoHoje?: Saldo;
  resumoOntem?: string;
  treinosHoje: Activity[];
  /** Resumo textual de peso, medidas, bioimpedância, sono/passos e exames recentes. */
  corpo: string;
  documentos: UserDocument[];
}

export async function loadCoachContext(): Promise<CoachContext> {
  const hoje = todayKey();
  const ontem = addDays(hoje, -1);
  const [profile, combinados, pendentes, refeicoesHoje, aguaHoje, refeicoesOntem, aguaOntem, treinosHoje, corpo, documentos] = await Promise.all([
    getProfile(),
    getCombinadosAtivos(),
    getCombinadosPendentes(),
    db.meals.where("date").equals(hoje).sortBy("hora"),
    db.water.where("date").equals(hoje).toArray(),
    db.meals.where("date").equals(ontem).sortBy("hora"),
    db.water.where("date").equals(ontem).toArray(),
    db.activities.where("date").equals(hoje).toArray(),
    resumoCorpo(hoje),
    db.documents.toArray(),
  ]);
  const aguaHojeMl = aguaHoje.reduce((s, w) => s + w.ml, 0);
  const saldoHoje = combinados ? calcularSaldo(somarRefeicoes(refeicoesHoje), combinados, treinosHoje.length > 0) : undefined;
  return {
    profile,
    combinados,
    combinadosPendentes: pendentes && pendentes.id !== combinados?.id ? pendentes : undefined,
    hoje,
    refeicoesHoje,
    aguaHojeMl,
    saldoHoje,
    resumoOntem: refeicoesOntem.length ? resumoDia(ontem, refeicoesOntem, aguaOntem.reduce((s, w) => s + w.ml, 0)) : undefined,
    treinosHoje,
    corpo,
    documentos: documentos.sort((a, b) => b.createdAt - a.createdAt),
  };
}

/** Lista de documentos para o prompt: planos e orientações completos (limitados), demais em uma linha. */
export function resumoDocumentos(docs: UserDocument[]): string {
  if (!docs.length) return "Nenhum documento na biblioteca.";
  const LIMITE = 2500;
  return docs
    .map((d) => {
      const cab = `- [id ${d.id}] ${d.tipo} · ${d.titulo}${d.data ? ` (${d.data})` : ""}`;
      if (d.tipo === "plano" || d.tipo === "nutricionista") {
        const r = d.resumo.length > LIMITE ? `${d.resumo.slice(0, LIMITE)}\n… (use consultar_documento para o restante)` : d.resumo;
        return `${cab}\n${r}`;
      }
      const linha = d.resumo.replace(/\s+/g, " ").slice(0, 160);
      return `${cab}: ${linha}${d.resumo.length > 160 ? "…" : ""}`;
    })
    .join("\n");
}

/** Texto compacto com o estado corporal recente para o prompt. */
export async function resumoCorpo(hoje: string): Promise<string> {
  const inicio90 = addDays(hoje, -89);
  const [pesos, medidas, bios, daily, labs, treinos7] = await Promise.all([
    db.measurements.where("tipo").equals("peso").toArray(),
    db.measurements.where("date").aboveOrEqual(inicio90).filter((m) => m.tipo !== "peso").toArray(),
    db.bioimpedance.toArray(),
    db.daily.where("date").between(addDays(hoje, -6), hoje, true, true).toArray(),
    db.labs.toArray(),
    db.activities.where("date").between(addDays(hoje, -6), hoje, true, true).toArray(),
  ]);
  const linhas: string[] = [];
  const serie = umPorDia(pesos);
  if (serie.length) {
    const ma = mediaMovel(serie, 7);
    const t = tendencia(serie, 28, hoje);
    const profile = await getProfile();
    const proj = profile?.metaPesoKg ? projecao(ma.at(-1)!.valor, profile.metaPesoKg, t, hoje) : undefined;
    linhas.push(
      `Peso: último ${serie.at(-1)!.valor} kg em ${serie.at(-1)!.date}; média 7d ${ma.at(-1)!.valor} kg; ${serie.length} registros` +
        (t ? `; tendência ${t.porSemana > 0 ? "+" : ""}${t.porSemana} kg/semana (${t.n} pontos em ${t.dias} dias)` : "; tendência indisponível (menos de 3 pontos em 28 dias)") +
        (proj ? `; no ritmo atual a meta de ${profile!.metaPesoKg} kg chega em ~${proj.semanas} semanas (${proj.dataPrevista})` : ""),
    );
    const ult = serie.slice(-10).map((p) => `${p.date.slice(5)}: ${p.valor}`).join(", ");
    linhas.push(`Últimos pesos: ${ult}`);
  }
  for (const tipo of ["cintura", "quadril", "pescoco", "peito", "braco", "coxa"] as const) {
    const s = umPorDia(medidas.filter((m) => m.tipo === tipo));
    if (s.length) linhas.push(`${tipo[0].toUpperCase()}${tipo.slice(1)}: ${s.slice(-6).map((p) => `${p.date.slice(5)}: ${p.valor} cm`).join(", ")}`);
  }
  const bio = bios.sort((a, b) => a.date.localeCompare(b.date));
  if (bio.length) {
    const fmt = (b: (typeof bio)[number]) =>
      [b.gorduraPct != null ? `${b.gorduraPct}% gordura` : null, b.massaMagraKg != null ? `${b.massaMagraKg} kg magra` : null, b.massaMuscularKg != null ? `${b.massaMuscularKg} kg músculo` : null, b.gorduraVisceral != null ? `visceral ${b.gorduraVisceral}` : null, b.aguaPct != null ? `água ${b.aguaPct}%` : null, b.tmbKcal != null ? `TMB ${b.tmbKcal}` : null]
        .filter(Boolean)
        .join(", ");
    linhas.push(`Bioimpedância: ${bio.slice(-3).map((b) => `${b.date}: ${fmt(b)}`).join(" | ")}`);
  }
  if (treinos7.length) linhas.push(`Treinos (7 dias): ${treinos7.map((a) => `${a.date.slice(5)} ${a.tipo} ${a.duracaoMin}min ${a.intensidade}`).join("; ")}`);
  if (daily.length) linhas.push(`Sono/passos (7 dias): ${daily.map((d) => `${d.date.slice(5)}: ${d.sonoHoras != null ? `${d.sonoHoras}h` : "-"} / ${d.passos != null ? `${d.passos} passos` : "-"}`).join("; ")}`);
  if (labs.length) {
    const porExame = new Map<string, typeof labs>();
    for (const l of labs) porExame.set(l.exame, [...(porExame.get(l.exame) ?? []), l]);
    linhas.push(
      `Exames: ${[...porExame.entries()].map(([ex, ls]) => { const s = ls.sort((a, b) => a.date.localeCompare(b.date)); const u = s.at(-1)!; return `${ex} ${u.valor}${u.unidade ? ` ${u.unidade}` : ""} (${u.date}${u.referencia ? `, ref ${u.referencia}` : ""}${s.length > 1 ? `, antes ${s.at(-2)!.valor}` : ""})`; }).join("; ")}`,
    );
  }
  return linhas.length ? linhas.join("\n") : "Sem registros corporais ainda.";
}
