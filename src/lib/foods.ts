import taco from "../data/taco.json";
import { db, type CustomFood } from "./db";

interface TacoFood {
  id: number;
  c: number;
  n: string;
  kcal: number;
  p: number;
  carb: number;
  fat: number;
  fib: number;
  na: number | null;
}

interface TacoData {
  fonte: string;
  categorias: Record<string, string>;
  alimentos: TacoFood[];
}

const TACO = taco as TacoData;

/** Resultado de busca normalizado: valores por 100 g. */
export interface FoodHit {
  ref: string; // "taco:123" | "user:5"
  nome: string;
  categoria?: string;
  marca?: string;
  fonte: "taco" | "usuario" | "tabela" | "openfoodfacts" | "usda";
  kcal: number;
  proteinaG: number;
  carboG: number;
  gorduraG: number;
  fibraG: number;
  porcaoG?: number;
  score: number;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Minúsculas sem acentos, preservando o comprimento (para destacar trechos). */
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const STOP = new Set(["de", "da", "do", "com", "sem", "e", "em", "a", "o"]);

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}

/** Pontua um nome contra os tokens da busca: todos os tokens precisam aparecer (prefixo). */
export function scoreName(name: string, qTokens: string[]): number {
  const nTokens = tokens(name);
  if (!qTokens.length) return 0;
  let score = 0;
  for (const q of qTokens) {
    const exact = nTokens.includes(q);
    const prefix = !exact && nTokens.some((t) => t.startsWith(q));
    if (!exact && !prefix) return 0;
    score += exact ? 2 : 1;
  }
  // Nomes mais curtos e com o termo no início pontuam mais.
  score += Math.max(0, 3 - nTokens.length * 0.2);
  if (nTokens[0] && qTokens.includes(nTokens[0])) score += 1;
  return score;
}

export function searchTaco(query: string, limit = 10): FoodHit[] {
  const q = tokens(query);
  const hits: FoodHit[] = [];
  for (const f of TACO.alimentos) {
    const score = scoreName(f.n, q);
    if (score > 0) {
      hits.push({
        ref: `taco:${f.id}`,
        nome: f.n,
        categoria: TACO.categorias[String(f.c)],
        fonte: "taco",
        kcal: f.kcal,
        proteinaG: f.p,
        carboG: f.carb,
        gorduraG: f.fat,
        fibraG: f.fib,
        score,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function customToHit(c: CustomFood, score = 10): FoodHit {
  return {
    ref: `user:${c.id}`,
    nome: c.nome,
    marca: c.marca,
    fonte: c.fonte,
    kcal: c.kcal,
    proteinaG: c.proteinaG,
    carboG: c.carboG,
    gorduraG: c.gorduraG,
    fibraG: c.fibraG ?? 0,
    porcaoG: c.porcaoG,
    score,
  };
}

/** Busca em alimentos do usuário + TACO. Alimentos do usuário vêm primeiro. */
export async function searchFoods(query: string, limit = 10): Promise<FoodHit[]> {
  const q = tokens(query);
  const custom = (await db.foods.toArray())
    .map((c) => ({ c, score: scoreName(`${c.nome} ${c.marca ?? ""}`, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => customToHit(x.c, x.score + 5));
  const taco = searchTaco(query, limit);
  return [...custom, ...taco].slice(0, limit);
}

export function getTacoById(id: number): FoodHit | undefined {
  const f = TACO.alimentos.find((a) => a.id === id);
  if (!f) return undefined;
  return searchTaco(f.n, 1).find((h) => h.ref === `taco:${id}`) ?? {
    ref: `taco:${id}`,
    nome: f.n,
    categoria: TACO.categorias[String(f.c)],
    fonte: "taco",
    kcal: f.kcal,
    proteinaG: f.p,
    carboG: f.carb,
    gorduraG: f.fat,
    fibraG: f.fib,
    score: 1,
  };
}

export const TACO_FONTE = TACO.fonte;
export const TACO_TOTAL = TACO.alimentos.length;

/** Escala valores por 100 g para a quantidade em gramas. */
export function porPorcao(h: Pick<FoodHit, "kcal" | "proteinaG" | "carboG" | "gorduraG" | "fibraG">, gramas: number) {
  const k = gramas / 100;
  const r = (v: number) => Math.round(v * k * 10) / 10;
  return { kcal: Math.round(h.kcal * k), proteinaG: r(h.proteinaG), carboG: r(h.carboG), gorduraG: r(h.gorduraG), fibraG: r(h.fibraG) };
}

/** Consulta o Open Food Facts por código de barras. */
export async function lookupBarcode(code: string): Promise<CustomFood | null> {
  const clean = code.replace(/\D/g, "");
  if (!clean) return null;
  const cached = await db.foods.where("codigoBarras").equals(clean).first();
  if (cached) return cached;
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${clean}?fields=product_name,product_name_pt,brands,nutriments,serving_quantity`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      product_name_pt?: string;
      brands?: string;
      serving_quantity?: number | string;
      nutriments?: Record<string, number | string | undefined>;
    };
  };
  const p = json.product;
  if (!p?.nutriments) return null;
  const n = p.nutriments;
  const num = (k: string) => {
    const v = n[k];
    const x = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(x) ? (x as number) : undefined;
  };
  const kcal = num("energy-kcal_100g") ?? (num("energy_100g") ? Math.round((num("energy_100g") as number) / 4.184) : undefined);
  if (kcal === undefined) return null;
  const food: CustomFood = {
    nome: p.product_name_pt || p.product_name || `Produto ${clean}`,
    marca: p.brands,
    kcal: Math.round(kcal),
    proteinaG: num("proteins_100g") ?? 0,
    carboG: num("carbohydrates_100g") ?? 0,
    gorduraG: num("fat_100g") ?? 0,
    fibraG: num("fiber_100g"),
    porcaoG: typeof p.serving_quantity === "string" ? parseFloat(p.serving_quantity) || undefined : p.serving_quantity,
    fonte: "openfoodfacts",
    codigoBarras: clean,
    createdAt: Date.now(),
  };
  food.id = (await db.foods.add(food)) as number;
  return food;
}
