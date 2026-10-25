import { db, getCombinadosAtivos, getProfile, type Combinados, type Meal, type Profile } from "../lib/db";
import { addDays, todayKey } from "../lib/dates";
import { calcularSaldo, resumoDia, somarRefeicoes, type Saldo } from "../lib/diary";

/** Tudo o que o coach precisa saber além do prompt fixo. */
export interface CoachContext {
  profile?: Profile;
  combinados?: Combinados;
  hoje: string;
  refeicoesHoje: Meal[];
  aguaHojeMl: number;
  saldoHoje?: Saldo;
  resumoOntem?: string;
}

export async function loadCoachContext(): Promise<CoachContext> {
  const hoje = todayKey();
  const ontem = addDays(hoje, -1);
  const [profile, combinados, refeicoesHoje, aguaHoje, refeicoesOntem, aguaOntem] = await Promise.all([
    getProfile(),
    getCombinadosAtivos(),
    db.meals.where("date").equals(hoje).sortBy("hora"),
    db.water.where("date").equals(hoje).toArray(),
    db.meals.where("date").equals(ontem).sortBy("hora"),
    db.water.where("date").equals(ontem).toArray(),
  ]);
  const aguaHojeMl = aguaHoje.reduce((s, w) => s + w.ml, 0);
  const saldoHoje = combinados ? calcularSaldo(somarRefeicoes(refeicoesHoje), combinados, false) : undefined;
  return {
    profile,
    combinados,
    hoje,
    refeicoesHoje,
    aguaHojeMl,
    saldoHoje,
    resumoOntem: refeicoesOntem.length ? resumoDia(ontem, refeicoesOntem, aguaOntem.reduce((s, w) => s + w.ml, 0)) : undefined,
  };
}
