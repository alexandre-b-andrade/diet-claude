import { z } from "zod";
import {
  db,
  getCombinadosAtivos,
  getProfile,
  upsertProfile,
  type Combinados,
  type Profile,
} from "../lib/db";
import { calcularMetas, idadeAnos } from "../lib/metas";

/** Uma ferramenta que o coach pode chamar; executa no aparelho e grava no banco local. */
export interface CoachTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>) => Promise<{ result: string; summary: string }>;
}

function tool<S extends z.ZodType>(t: CoachTool<S>): CoachTool<S> {
  return t;
}

const opt = <T extends z.ZodType>(s: T) => s.nullish();

const bioimpedanciaSchema = z.object({
  data: opt(z.string().describe("Data da medição, YYYY-MM-DD")),
  gorduraPct: opt(z.number()),
  massaGordaKg: opt(z.number()),
  massaMagraKg: opt(z.number()),
  massaMuscularKg: opt(z.number()),
  gorduraVisceral: opt(z.number()),
  aguaPct: opt(z.number()),
  tmbKcal: opt(z.number()),
  idadeMetabolica: opt(z.number()),
});

export const atualizarPerfil = tool({
  name: "atualizar_perfil",
  description:
    "Grava ou atualiza dados do perfil do usuário no aparelho. Chame sempre que o usuário informar dados pessoais, objetivo, rotina, restrições, preferências, treinos, histórico, plano de nutricionista ou bioimpedância. Envie apenas os campos informados; os demais são mantidos.",
  schema: z.object({
    nome: opt(z.string()),
    sexo: opt(z.enum(["masculino", "feminino", "outro"])),
    nascimento: opt(z.string().describe("YYYY-MM-DD")),
    alturaCm: opt(z.number()),
    pesoAtualKg: opt(z.number()),
    cinturaCm: opt(z.number()),
    objetivo: opt(z.enum(["emagrecer", "manter", "ganhar_massa", "saude"])),
    metaPesoKg: opt(z.number()),
    prazo: opt(z.string().describe("Prazo desejado em texto, ex. '3 meses' ou '2026-12-31'")),
    metaDetalhes: opt(z.string().describe("Outras metas: % gordura, cintura, saúde")),
    nivelAtividade: opt(z.enum(["sedentario", "leve", "moderado", "intenso", "muito_intenso"])),
    treinos: opt(z.string().describe("Tipo, frequência e intensidade dos treinos")),
    rotina: opt(z.string().describe("Horários de trabalho, sono, refeições, quem cozinha, dias atípicos")),
    restricoes: opt(z.string().describe("Alergias, intolerâncias, dieta vegetariana etc.")),
    preferencias: opt(z.string().describe("Alimentos que gosta e que evita, orçamento")),
    saude: opt(z.string().describe("Condições de saúde, medicamentos, exames relevantes")),
    historico: opt(z.string().describe("Dietas anteriores, histórico de peso, o que funcionou ou não")),
    planoNutricionista: opt(z.string().describe("Resumo do plano alimentar do nutricionista, se houver")),
    bioimpedancia: opt(bioimpedanciaSchema),
  }),
  async run(input) {
    const patch: Partial<Profile> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== null && v !== undefined) (patch as Record<string, unknown>)[k] = v;
    }
    if (patch.bioimpedancia) {
      patch.bioimpedancia = Object.fromEntries(
        Object.entries(patch.bioimpedancia).filter(([, v]) => v !== null && v !== undefined),
      );
    }
    const profile = await upsertProfile(patch);
    const campos = Object.keys(patch).join(", ");
    return {
      result: JSON.stringify({ ok: true, camposAtualizados: Object.keys(patch), perfil: publicProfile(profile) }),
      summary: `Perfil atualizado: ${campos}`,
    };
  },
});

export const calcularMetasTool = tool({
  name: "calcular_metas",
  description:
    "Calcula TMB (Mifflin-St Jeor ou TMB medida), gasto total, meta calórica, proteína e faixas de carboidrato e gordura a partir do perfil gravado. Use antes de propor Combinados. Pode receber um ajuste calórico diferente do padrão (-500 emagrecer, 0 manter, +300 ganhar massa, -250 saúde).",
  schema: z.object({
    ajusteKcal: opt(z.number().describe("Déficit (negativo) ou superávit (positivo) em kcal/dia")),
  }),
  async run(input) {
    const p = await getProfile();
    const faltam: string[] = [];
    if (!p?.sexo) faltam.push("sexo");
    if (!p?.nascimento) faltam.push("nascimento");
    if (!p?.alturaCm) faltam.push("alturaCm");
    if (!p?.pesoAtualKg) faltam.push("pesoAtualKg");
    if (!p?.nivelAtividade) faltam.push("nivelAtividade");
    if (!p?.objetivo) faltam.push("objetivo");
    if (faltam.length || !p) {
      return {
        result: JSON.stringify({ ok: false, erro: "Perfil incompleto. Pergunte ao usuário e grave com atualizar_perfil.", faltam }),
        summary: `Metas não calculadas: faltam ${faltam.join(", ")}`,
      };
    }
    const metas = calcularMetas({
      sexo: p.sexo!,
      pesoKg: p.pesoAtualKg!,
      alturaCm: p.alturaCm!,
      idade: idadeAnos(p.nascimento!),
      nivelAtividade: p.nivelAtividade!,
      objetivo: p.objetivo!,
      tmbMedidaKcal: p.bioimpedancia?.tmbKcal ?? undefined,
      massaMagraKg: p.bioimpedancia?.massaMagraKg ?? undefined,
      ajusteKcal: input.ajusteKcal ?? undefined,
    });
    return {
      result: JSON.stringify({ ok: true, idade: idadeAnos(p.nascimento!), ...metas }),
      summary: `Metas calculadas: ${metas.metaKcal} kcal, ${metas.metaProteinaG} g proteína`,
    };
  },
});

export const proporCombinados = tool({
  name: "propor_combinados",
  description:
    "Grava uma nova versão dos Combinados (metas e regras de acompanhamento) para o usuário revisar e aprovar na tela Combinados. Use após calcular_metas e após alinhar com o usuário. Cada chamada cria uma nova versão; a anterior fica como histórico.",
  schema: z.object({
    metaKcal: z.number(),
    metaProteinaG: z.number(),
    carboMinG: z.number(),
    carboMaxG: z.number(),
    gorduraMinG: z.number(),
    gorduraMaxG: z.number(),
    fibraG: opt(z.number()),
    aguaMl: opt(z.number()),
    refeicoes: z
      .array(z.object({ nome: z.string(), horario: z.string().describe("HH:MM ou faixa"), descricao: opt(z.string()) }))
      .describe("Refeições do dia com horários"),
    treinoAjusteKcal: z.number().describe("kcal extras em dia de treino; 0 se não houver"),
    treinoAjusteCarboG: z.number().describe("g de carboidrato extras em dia de treino; 0 se não houver"),
    pesagem: z.string().describe("Frequência e condição da pesagem, ex. '3x por semana, em jejum'"),
    cintura: z.string().describe("Frequência da medida de cintura"),
    bioimpedancia: z.string().describe("Frequência da bioimpedância"),
    tom: z.enum(["tecnico", "direto", "acolhedor"]),
    regras: z.array(z.string()).describe("Regras combinadas, uma por item, frases curtas"),
    racional: z.string().describe("Explicação breve de como as metas foram calculadas"),
  }),
  async run(input) {
    const anterior = await getCombinadosAtivos();
    const versao = (await db.combinados.count()) + 1;
    // A versão aprovada continua valendo até o usuário aprovar a nova proposta.
    await db.combinados.where("status").equals("proposto").modify({ status: "substituido" });
    const novo: Combinados = {
      versao,
      status: "proposto",
      createdAt: Date.now(),
      metaKcal: input.metaKcal,
      metaProteinaG: input.metaProteinaG,
      carboMinG: input.carboMinG,
      carboMaxG: input.carboMaxG,
      gorduraMinG: input.gorduraMinG,
      gorduraMaxG: input.gorduraMaxG,
      fibraG: input.fibraG ?? undefined,
      aguaMl: input.aguaMl ?? undefined,
      refeicoes: input.refeicoes.map((r) => ({ nome: r.nome, horario: r.horario, descricao: r.descricao ?? undefined })),
      treinoAjusteKcal: input.treinoAjusteKcal,
      treinoAjusteCarboG: input.treinoAjusteCarboG,
      pesagem: input.pesagem,
      cintura: input.cintura,
      bioimpedancia: input.bioimpedancia,
      tom: input.tom,
      regras: input.regras,
      racional: input.racional,
    };
    await db.combinados.add(novo);
    return {
      result: JSON.stringify({
        ok: true,
        versao,
        substituiuVersao: anterior?.versao ?? null,
        instrucao: "Diga ao usuário para revisar e aprovar na tela Combinados. Até lá, os Combinados aprovados anteriores continuam valendo.",
      }),
      summary: `Combinados v${versao} propostos: ${input.metaKcal} kcal, ${input.metaProteinaG} g proteína`,
    };
  },
});

export const consultarPerfil = tool({
  name: "consultar_perfil",
  description: "Retorna o perfil completo e os Combinados vigentes gravados no aparelho. Use quando precisar conferir um dado que não está no contexto.",
  schema: z.object({}),
  async run() {
    const [p, c] = await Promise.all([getProfile(), getCombinadosAtivos()]);
    return {
      result: JSON.stringify({ perfil: p ? publicProfile(p) : null, combinados: c ?? null }),
      summary: "Perfil consultado",
    };
  },
});

export const PROFILE_TOOLS: CoachTool[] = [atualizarPerfil, calcularMetasTool, proporCombinados, consultarPerfil];

export function publicProfile(p: Profile) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
  return rest;
}
