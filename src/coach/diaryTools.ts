import { z } from "zod";
import { db, type Meal, type MealItem } from "../lib/db";
import { nowTime, todayKey } from "../lib/dates";
import { resumoDia, somarItens, somarRefeicoes } from "../lib/diary";
import { lookupBarcode, porPorcao, searchFoods } from "../lib/foods";
import { loadSettings } from "../lib/settings";
import { saveUsdaHit, searchUsda } from "../lib/usda";
import type { CoachTool } from "./tools";

function tool<S extends z.ZodType>(t: CoachTool<S>): CoachTool<S> {
  return t;
}
const opt = <T extends z.ZodType>(s: T) => s.nullish();

const itemSchema = z.object({
  nome: z.string(),
  quantidade: z.number().describe("Quantidade na unidade informada"),
  unidade: z.string().describe("g, ml, unidade, fatia, colher de sopa, xícara..."),
  gramas: opt(z.number().describe("Peso estimado em gramas")),
  kcal: z.number(),
  proteinaG: z.number(),
  carboG: z.number(),
  gorduraG: z.number(),
  fibraG: opt(z.number()),
  fonte: opt(z.string().describe("taco, usuario, openfoodfacts, usda ou estimativa")),
});

function toItem(i: z.infer<typeof itemSchema>): MealItem {
  return {
    nome: i.nome,
    quantidade: i.quantidade,
    unidade: i.unidade,
    gramas: i.gramas ?? undefined,
    kcal: i.kcal,
    proteinaG: i.proteinaG,
    carboG: i.carboG,
    gorduraG: i.gorduraG,
    fibraG: i.fibraG ?? undefined,
    fonte: i.fonte ?? undefined,
  };
}

export const registrarRefeicao = tool({
  name: "registrar_refeicao",
  description:
    "Grava uma refeição no diário do usuário com itens, porções e macros. Chame sempre que o usuário disser que comeu algo (texto ou foto), depois de estimar as porções. Use buscar_alimento para obter valores da TACO ou dos alimentos do usuário em vez de estimar de cabeça quando o alimento for comum. Classifique pelo saldo do dia e pela qualidade dos alimentos.",
  schema: z.object({
    date: opt(z.string().describe("YYYY-MM-DD; padrão hoje")),
    hora: opt(z.string().describe("HH:MM; padrão agora")),
    refeicao: z.string().describe("Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar, Ceia ou Extra"),
    descricao: z.string().describe("Descrição curta do que foi comido"),
    itens: z.array(itemSchema).min(1),
    classificacao: z.enum(["dentro", "atencao", "fora"]),
    motivo: opt(z.string().describe("Por que recebeu essa classificação, em uma frase")),
  }),
  async run(input) {
    const itens = input.itens.map(toItem);
    const t = somarItens(itens);
    const meal: Meal = {
      date: input.date ?? todayKey(),
      hora: input.hora ?? nowTime(),
      refeicao: input.refeicao,
      descricao: input.descricao,
      itens,
      ...t,
      classificacao: input.classificacao,
      motivo: input.motivo ?? undefined,
      createdAt: Date.now(),
    };
    const id = (await db.meals.add(meal)) as number;
    const doDia = await db.meals.where("date").equals(meal.date).sortBy("hora");
    return {
      result: JSON.stringify({ ok: true, id, refeicao: { ...meal, id }, totaisDoDia: somarRefeicoes(doDia) }),
      summary: `Refeição registrada: ${meal.refeicao} · ${t.kcal} kcal, ${t.proteinaG} g proteína`,
    };
  },
});

export const atualizarRefeicao = tool({
  name: "atualizar_refeicao",
  description: "Corrige uma refeição já registrada (id vem do diário no contexto). Envie só os campos a alterar; se enviar itens, os totais são recalculados.",
  schema: z.object({
    id: z.number(),
    hora: opt(z.string()),
    refeicao: opt(z.string()),
    descricao: opt(z.string()),
    itens: opt(z.array(itemSchema).min(1)),
    classificacao: opt(z.enum(["dentro", "atencao", "fora"])),
    motivo: opt(z.string()),
  }),
  async run(input) {
    const atual = await db.meals.get(input.id);
    if (!atual) return { result: JSON.stringify({ ok: false, erro: "Refeição não encontrada" }), summary: `Refeição ${input.id} não encontrada` };
    const patch: Partial<Meal> = {};
    if (input.hora) patch.hora = input.hora;
    if (input.refeicao) patch.refeicao = input.refeicao;
    if (input.descricao) patch.descricao = input.descricao;
    if (input.classificacao) patch.classificacao = input.classificacao;
    if (input.motivo !== undefined && input.motivo !== null) patch.motivo = input.motivo;
    if (input.itens) {
      const itens = input.itens.map(toItem);
      Object.assign(patch, { itens, ...somarItens(itens) });
    }
    await db.meals.update(input.id, patch);
    const novo = await db.meals.get(input.id);
    return { result: JSON.stringify({ ok: true, refeicao: novo }), summary: `Refeição atualizada: ${novo?.refeicao}` };
  },
});

export const removerRefeicao = tool({
  name: "remover_refeicao",
  description: "Remove uma refeição do diário pelo id. Confirme com o usuário antes se houver dúvida.",
  schema: z.object({ id: z.number() }),
  async run(input) {
    const m = await db.meals.get(input.id);
    if (!m) return { result: JSON.stringify({ ok: false, erro: "Refeição não encontrada" }), summary: `Refeição ${input.id} não encontrada` };
    await db.meals.delete(input.id);
    return { result: JSON.stringify({ ok: true }), summary: `Refeição removida: ${m.refeicao} de ${m.date}` };
  },
});

export const consultarDiario = tool({
  name: "consultar_diario",
  description: "Retorna as refeições e a água de um intervalo de dias (padrão: últimos 7). Use para fechamentos, comparações e quando o usuário perguntar sobre dias anteriores.",
  schema: z.object({
    inicio: opt(z.string().describe("YYYY-MM-DD")),
    fim: opt(z.string().describe("YYYY-MM-DD")),
  }),
  async run(input) {
    const fim = input.fim ?? todayKey();
    const inicio = input.inicio ?? addDaysKey(fim, -6);
    const meals = await db.meals.where("date").between(inicio, fim, true, true).sortBy("date");
    const water = await db.water.where("date").between(inicio, fim, true, true).toArray();
    const dias = new Map<string, Meal[]>();
    for (const m of meals) dias.set(m.date, [...(dias.get(m.date) ?? []), m]);
    const texto = [...dias.entries()]
      .map(([d, ms]) =>
        resumoDia(
          d,
          ms.sort((a, b) => a.hora.localeCompare(b.hora)),
          water.filter((w) => w.date === d).reduce((s, w) => s + w.ml, 0),
        ),
      )
      .join("\n\n");
    return { result: texto || "Nenhum registro no período.", summary: `Diário consultado: ${inicio} a ${fim}` };
  },
});

export const buscarAlimento = tool({
  name: "buscar_alimento",
  description:
    "Busca alimentos na tabela TACO (brasileira, 591 itens) e nos alimentos cadastrados pelo usuário; se nada for encontrado e o USDA estiver habilitado nas configurações, busca também no USDA FoodData Central (termo em inglês ajuda). Retorna valores por 100 g e, se pedido, por porção. Prefira esta ferramenta a estimar de cabeça. Use termos simples, ex. 'arroz cozido', 'peito frango grelhado', 'pão francês'.",
  schema: z.object({
    termo: z.string(),
    gramas: opt(z.number().describe("Se informado, retorna também os valores para essa porção")),
    limite: opt(z.number().int().min(1).max(20)),
  }),
  async run(input) {
    let hits = await searchFoods(input.termo, input.limite ?? 8);
    let aviso: string | undefined;
    const settings = loadSettings();
    if (!hits.length && settings.usdaEnabled) {
      try {
        const usda = await searchUsda(input.termo, settings.usdaApiKey, input.limite ?? 8);
        hits = usda;
        // Guarda os 3 primeiros para reutilizar offline.
        await Promise.all(usda.slice(0, 3).map(saveUsdaHit));
        if (usda.length) aviso = "Resultados do USDA (EUA); valores por 100 g, alimentos podem diferir dos brasileiros.";
      } catch (e) {
        aviso = `USDA indisponível: ${(e as Error).message}`;
      }
    }
    const out = hits.map((h) => ({
      ref: h.ref,
      nome: h.nome,
      marca: h.marca,
      categoria: h.categoria,
      fonte: h.fonte,
      por100g: { kcal: h.kcal, proteinaG: h.proteinaG, carboG: h.carboG, gorduraG: h.gorduraG, fibraG: h.fibraG },
      porcaoUsualG: h.porcaoG,
      ...(input.gramas ? { porcao: { gramas: input.gramas, ...porPorcao(h, input.gramas) } } : {}),
    }));
    return {
      result: JSON.stringify(out.length ? { aviso, resultados: out } : { aviso: aviso ?? "Nada encontrado. Tente outro termo ou estime e marque fonte 'estimativa'." }),
      summary: `Alimento buscado: "${input.termo}" (${out.length} resultados${out[0]?.fonte === "usda" ? ", USDA" : ""})`,
    };
  },
});

export const buscarCodigoBarras = tool({
  name: "buscar_codigo_barras",
  description: "Consulta um produto industrializado pelo código de barras (EAN) no Open Food Facts e salva nos alimentos do usuário. Valores por 100 g.",
  schema: z.object({ codigo: z.string() }),
  async run(input) {
    try {
      const f = await lookupBarcode(input.codigo);
      if (!f) return { result: JSON.stringify({ ok: false, erro: "Produto não encontrado" }), summary: `Código ${input.codigo} não encontrado` };
      return { result: JSON.stringify({ ok: true, alimento: f }), summary: `Produto encontrado: ${f.nome}` };
    } catch (e) {
      return { result: JSON.stringify({ ok: false, erro: (e as Error).message }), summary: "Falha ao consultar código de barras" };
    }
  },
});

export const salvarAlimento = tool({
  name: "salvar_alimento",
  description:
    "Cadastra um alimento do usuário (rótulo, receita própria ou tabela enviada) com valores por 100 g, para reutilizar em buscas futuras. Use quando o usuário enviar rótulo, tabela nutricional ou receita.",
  schema: z.object({
    nome: z.string(),
    marca: opt(z.string()),
    kcal: z.number(),
    proteinaG: z.number(),
    carboG: z.number(),
    gorduraG: z.number(),
    fibraG: opt(z.number()),
    porcaoG: opt(z.number()),
    fonte: z.enum(["usuario", "tabela"]),
  }),
  async run(input) {
    const id = await db.foods.add({
      nome: input.nome,
      marca: input.marca ?? undefined,
      kcal: input.kcal,
      proteinaG: input.proteinaG,
      carboG: input.carboG,
      gorduraG: input.gorduraG,
      fibraG: input.fibraG ?? undefined,
      porcaoG: input.porcaoG ?? undefined,
      fonte: input.fonte,
      createdAt: Date.now(),
    });
    return { result: JSON.stringify({ ok: true, id }), summary: `Alimento salvo: ${input.nome}` };
  },
});

export const registrarAgua = tool({
  name: "registrar_agua",
  description: "Registra consumo de água em ml no dia (padrão hoje).",
  schema: z.object({ ml: z.number().int().positive(), date: opt(z.string()) }),
  async run(input) {
    const date = input.date ?? todayKey();
    await db.water.add({ date, ml: input.ml, createdAt: Date.now() });
    const total = (await db.water.where("date").equals(date).toArray()).reduce((s, w) => s + w.ml, 0);
    return { result: JSON.stringify({ ok: true, totalDoDiaMl: total }), summary: `Água registrada: +${input.ml} ml (total ${total} ml)` };
  },
});

function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export const DIARY_TOOLS: CoachTool[] = [
  registrarRefeicao,
  atualizarRefeicao,
  removerRefeicao,
  consultarDiario,
  buscarAlimento,
  buscarCodigoBarras,
  salvarAlimento,
  registrarAgua,
];
