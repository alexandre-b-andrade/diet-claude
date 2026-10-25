import type { Classificacao, Combinados, Meal, MealItem } from "./db";

export interface Totais {
  kcal: number;
  proteinaG: number;
  carboG: number;
  gorduraG: number;
  fibraG: number;
}

export const ZERO: Totais = { kcal: 0, proteinaG: 0, carboG: 0, gorduraG: 0, fibraG: 0 };

export function somarItens(itens: MealItem[]): Totais {
  const t = { ...ZERO };
  for (const i of itens) {
    t.kcal += i.kcal;
    t.proteinaG += i.proteinaG;
    t.carboG += i.carboG;
    t.gorduraG += i.gorduraG;
    t.fibraG += i.fibraG ?? 0;
  }
  return arredondar(t);
}

export function somarRefeicoes(meals: Pick<Meal, "kcal" | "proteinaG" | "carboG" | "gorduraG" | "fibraG">[]): Totais {
  const t = { ...ZERO };
  for (const m of meals) {
    t.kcal += m.kcal;
    t.proteinaG += m.proteinaG;
    t.carboG += m.carboG;
    t.gorduraG += m.gorduraG;
    t.fibraG += m.fibraG;
  }
  return arredondar(t);
}

function arredondar(t: Totais): Totais {
  const r = (v: number) => Math.round(v * 10) / 10;
  return { kcal: Math.round(t.kcal), proteinaG: r(t.proteinaG), carboG: r(t.carboG), gorduraG: r(t.gorduraG), fibraG: r(t.fibraG) };
}

export interface Saldo {
  metaKcal: number;
  metaProteinaG: number;
  consumidoKcal: number;
  consumidoProteinaG: number;
  restanteKcal: number;
  restanteProteinaG: number;
  pctKcal: number;
  pctProteina: number;
  diaDeTreino: boolean;
}

/** Saldo do dia contra os Combinados; aplica o ajuste de treino quando houver treino no dia. */
export function calcularSaldo(totais: Totais, c: Combinados, diaDeTreino = false): Saldo {
  const metaKcal = c.metaKcal + (diaDeTreino ? c.treinoAjusteKcal : 0);
  const metaProteinaG = c.metaProteinaG;
  return {
    metaKcal,
    metaProteinaG,
    consumidoKcal: totais.kcal,
    consumidoProteinaG: totais.proteinaG,
    restanteKcal: metaKcal - totais.kcal,
    restanteProteinaG: Math.round((metaProteinaG - totais.proteinaG) * 10) / 10,
    pctKcal: metaKcal ? Math.round((totais.kcal / metaKcal) * 100) : 0,
    pctProteina: metaProteinaG ? Math.round((totais.proteinaG / metaProteinaG) * 100) : 0,
    diaDeTreino,
  };
}

export const CLASSIFICACAO_LABEL: Record<Classificacao, string> = {
  dentro: "Dentro do plano",
  atencao: "Atenção",
  fora: "Fora do plano",
};

/** Resumo do dia em texto para o contexto do coach. */
export function resumoDia(date: string, meals: Meal[], aguaMl: number, saldo?: Saldo): string {
  const linhas = [`### ${date}`];
  if (!meals.length) linhas.push("Nenhuma refeição registrada.");
  for (const m of meals) {
    linhas.push(
      `- ${m.hora} ${m.refeicao}: ${m.descricao} → ${m.kcal} kcal, P ${m.proteinaG} g, C ${m.carboG} g, G ${m.gorduraG} g [${m.classificacao}${m.motivo ? `: ${m.motivo}` : ""}] (id ${m.id})`,
    );
  }
  const t = somarRefeicoes(meals);
  linhas.push(`Total: ${t.kcal} kcal, P ${t.proteinaG} g, C ${t.carboG} g, G ${t.gorduraG} g, fibras ${t.fibraG} g. Água: ${aguaMl} ml.`);
  if (saldo) {
    linhas.push(
      `Saldo: faltam ${saldo.restanteKcal} kcal e ${saldo.restanteProteinaG} g de proteína para a meta (${saldo.metaKcal} kcal / ${saldo.metaProteinaG} g${saldo.diaDeTreino ? ", dia de treino" : ""}).`,
    );
  }
  return linhas.join("\n");
}
