import { z } from "zod";
import { db, upsertProfile, type Measurement, type MedidaTipo } from "../lib/db";
import { addDays, todayKey } from "../lib/dates";
import { mediaMovel, projecao, tendencia, umPorDia } from "../lib/body";
import type { CoachTool } from "./tools";

function tool<S extends z.ZodType>(t: CoachTool<S>): CoachTool<S> {
  return t;
}
const opt = <T extends z.ZodType>(s: T) => s.nullish();

const MEDIDAS: [MedidaTipo, ...MedidaTipo[]] = ["peso", "cintura", "quadril", "pescoco", "peito", "braco", "coxa"];

export const registrarPeso = tool({
  name: "registrar_peso",
  description: "Registra o peso do dia em kg (padrão hoje) e atualiza o peso atual do perfil. Retorna média de 7 dias, tendência semanal e projeção da meta.",
  schema: z.object({ pesoKg: z.number().positive(), date: opt(z.string()), notas: opt(z.string()) }),
  async run(input) {
    const date = input.date ?? todayKey();
    await db.measurements.add({ date, tipo: "peso", valor: input.pesoKg, notas: input.notas ?? undefined, createdAt: Date.now() });
    if (date === todayKey() || !(await db.measurements.where("tipo").equals("peso").filter((m) => m.date > date).first())) {
      await upsertProfile({ pesoAtualKg: input.pesoKg });
    }
    const resumo = await resumoPeso();
    return { result: JSON.stringify({ ok: true, ...resumo }), summary: `Peso registrado: ${input.pesoKg} kg` };
  },
});

export const registrarMedida = tool({
  name: "registrar_medida",
  description: "Registra uma medida corporal em cm: cintura, quadril, pescoço, peito, braço ou coxa (padrão hoje). Cintura também atualiza o perfil.",
  schema: z.object({ tipo: z.enum(MEDIDAS.filter((m) => m !== "peso") as [MedidaTipo, ...MedidaTipo[]]), valorCm: z.number().positive(), date: opt(z.string()), notas: opt(z.string()) }),
  async run(input) {
    const date = input.date ?? todayKey();
    await db.measurements.add({ date, tipo: input.tipo, valor: input.valorCm, notas: input.notas ?? undefined, createdAt: Date.now() });
    if (input.tipo === "cintura") await upsertProfile({ cinturaCm: input.valorCm });
    const hist = umPorDia(await db.measurements.where("tipo").equals(input.tipo).toArray());
    const t = tendencia(hist, 56);
    return {
      result: JSON.stringify({ ok: true, historico: hist.slice(-8), tendenciaPorSemanaCm: t?.porSemana ?? null }),
      summary: `${input.tipo[0].toUpperCase()}${input.tipo.slice(1)} registrada: ${input.valorCm} cm`,
    };
  },
});

export const registrarBioimpedancia = tool({
  name: "registrar_bioimpedancia",
  description:
    "Registra uma bioimpedância (balança ou laudo): % gordura, massa gorda, massa magra, massa muscular, gordura visceral, água, TMB, idade metabólica. Atualiza o perfil e registra o peso se informado. Retorna a medição anterior para comparação.",
  schema: z.object({
    date: opt(z.string()),
    pesoKg: opt(z.number()),
    gorduraPct: opt(z.number()),
    massaGordaKg: opt(z.number()),
    massaMagraKg: opt(z.number()),
    massaMuscularKg: opt(z.number()),
    gorduraVisceral: opt(z.number()),
    aguaPct: opt(z.number()),
    tmbKcal: opt(z.number()),
    idadeMetabolica: opt(z.number()),
    fonte: opt(z.string().describe("Ex.: balança Xiaomi, laudo InBody")),
  }),
  async run(input) {
    const date = input.date ?? todayKey();
    const anterior = (await db.bioimpedance.where("date").below(date).toArray()).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const entry = Object.fromEntries(Object.entries({ ...input, date }).filter(([, v]) => v !== null && v !== undefined)) as Record<string, unknown>;
    const id = await db.bioimpedance.add({ ...(entry as object), date, createdAt: Date.now() });
    if (input.pesoKg) {
      await db.measurements.add({ date, tipo: "peso", valor: input.pesoKg, createdAt: Date.now(), notas: "bioimpedância" });
    }
    const { date: _d, fonte: _f, pesoKg, ...bio } = entry as { date: string; fonte?: string; pesoKg?: number } & Record<string, number | undefined>;
    await upsertProfile({ bioimpedancia: { data: date, ...bio }, ...(pesoKg ? { pesoAtualKg: pesoKg } : {}) });
    return {
      result: JSON.stringify({ ok: true, id, atual: { ...entry }, anterior }),
      summary: `Bioimpedância registrada${input.gorduraPct ? `: ${input.gorduraPct}% gordura` : ""}`,
    };
  },
});

export const registrarTreino = tool({
  name: "registrar_treino",
  description: "Registra um treino ou atividade física do dia (padrão hoje). Com treino registrado, o saldo do dia passa a usar o ajuste de kcal e carboidratos dos Combinados.",
  schema: z.object({
    tipo: z.string().describe("musculação, corrida, bike, natação, caminhada, futebol..."),
    duracaoMin: z.number().int().positive(),
    intensidade: z.enum(["leve", "moderada", "intensa"]),
    kcal: opt(z.number().describe("Gasto estimado, se o usuário informar (relógio/app)")),
    date: opt(z.string()),
    notas: opt(z.string()),
  }),
  async run(input) {
    const date = input.date ?? todayKey();
    await db.activities.add({
      date,
      tipo: input.tipo,
      duracaoMin: input.duracaoMin,
      intensidade: input.intensidade,
      kcal: input.kcal ?? undefined,
      notas: input.notas ?? undefined,
      createdAt: Date.now(),
    });
    const semana = await db.activities.where("date").between(addDays(date, -6), date, true, true).toArray();
    return {
      result: JSON.stringify({ ok: true, treinosNaSemana: semana.length, minutosNaSemana: semana.reduce((s, a) => s + a.duracaoMin, 0) }),
      summary: `Treino registrado: ${input.tipo} ${input.duracaoMin} min (${input.intensidade})`,
    };
  },
});

export const registrarDia = tool({
  name: "registrar_dia",
  description: "Registra sono (horas) e/ou passos do dia (padrão hoje).",
  schema: z.object({ date: opt(z.string()), sonoHoras: opt(z.number()), passos: opt(z.number().int()), notas: opt(z.string()) }),
  async run(input) {
    const date = input.date ?? todayKey();
    const cur = await db.daily.get(date);
    await db.daily.put({
      date,
      sonoHoras: input.sonoHoras ?? cur?.sonoHoras,
      passos: input.passos ?? cur?.passos,
      notas: input.notas ?? cur?.notas,
      updatedAt: Date.now(),
    });
    const partes = [input.sonoHoras != null ? `sono ${input.sonoHoras} h` : null, input.passos != null ? `${input.passos} passos` : null].filter(Boolean);
    return { result: JSON.stringify({ ok: true }), summary: `Dia registrado: ${partes.join(", ") || "notas"}` };
  },
});

export const registrarExame = tool({
  name: "registrar_exame",
  description: "Registra um resultado de exame laboratorial (glicemia, HbA1c, colesterol total, HDL, LDL, triglicerídeos, vitamina D, TSH, etc.) com valor, unidade e referência.",
  schema: z.object({
    exame: z.string(),
    valor: z.number(),
    unidade: opt(z.string()),
    referencia: opt(z.string()),
    date: opt(z.string()),
    notas: opt(z.string()),
  }),
  async run(input) {
    const date = input.date ?? todayKey();
    await db.labs.add({ date, exame: input.exame, valor: input.valor, unidade: input.unidade ?? undefined, referencia: input.referencia ?? undefined, notas: input.notas ?? undefined, createdAt: Date.now() });
    const anteriores = (await db.labs.where("exame").equals(input.exame).toArray()).sort((a, b) => a.date.localeCompare(b.date));
    return { result: JSON.stringify({ ok: true, historico: anteriores.map((l) => ({ date: l.date, valor: l.valor })) }), summary: `Exame registrado: ${input.exame} ${input.valor}${input.unidade ? ` ${input.unidade}` : ""}` };
  },
});

export const consultarHistorico = tool({
  name: "consultar_historico",
  description: "Consulta o histórico corporal: peso (com média móvel, tendência e projeção), medidas, bioimpedância, treinos, sono/passos e exames dos últimos N dias (padrão 30).",
  schema: z.object({
    tipo: z.enum(["peso", "medidas", "bioimpedancia", "treinos", "dia", "exames", "tudo"]),
    dias: opt(z.number().int().min(1).max(730)),
  }),
  async run(input) {
    const dias = input.dias ?? 30;
    const inicio = addDays(todayKey(), -(dias - 1));
    const out: Record<string, unknown> = {};
    const want = (t: string) => input.tipo === "tudo" || input.tipo === t;
    if (want("peso")) out.peso = await resumoPeso(dias);
    if (want("medidas")) {
      const ms = await db.measurements.where("date").aboveOrEqual(inicio).filter((m) => m.tipo !== "peso").toArray();
      out.medidas = Object.fromEntries(MEDIDAS.filter((t) => t !== "peso").map((t) => [t, umPorDia(ms.filter((m) => m.tipo === t))]).filter(([, v]) => (v as unknown[]).length));
    }
    if (want("bioimpedancia")) out.bioimpedancia = (await db.bioimpedance.where("date").aboveOrEqual(inicio).toArray()).sort((a, b) => a.date.localeCompare(b.date));
    if (want("treinos")) out.treinos = await db.activities.where("date").aboveOrEqual(inicio).toArray();
    if (want("dia")) out.dia = await db.daily.where("date").aboveOrEqual(inicio).toArray();
    if (want("exames")) out.exames = (await db.labs.where("date").aboveOrEqual(inicio).toArray()).sort((a, b) => a.date.localeCompare(b.date));
    return { result: JSON.stringify(out), summary: `Histórico consultado: ${input.tipo} (${dias} dias)` };
  },
});

export async function resumoPeso(dias = 90) {
  const inicio = addDays(todayKey(), -(dias - 1));
  const todos = umPorDia(await db.measurements.where("tipo").equals("peso").toArray());
  const serie = todos.filter((p) => p.date >= inicio);
  const ma = mediaMovel(serie, 7);
  const t = tendencia(todos, 28);
  const profile = await db.profile.get(1);
  const atual = serie.at(-1)?.valor ?? profile?.pesoAtualKg;
  const proj = atual && profile?.metaPesoKg ? projecao(ma.at(-1)?.valor ?? atual, profile.metaPesoKg, t) : undefined;
  return {
    atualKg: atual ?? null,
    media7dKg: ma.at(-1)?.valor ?? null,
    tendenciaKgPorSemana: t?.porSemana ?? null,
    metaKg: profile?.metaPesoKg ?? null,
    projecao: proj ?? null,
    pontos: serie.slice(-30),
  };
}

export const BODY_TOOLS: CoachTool[] = [
  registrarPeso,
  registrarMedida,
  registrarBioimpedancia,
  registrarTreino,
  registrarDia,
  registrarExame,
  consultarHistorico,
];

export type { Measurement };
