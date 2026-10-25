import { z } from "zod";
import { db, type DocumentoTipo } from "../lib/db";
import type { CoachTool } from "./tools";

function tool<S extends z.ZodType>(t: CoachTool<S>): CoachTool<S> {
  return t;
}
const opt = <T extends z.ZodType>(s: T) => s.nullish();

const TIPOS: [DocumentoTipo, ...DocumentoTipo[]] = ["plano", "nutricionista", "laudo", "exame", "tabela", "receita", "outro"];

export const salvarDocumento = tool({
  name: "salvar_documento",
  description:
    "Salva na biblioteca do usuário o resumo estruturado de um documento que ele enviou (plano alimentar, orientações do nutricionista, laudo de bioimpedância, exame, tabela nutricional, receita). O arquivo não é guardado: capriche no resumo em Markdown com tudo que será útil depois (refeições e porções do plano, regras, valores de exames, ingredientes e macros da receita). Para exames, registre também cada valor com registrar_exame; para bioimpedância, registrar_bioimpedancia; para tabelas de alimentos, salvar_alimento.",
  schema: z.object({
    titulo: z.string(),
    tipo: z.enum(TIPOS),
    data: opt(z.string().describe("Data do documento, YYYY-MM-DD")),
    resumo: z.string().describe("Resumo estruturado em Markdown"),
    dados: opt(z.string().describe("JSON em texto com os dados extraídos, se útil")),
    arquivoNome: opt(z.string()),
  }),
  async run(input) {
    const now = Date.now();
    const id = await db.documents.add({
      titulo: input.titulo,
      tipo: input.tipo,
      data: input.data ?? undefined,
      resumo: input.resumo,
      dados: input.dados ?? undefined,
      arquivoNome: input.arquivoNome ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
    return { result: JSON.stringify({ ok: true, id }), summary: `Documento salvo: ${input.titulo} (${input.tipo})` };
  },
});

export const atualizarDocumento = tool({
  name: "atualizar_documento",
  description: "Atualiza título, tipo, data, resumo ou dados de um documento salvo (id na lista do contexto).",
  schema: z.object({
    id: z.number(),
    titulo: opt(z.string()),
    tipo: opt(z.enum(TIPOS)),
    data: opt(z.string()),
    resumo: opt(z.string()),
    dados: opt(z.string()),
  }),
  async run(input) {
    const cur = await db.documents.get(input.id);
    if (!cur) return { result: JSON.stringify({ ok: false, erro: "Documento não encontrado" }), summary: `Documento ${input.id} não encontrado` };
    const patch = Object.fromEntries(Object.entries(input).filter(([k, v]) => k !== "id" && v !== null && v !== undefined));
    await db.documents.update(input.id, { ...patch, updatedAt: Date.now() });
    return { result: JSON.stringify({ ok: true }), summary: `Documento atualizado: ${patch.titulo ?? cur.titulo}` };
  },
});

export const removerDocumento = tool({
  name: "remover_documento",
  description: "Remove um documento da biblioteca pelo id. Confirme com o usuário antes.",
  schema: z.object({ id: z.number() }),
  async run(input) {
    const cur = await db.documents.get(input.id);
    if (!cur) return { result: JSON.stringify({ ok: false }), summary: `Documento ${input.id} não encontrado` };
    await db.documents.delete(input.id);
    return { result: JSON.stringify({ ok: true }), summary: `Documento removido: ${cur.titulo}` };
  },
});

export const consultarDocumento = tool({
  name: "consultar_documento",
  description: "Retorna o resumo completo e os dados de um documento salvo (id na lista do contexto). Use quando precisar de detalhes do plano, do laudo ou da receita.",
  schema: z.object({ id: z.number() }),
  async run(input) {
    const doc = await db.documents.get(input.id);
    if (!doc) return { result: JSON.stringify({ ok: false, erro: "Documento não encontrado" }), summary: `Documento ${input.id} não encontrado` };
    return { result: JSON.stringify(doc), summary: `Documento consultado: ${doc.titulo}` };
  },
});

export const DOC_TOOLS: CoachTool[] = [salvarDocumento, atualizarDocumento, removerDocumento, consultarDocumento];
