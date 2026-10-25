import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "./ui";
import { db, getCombinadosAtivos, getProfile } from "../lib/db";
import { addDays, formatDateKey, lastDays, todayKey } from "../lib/dates";
import { mediaMovel, projecao, tendencia, umPorDia } from "../lib/body";
import { somarRefeicoes } from "../lib/diary";

const PERIODOS = [30, 90, 180] as const;

export default function Trends() {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const hoje = todayKey();
  const inicio = addDays(hoje, -(dias - 1));

  const pesos = useLiveQuery(() => db.measurements.where("tipo").equals("peso").toArray(), []);
  const cinturas = useLiveQuery(() => db.measurements.where("tipo").equals("cintura").toArray(), []);
  const bios = useLiveQuery(() => db.bioimpedance.toArray(), []);
  const profile = useLiveQuery(getProfile, []);
  const combinados = useLiveQuery(getCombinadosAtivos, []);
  const meals7 = useLiveQuery(() => db.meals.where("date").between(addDays(hoje, -6), hoje, true, true).toArray(), [hoje]);
  const treinos7 = useLiveQuery(() => db.activities.where("date").between(addDays(hoje, -6), hoje, true, true).toArray(), [hoje]);

  const pesoSerie = useMemo(() => umPorDia(pesos ?? []), [pesos]);
  const pesoData = useMemo(() => {
    const ma = mediaMovel(pesoSerie, 7);
    return pesoSerie.filter((p) => p.date >= inicio).map((p, i, arr) => ({ date: p.date, peso: p.valor, media: ma.find((m) => m.date === p.date)?.valor, idx: i, n: arr.length }));
  }, [pesoSerie, inicio]);
  const tend = useMemo(() => tendencia(pesoSerie, 28, hoje), [pesoSerie, hoje]);
  const proj = useMemo(() => {
    const ma = mediaMovel(pesoSerie, 7).at(-1);
    return ma && profile?.metaPesoKg ? projecao(ma.valor, profile.metaPesoKg, tend, hoje) : undefined;
  }, [pesoSerie, profile?.metaPesoKg, tend, hoje]);

  const cinturaData = useMemo(() => umPorDia(cinturas ?? []).filter((p) => p.date >= inicio), [cinturas, inicio]);
  const bioData = useMemo(
    () => (bios ?? []).filter((b) => b.date >= inicio).sort((a, b) => a.date.localeCompare(b.date)).map((b) => ({ date: b.date, gordura: b.gorduraPct, magra: b.massaMagraKg })),
    [bios, inicio],
  );

  const aderencia = useMemo(() => {
    if (!combinados) return [];
    return lastDays(7, hoje).map((d) => {
      const ms = (meals7 ?? []).filter((m) => m.date === d);
      const t = somarRefeicoes(ms);
      const treino = (treinos7 ?? []).some((a) => a.date === d);
      const meta = combinados.metaKcal + (treino ? combinados.treinoAjusteKcal : 0);
      return { date: d, kcal: t.kcal, meta, proteina: t.proteinaG, metaProteina: combinados.metaProteinaG, registrado: ms.length > 0 };
    });
  }, [meals7, treinos7, combinados, hoje]);

  const temAlgo = pesoData.length || cinturaData.length || bioData.length || aderencia.some((a) => a.registrado);
  if (!temAlgo) {
    return (
      <Card title="Tendências">
        <p className="text-sm text-stone-500">Registre peso, cintura, bioimpedância e refeições para ver as tendências aqui.</p>
      </Card>
    );
  }

  const fmtTick = (d: string) => formatDateKey(d, { day: "2-digit", month: "2-digit" });

  return (
    <Card
      title="Tendências"
      className="space-y-4"
    >
      <div className="flex gap-1 text-xs">
        {PERIODOS.map((p) => (
          <button key={p} onClick={() => setDias(p)} className={`rounded-full px-3 py-1 ${dias === p ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-600"}`}>
            {p} dias
          </button>
        ))}
      </div>

      {pesoData.length > 0 && (
        <div>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">Peso</span>
            <span className="text-xs text-stone-500">
              {tend ? `${tend.porSemana > 0 ? "+" : ""}${tend.porSemana} kg/semana` : "tendência: mais registros necessários"}
              {proj ? ` · meta em ~${Math.round(proj.semanas)} sem. (${formatDateKey(proj.dataPrevista, { day: "2-digit", month: "short" })})` : ""}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={pesoData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(1)} />
              <Tooltip labelFormatter={(d) => formatDateKey(String(d))} formatter={(v) => [`${Number(v).toFixed(1)} kg`]} />
              {profile?.metaPesoKg && <ReferenceLine y={profile.metaPesoKg} stroke="#0d9488" strokeDasharray="4 4" label={{ value: "meta", fontSize: 10, fill: "#0d9488", position: "insideTopRight" }} />}
              <Line type="monotone" dataKey="peso" name="peso" stroke="#a8a29e" strokeWidth={1} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="media" name="média 7d" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {cinturaData.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Cintura</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={cinturaData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(d) => formatDateKey(String(d))} formatter={(v) => [`${v} cm`]} />
              <Line type="monotone" dataKey="valor" name="cintura" stroke="#0369a1" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {bioData.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Bioimpedância</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={bioData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="date" tickFormatter={fmtTick} tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis yAxisId="l" tick={{ fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip labelFormatter={(d) => formatDateKey(String(d))} />
              <Line yAxisId="l" type="monotone" dataKey="gordura" name="% gordura" stroke="#b45309" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
              <Line yAxisId="r" type="monotone" dataKey="magra" name="massa magra (kg)" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {aderencia.some((a) => a.registrado) && (
        <div>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">Últimos 7 dias</span>
            <span className="text-xs text-stone-500">
              {aderencia.filter((a) => a.registrado && a.kcal <= a.meta * 1.05).length} de {aderencia.filter((a) => a.registrado).length} dias dentro da meta de kcal
            </span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={aderencia} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => formatDateKey(d, { weekday: "short" })} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(d) => formatDateKey(String(d))} formatter={(v, n) => [`${Math.round(Number(v))} ${n === "kcal" ? "kcal" : "g"}`, n === "kcal" ? "consumido" : "proteína"]} />
              {combinados && <ReferenceLine y={combinados.metaKcal} stroke="#0d9488" strokeDasharray="4 4" />}
              <Bar dataKey="kcal" name="kcal" fill="#0f766e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
