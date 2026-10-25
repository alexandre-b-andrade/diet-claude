import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Card } from "../../components/ui";
import { db, getCombinadosAtivos, type Meal } from "../../lib/db";
import { addDays, formatDateKey, todayKey } from "../../lib/dates";
import { CLASSIFICACAO_LABEL, calcularSaldo, somarRefeicoes } from "../../lib/diary";

const CLASS_STYLE = {
  dentro: "bg-brand-100 text-brand-800",
  atencao: "bg-amber-100 text-amber-800",
  fora: "bg-red-100 text-red-700",
};

export default function Refeicoes() {
  const [date, setDate] = useState(todayKey());
  const meals = useLiveQuery(() => db.meals.where("date").equals(date).sortBy("hora"), [date]);
  const water = useLiveQuery(() => db.water.where("date").equals(date).toArray(), [date]);
  const combinados = useLiveQuery(getCombinadosAtivos, []);
  const [open, setOpen] = useState<number | null>(null);

  const totais = somarRefeicoes(meals ?? []);
  const saldo = combinados ? calcularSaldo(totais, combinados) : undefined;
  const aguaMl = (water ?? []).reduce((s, w) => s + w.ml, 0);

  async function remove(m: Meal) {
    if (confirm(`Remover "${m.refeicao}: ${m.descricao}"?`)) await db.meals.delete(m.id!);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setDate(addDays(date, -1))} className="rounded-full p-2 hover:bg-stone-100" aria-label="Dia anterior">
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => setDate(todayKey())} className="text-sm font-medium capitalize">
          {date === todayKey() ? "Hoje" : formatDateKey(date, { weekday: "long", day: "2-digit", month: "long" })}
        </button>
        <button
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= todayKey()}
          className="rounded-full p-2 hover:bg-stone-100 disabled:opacity-30"
          aria-label="Próximo dia"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <Card>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <Tot label="kcal" v={totais.kcal} meta={saldo?.metaKcal} />
          <Tot label="Proteína" v={totais.proteinaG} meta={saldo?.metaProteinaG} unit="g" />
          <Tot label="Carbo" v={totais.carboG} unit="g" />
          <Tot label="Gordura" v={totais.gorduraG} unit="g" />
        </div>
        <p className="mt-2 text-center text-xs text-stone-500">
          Fibras {totais.fibraG} g · Água {aguaMl} ml
        </p>
      </Card>

      {!meals?.length ? (
        <Card>
          <p className="text-sm text-stone-500">Nenhuma refeição neste dia.</p>
          {date === todayKey() && (
            <Link to="/chat" className="mt-2 inline-block text-sm font-medium text-brand-700 underline">
              Registrar com o coach
            </Link>
          )}
        </Card>
      ) : (
        <ul className="space-y-2">
          {meals.map((m) => (
            <li key={m.id} className="rounded-2xl border border-stone-200 bg-white p-3 text-sm shadow-sm">
              <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(open === m.id ? null : m.id!)}>
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="text-stone-500">{m.hora}</span> {m.refeicao}
                  </p>
                  <p className="text-stone-600">{m.descricao}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${CLASS_STYLE[m.classificacao]}`}>
                    {CLASSIFICACAO_LABEL[m.classificacao]}
                  </span>
                  {m.motivo && <p className="mt-1 text-xs text-stone-500">{m.motivo}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">{m.kcal} kcal</p>
                  <p className="text-xs text-stone-500">
                    P {m.proteinaG} · C {m.carboG} · G {m.gorduraG}
                  </p>
                </div>
              </button>
              {open === m.id && (
                <div className="mt-3 border-t border-stone-100 pt-2">
                  <table className="w-full text-xs">
                    <thead className="text-stone-500">
                      <tr>
                        <th className="text-left font-normal">Item</th>
                        <th className="text-right font-normal">Qtd</th>
                        <th className="text-right font-normal">kcal</th>
                        <th className="text-right font-normal">P</th>
                        <th className="text-right font-normal">C</th>
                        <th className="text-right font-normal">G</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.itens.map((i, k) => (
                        <tr key={k}>
                          <td className="py-0.5">
                            {i.nome}
                            {i.fonte && <span className="ml-1 text-stone-400">({i.fonte})</span>}
                          </td>
                          <td className="text-right">
                            {i.quantidade} {i.unidade}
                            {i.gramas ? ` (${i.gramas} g)` : ""}
                          </td>
                          <td className="text-right">{i.kcal}</td>
                          <td className="text-right">{i.proteinaG}</td>
                          <td className="text-right">{i.carboG}</td>
                          <td className="text-right">{i.gorduraG}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 flex justify-between text-xs">
                    <Link to="/chat" className="text-brand-700 underline">
                      Corrigir com o coach
                    </Link>
                    <button onClick={() => remove(m)} className="flex items-center gap-1 text-red-600">
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tot({ label, v, meta, unit = "" }: { label: string; v: number; meta?: number; unit?: string }) {
  return (
    <div>
      <p className="text-stone-500">{label}</p>
      <p className="text-sm font-semibold">
        {Math.round(v)}
        {unit}
      </p>
      {meta !== undefined && (
        <p className="text-[10px] text-stone-400">
          de {Math.round(meta)}
          {unit}
        </p>
      )}
    </div>
  );
}
