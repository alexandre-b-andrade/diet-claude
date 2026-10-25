import { db, type CustomFood } from "./db";
import type { FoodHit } from "./foods";

const NUTRIENT = { kcal: 1008, proteina: 1003, carbo: 1005, gordura: 1004, fibra: 1079 } as const;

export interface UsdaFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: { nutrientId: number; value: number; unitName?: string }[];
}

/** Converte um item do FoodData Central para o formato interno (por 100 g). */
export function parseUsdaFood(f: UsdaFood): FoodHit | null {
  const get = (id: number) => f.foodNutrients?.find((n) => n.nutrientId === id)?.value;
  let kcal = get(NUTRIENT.kcal);
  const kj = f.foodNutrients?.find((n) => n.nutrientId === NUTRIENT.kcal && n.unitName?.toUpperCase() === "KJ")?.value;
  if (kcal === undefined && kj !== undefined) kcal = kj / 4.184;
  if (kcal === undefined) return null;
  return {
    ref: `usda:${f.fdcId}`,
    nome: f.description,
    marca: f.brandOwner,
    categoria: f.dataType,
    fonte: "usda",
    kcal: Math.round(kcal),
    proteinaG: round1(get(NUTRIENT.proteina) ?? 0),
    carboG: round1(get(NUTRIENT.carbo) ?? 0),
    gorduraG: round1(get(NUTRIENT.gordura) ?? 0),
    fibraG: round1(get(NUTRIENT.fibra) ?? 0),
    porcaoG: f.servingSizeUnit?.toLowerCase() === "g" ? f.servingSize : undefined,
    score: 1,
  };
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

/** Busca no USDA FoodData Central. A chave DEMO_KEY funciona com limite baixo por IP. */
export async function searchUsda(query: string, apiKey: string, limit = 10): Promise<FoodHit[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey || "DEMO_KEY");
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (res.status === 429) throw new Error("Limite do USDA atingido. Configure sua própria chave em Configurações.");
  if (!res.ok) throw new Error(`USDA respondeu ${res.status}`);
  const json = (await res.json()) as { foods?: UsdaFood[] };
  return (json.foods ?? []).map(parseUsdaFood).filter((x): x is FoodHit => x !== null);
}

/** Salva um resultado USDA nos alimentos do usuário para reutilizar offline. */
export async function saveUsdaHit(h: FoodHit): Promise<CustomFood> {
  const existing = await db.foods.filter((f) => f.fonte === "usda" && f.nome === h.nome).first();
  if (existing) return existing;
  const food: CustomFood = {
    nome: h.nome,
    marca: h.marca,
    kcal: h.kcal,
    proteinaG: h.proteinaG,
    carboG: h.carboG,
    gorduraG: h.gorduraG,
    fibraG: h.fibraG,
    porcaoG: h.porcaoG,
    fonte: "usda",
    createdAt: Date.now(),
  };
  food.id = (await db.foods.add(food)) as number;
  return food;
}
