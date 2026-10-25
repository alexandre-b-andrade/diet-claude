import { z } from "zod";
import { db } from "../lib/db";
import type { CoachTool } from "./tools";

function tool<S extends z.ZodType>(t: CoachTool<S>): CoachTool<S> {
  return t;
}
const opt = <T extends z.ZodType>(s: T) => s.nullish();

export const salvarFechamento = tool({
  name: "salvar_fechamento",
  description:
    "Salva o fechamento de uma semana (segunda a domingo): resumo em Markdown do que aconteceu, o que funcionou, o que ajustar, e os ajustes propostos. Se houver mudança de metas, proponha também com propor_combinados. Chame uma vez por semana fechada; se já existir fechamento para a semana, ele é substituído.",
  schema: z.object({
    semanaInicio: z.string().describe("Segunda-feira, YYYY-MM-DD"),
    semanaFim: z.string().describe("Domingo, YYYY-MM-DD"),
    resumo: z.string().describe("Markdown: números da semana, análise, destaques"),
    ajustes: opt(z.string().describe("Ajustes combinados para a próxima semana, em itens curtos")),
    metricas: opt(z.record(z.string(), z.union([z.number(), z.string(), z.null()]))),
  }),
  async run(input) {
    const existente = await db.reviews.where("semanaInicio").equals(input.semanaInicio).first();
    const row = {
      semanaInicio: input.semanaInicio,
      semanaFim: input.semanaFim,
      resumo: input.resumo,
      ajustes: input.ajustes ?? undefined,
      metricas: input.metricas ?? undefined,
      createdAt: Date.now(),
    };
    if (existente?.id) await db.reviews.update(existente.id, row);
    else await db.reviews.add(row);
    return { result: JSON.stringify({ ok: true }), summary: `Fechamento salvo: semana de ${input.semanaInicio}` };
  },
});

export const listarFechamentos = tool({
  name: "listar_fechamentos",
  description: "Lista os fechamentos semanais anteriores (mais recentes primeiro), com resumo e ajustes.",
  schema: z.object({ limite: opt(z.number().int().min(1).max(20)) }),
  async run(input) {
    const all = (await db.reviews.toArray()).sort((a, b) => b.semanaInicio.localeCompare(a.semanaInicio)).slice(0, input.limite ?? 4);
    return { result: JSON.stringify(all), summary: `Fechamentos consultados: ${all.length}` };
  },
});

export const REVIEW_TOOLS: CoachTool[] = [salvarFechamento, listarFechamentos];
