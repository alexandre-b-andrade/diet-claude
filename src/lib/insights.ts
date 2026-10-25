import type { Activity, Combinados, Meal, Measurement, Profile, WaterEntry } from "./db";
import { addDays, lastDays } from "./dates";
import { ritmoSemanalPct, tendencia, umPorDia } from "./body";
import { somarRefeicoes } from "./diary";

export interface Insight {
  nivel: "positivo" | "atencao" | "info";
  texto: string;
}

export interface InsightInput {
  hoje: string;
  horaAgora: number;
  profile?: Profile;
  combinados?: Combinados;
  meals7: Meal[];
  water7: WaterEntry[];
  activities7: Activity[];
  pesos: Measurement[];
  cinturas: Measurement[];
}

/** Regras determinísticas sobre os últimos 7 dias. */
export function gerarInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const dias = lastDays(7, i.hoje);
  const c = i.combinados;

  if (c) {
    const regs = dias
      .map((d) => ({ d, t: somarRefeicoes(i.meals7.filter((m) => m.date === d)), treino: i.activities7.some((a) => a.date === d), n: i.meals7.filter((m) => m.date === d).length }))
      .filter((x) => x.n > 0 && x.d !== i.hoje);
    if (regs.length >= 3) {
      const baixaProt = regs.filter((x) => x.t.proteinaG < c.metaProteinaG * 0.8).length;
      if (baixaProt >= Math.ceil(regs.length / 2)) {
        out.push({ nivel: "atencao", texto: `Proteína abaixo de 80% da meta em ${baixaProt} de ${regs.length} dias registrados. Priorize uma fonte proteica em cada refeição.` });
      } else if (regs.every((x) => x.t.proteinaG >= c.metaProteinaG * 0.9)) {
        out.push({ nivel: "positivo", texto: `Proteína na meta em todos os ${regs.length} dias registrados.` });
      }
      const acima = regs.filter((x) => x.t.kcal > (c.metaKcal + (x.treino ? c.treinoAjusteKcal : 0)) * 1.1).length;
      if (acima >= 3) out.push({ nivel: "atencao", texto: `Calorias mais de 10% acima da meta em ${acima} dias. Veja onde estão os extras no diário.` });
      const dentro = regs.filter((x) => x.t.kcal <= (c.metaKcal + (x.treino ? c.treinoAjusteKcal : 0)) * 1.05).length;
      if (dentro === regs.length && regs.length >= 4) out.push({ nivel: "positivo", texto: `${dentro} dias seguidos dentro da meta calórica.` });
    }
    const semRegistro = dias.filter((d) => d !== i.hoje && !i.meals7.some((m) => m.date === d)).length;
    if (semRegistro >= 3) out.push({ nivel: "info", texto: `${semRegistro} dos últimos 6 dias sem refeições registradas. O saldo e o fechamento ficam imprecisos.` });

    if (c.aguaMl) {
      const aguaDias = dias.filter((d) => d !== i.hoje).map((d) => i.water7.filter((w) => w.date === d).reduce((s, w) => s + w.ml, 0)).filter((v) => v > 0);
      if (aguaDias.length >= 3) {
        const media = aguaDias.reduce((a, b) => a + b, 0) / aguaDias.length;
        if (media < c.aguaMl * 0.7) out.push({ nivel: "atencao", texto: `Água média de ${Math.round(media)} ml/dia, abaixo de 70% da meta de ${c.aguaMl} ml.` });
      }
    }
  }

  // Peso
  const serie = umPorDia(i.pesos);
  if (serie.length) {
    const t = tendencia(serie, 28, i.hoje);
    const peso = serie.at(-1)!.valor;
    const obj = i.profile?.objetivo;
    if (t && obj) {
      const pct = ritmoSemanalPct(t.porSemana, peso);
      if (obj === "emagrecer") {
        if (t.porSemana > 0.1) out.push({ nivel: "atencao", texto: `Peso em tendência de alta (+${t.porSemana} kg/semana) com objetivo de emagrecer. Vale revisar o saldo com o coach.` });
        else if (pct <= -1.2) out.push({ nivel: "atencao", texto: `Perda de ${Math.abs(pct)}% do peso por semana, acima do ritmo seguro (0,5 a 1%). Risco de perder massa magra.` });
        else if (pct <= -0.4) out.push({ nivel: "positivo", texto: `Perdendo ${Math.abs(t.porSemana)} kg/semana (${Math.abs(pct)}% do peso): ritmo saudável.` });
      } else if (obj === "ganhar_massa") {
        if (t.porSemana < -0.1) out.push({ nivel: "atencao", texto: `Peso caindo ${Math.abs(t.porSemana)} kg/semana com objetivo de ganhar massa. Confira se está fechando as calorias.` });
        else if (pct >= 0.6) out.push({ nivel: "atencao", texto: `Ganho de ${pct}% do peso por semana, acima do ideal para ganho de massa com pouca gordura (0,25 a 0,5%).` });
      }
    }
    const ultimo = serie.at(-1)!.date;
    const diasSemPeso = Math.round((new Date(i.hoje).getTime() - new Date(ultimo).getTime()) / 86400000);
    if (diasSemPeso >= 4) out.push({ nivel: "info", texto: `Última pesagem há ${diasSemPeso} dias. Pese-se em jejum para manter a tendência confiável.` });
  } else if (c) {
    out.push({ nivel: "info", texto: "Nenhuma pesagem registrada ainda. A tendência de peso aparece a partir de 3 registros." });
  }

  const cint = umPorDia(i.cinturas);
  if (cint.length) {
    const diasSem = Math.round((new Date(i.hoje).getTime() - new Date(cint.at(-1)!.date).getTime()) / 86400000);
    if (diasSem >= 10) out.push({ nivel: "info", texto: `Cintura sem medir há ${diasSem} dias.` });
  }

  const treinos = i.activities7.filter((a) => a.date >= addDays(i.hoje, -6)).length;
  if (i.profile?.treinos && treinos === 0) out.push({ nivel: "info", texto: "Nenhum treino registrado nos últimos 7 dias." });

  if (c && i.horaAgora >= 14 && !i.meals7.some((m) => m.date === i.hoje)) {
    out.push({ nivel: "info", texto: "Nada registrado hoje ainda. Conte ao coach o que comeu até agora." });
  }

  return out.slice(0, 5);
}
