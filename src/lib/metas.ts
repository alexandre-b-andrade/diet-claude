import type { NivelAtividade, Objetivo, Sexo } from "./db";

export const FATOR_ATIVIDADE: Record<NivelAtividade, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muito_intenso: 1.9,
};

export function idadeAnos(nascimento: string, hoje = new Date()): number {
  const n = new Date(nascimento);
  let idade = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--;
  return idade;
}

/** Taxa metabólica basal por Mifflin-St Jeor (kcal/dia). */
export function tmbMifflin(sexo: Sexo, pesoKg: number, alturaCm: number, idade: number): number {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
  if (sexo === "masculino") return Math.round(base + 5);
  if (sexo === "feminino") return Math.round(base - 161);
  return Math.round(base - 78); // média entre as duas fórmulas
}

export interface EntradaMetas {
  sexo: Sexo;
  pesoKg: number;
  alturaCm: number;
  idade: number;
  nivelAtividade: NivelAtividade;
  objetivo: Objetivo;
  /** TMB medida pela balança, se houver; prevalece sobre a fórmula. */
  tmbMedidaKcal?: number;
  /** Massa magra, se houver; proteína passa a ser calculada sobre ela. */
  massaMagraKg?: number;
  /** Déficit/superávit em kcal/dia. Se omitido usa o padrão por objetivo. */
  ajusteKcal?: number;
}

export interface Metas {
  tmbKcal: number;
  gastoTotalKcal: number;
  ajusteKcal: number;
  metaKcal: number;
  metaProteinaG: number;
  proteinaGPorKg: number;
  gorduraMinG: number;
  gorduraMaxG: number;
  carboMinG: number;
  carboMaxG: number;
  fibraG: number;
  aguaMl: number;
}

const AJUSTE_PADRAO: Record<Objetivo, number> = {
  emagrecer: -500,
  manter: 0,
  ganhar_massa: 300,
  saude: -250,
};

/** Proteína alvo em g/kg conforme objetivo. */
const PROTEINA_G_KG: Record<Objetivo, number> = {
  emagrecer: 2.0,
  manter: 1.6,
  ganhar_massa: 2.0,
  saude: 1.6,
};

export function calcularMetas(e: EntradaMetas): Metas {
  const tmbKcal = e.tmbMedidaKcal ?? tmbMifflin(e.sexo, e.pesoKg, e.alturaCm, e.idade);
  const gastoTotalKcal = Math.round(tmbKcal * FATOR_ATIVIDADE[e.nivelAtividade]);
  const ajusteKcal = e.ajusteKcal ?? AJUSTE_PADRAO[e.objetivo];
  // Nunca abaixo de 1200 kcal nem abaixo da TMB em déficit agressivo.
  const metaKcal = Math.max(1200, Math.round(gastoTotalKcal + ajusteKcal));

  const proteinaGPorKg = PROTEINA_G_KG[e.objetivo];
  const baseProteina = e.massaMagraKg ? e.massaMagraKg * (proteinaGPorKg + 0.4) : e.pesoKg * proteinaGPorKg;
  const metaProteinaG = Math.round(baseProteina);

  // Gordura 25–35% das kcal; carbo fecha o restante.
  const gorduraMinG = Math.round((metaKcal * 0.25) / 9);
  const gorduraMaxG = Math.round((metaKcal * 0.35) / 9);
  const kcalProteina = metaProteinaG * 4;
  const carboMinG = Math.max(50, Math.round((metaKcal - kcalProteina - gorduraMaxG * 9) / 4));
  const carboMaxG = Math.max(carboMinG, Math.round((metaKcal - kcalProteina - gorduraMinG * 9) / 4));

  const fibraG = Math.round((metaKcal / 1000) * 14);
  const aguaMl = Math.round(e.pesoKg * 35);

  return {
    tmbKcal,
    gastoTotalKcal,
    ajusteKcal,
    metaKcal,
    metaProteinaG,
    proteinaGPorKg,
    gorduraMinG,
    gorduraMaxG,
    carboMinG,
    carboMaxG,
    fibraG,
    aguaMl,
  };
}
