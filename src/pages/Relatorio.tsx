import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useT } from "../i18n";
import { db, getCombinadosAtivos, getProfile } from "../lib/db";
import { addDays, formatDateKey, todayKey } from "../lib/dates";
import { mediaMovel, tendencia, umPorDia } from "../lib/body";
import { somarRefeicoes } from "../lib/diary";
import { idadeAnos } from "../lib/metas";
import { inicioSemana, metricasSemana } from "../lib/weekly";

const PERIODOS = [30, 90, 180] as const;

export default function RelatorioPage() {
  const { t, lang } = useT();
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(90);
  const hoje = todayKey();
  const inicio = addDays(hoje, -(dias - 1));
  const loc = lang === "en" ? "en-US" : "pt-BR";

  const profile = useLiveQuery(getProfile, []);
  const combinados = useLiveQuery(getCombinadosAtivos, []);
  const pesos = useLiveQuery(() => db.measurements.where("tipo").equals("peso").toArray(), []);
  const medidas = useLiveQuery(() => db.measurements.where("date").aboveOrEqual(inicio).filter((m) => m.tipo !== "peso").toArray(), [inicio]);
  const bios = useLiveQuery(async () => (await db.bioimpedance.where("date").aboveOrEqual(inicio).toArray()).sort((a, b) => a.date.localeCompare(b.date)), [inicio]);
  const labs = useLiveQuery(async () => (await db.labs.toArray()).sort((a, b) => a.date.localeCompare(b.date)), []);
  const meals = useLiveQuery(() => db.meals.where("date").between(inicio, hoje, true, true).toArray(), [inicio, hoje]);
  const water = useLiveQuery(() => db.water.where("date").between(inicio, hoje, true, true).toArray(), [inicio, hoje]);
  const acts = useLiveQuery(() => db.activities.where("date").between(inicio, hoje, true, true).toArray(), [inicio, hoje]);
  const reviews = useLiveQuery(async () => (await db.reviews.toArray()).filter((r) => r.semanaFim >= inicio).sort((a, b) => b.semanaInicio.localeCompare(a.semanaInicio)), [inicio]);
  const docs = useLiveQuery(() => db.documents.toArray(), []);

  if (!profile || !pesos || !meals || !water || !acts || !medidas || !bios || !labs || !reviews || !docs) return null;

  const serie = umPorDia(pesos);
  const ma = mediaMovel(serie, 7);
  const noPeriodo = serie.filter((p) => p.date >= inicio);
  const tend = tendencia(serie, 28, hoje);

  // Semanas do período
  const semanas: string[] = [];
  for (let s = inicioSemana(inicio); s <= hoje; s = addDays(s, 7)) semanas.push(s);
  const porSemana = semanas.map((s) => metricasSemana(s, addDays(s, 6), meals, water, acts, pesos, combinados)).filter((m) => m.diasRegistrados > 0);

  const diasComRefeicao = [...new Set(meals.map((m) => m.date))].sort().slice(-14);
  const fmt = (d: string) => formatDateKey(d, { day: "2-digit", month: "2-digit" });
  const fmtL = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(loc, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="relatorio mx-auto max-w-3xl bg-white px-6 py-6 text-sm text-stone-900 print:px-0">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/config" className="flex items-center gap-1 text-sm text-stone-600">
          <ArrowLeft size={16} /> {t("settings.title")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500">{t("report.period")}</span>
          {PERIODOS.map((p) => (
            <button key={p} onClick={() => setDias(p)} className={`rounded-full px-3 py-1 text-xs ${dias === p ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-600"}`}>
              {t("report.days", { n: p })}
            </button>
          ))}
          <button onClick={() => window.print()} className="flex items-center gap-1 rounded-xl bg-brand-700 px-3 py-1.5 text-xs font-medium text-white">
            <Printer size={14} /> {t("report.print")}
          </button>
        </div>
      </div>

      <header className="mb-6 border-b border-stone-300 pb-3">
        <h1 className="text-xl font-semibold">{t("report.title")}</h1>
        <p className="text-stone-600">
          {profile.nome ? `${profile.nome} · ` : ""}
          {fmtL(inicio)} – {fmtL(hoje)}
        </p>
      </header>

      <Sec title="Perfil">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {profile.sexo && <Item k="Sexo" v={profile.sexo} />}
          {profile.nascimento && <Item k="Idade" v={`${idadeAnos(profile.nascimento)} anos`} />}
          {profile.alturaCm && <Item k="Altura" v={`${profile.alturaCm} cm`} />}
          {profile.pesoAtualKg && <Item k="Peso atual" v={`${profile.pesoAtualKg} kg`} />}
          {profile.objetivo && <Item k="Objetivo" v={`${profile.objetivo}${profile.metaPesoKg ? ` · meta ${profile.metaPesoKg} kg` : ""}${profile.prazo ? ` · ${profile.prazo}` : ""}`} />}
          {profile.nivelAtividade && <Item k="Atividade" v={profile.nivelAtividade} />}
          {profile.treinos && <Item k="Treinos" v={profile.treinos} />}
          {profile.restricoes && <Item k="Restrições" v={profile.restricoes} />}
          {profile.saude && <Item k="Saúde" v={profile.saude} />}
        </dl>
      </Sec>

      {combinados && (
        <Sec title={`Combinados v${combinados.versao}${combinados.status === "aprovado" ? "" : " (proposta)"}`}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            <Item k="Calorias" v={`${combinados.metaKcal} kcal/dia`} />
            <Item k="Proteína" v={`${combinados.metaProteinaG} g/dia`} />
            <Item k="Carboidrato" v={`${combinados.carboMinG}–${combinados.carboMaxG} g`} />
            <Item k="Gordura" v={`${combinados.gorduraMinG}–${combinados.gorduraMaxG} g`} />
            <Item k="Dia de treino" v={`+${combinados.treinoAjusteKcal} kcal, +${combinados.treinoAjusteCarboG} g carbo`} />
            <Item k="Pesagem" v={combinados.pesagem} />
            <Item k="Cintura" v={combinados.cintura} />
            <Item k="Bioimpedância" v={combinados.bioimpedancia} />
          </dl>
          {combinados.refeicoes.length > 0 && <p className="mt-2 text-stone-700">Refeições: {combinados.refeicoes.map((r) => `${r.nome} ${r.horario}`).join(" · ")}</p>}
          {combinados.regras.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-stone-700">
              {combinados.regras.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </Sec>
      )}

      <Sec title="Peso">
        {noPeriodo.length ? (
          <>
            <p className="mb-2 text-stone-700">
              {noPeriodo[0].valor} kg em {fmt(noPeriodo[0].date)} → {noPeriodo.at(-1)!.valor} kg em {fmt(noPeriodo.at(-1)!.date)} (média 7 dias: {ma.at(-1)?.valor} kg)
              {tend ? `. Tendência: ${tend.porSemana > 0 ? "+" : ""}${tend.porSemana} kg/semana nos últimos 28 dias.` : "."}
            </p>
            <Sparkline pontos={noPeriodo.map((p) => p.valor)} meta={profile.metaPesoKg} />
            <table className="mt-2 w-full text-xs">
              <tbody>
                {chunk(noPeriodo, 4).map((row, i) => (
                  <tr key={i}>
                    {row.map((p) => (
                      <td key={p.date} className="py-0.5 pr-3">
                        {fmt(p.date)}: <strong>{p.valor}</strong>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-stone-500">Sem pesagens no período.</p>
        )}
      </Sec>

      {medidas.length > 0 && (
        <Sec title="Medidas (cm)">
          <Table
            head={["Data", "Medida", "Valor"]}
            rows={umPorDiaTipo(medidas).map((m) => [fmt(m.date), m.tipo, String(m.valor)])}
          />
        </Sec>
      )}

      {bios.length > 0 && (
        <Sec title="Bioimpedância">
          <Table
            head={["Data", "Peso", "% gordura", "Massa magra", "Músculo", "Visceral", "Água %", "TMB"]}
            rows={bios.map((b) => [fmt(b.date), s(b.pesoKg), s(b.gorduraPct), s(b.massaMagraKg), s(b.massaMuscularKg), s(b.gorduraVisceral), s(b.aguaPct), s(b.tmbKcal)])}
          />
        </Sec>
      )}

      {porSemana.length > 0 && (
        <Sec title="Alimentação por semana (dias registrados)">
          <Table
            head={["Semana", "Dias", "kcal méd.", "Prot. g", "Carbo g", "Gord. g", "Dentro kcal", "Prot. ok", "Fora", "Água ml", "Treinos", "Δ peso"]}
            rows={porSemana.map((m) => [
              `${fmt(m.inicio)}–${fmt(m.fim)}`,
              `${m.diasRegistrados}/7`,
              s(m.mediaKcal),
              s(m.mediaProteinaG),
              s(m.mediaCarboG),
              s(m.mediaGorduraG),
              `${m.diasDentroKcal}`,
              `${m.diasProteinaOk}`,
              `${m.refeicoesFora}`,
              s(m.mediaAguaMl),
              `${m.treinos}`,
              m.variacaoPesoKg === null ? "–" : `${m.variacaoPesoKg > 0 ? "+" : ""}${m.variacaoPesoKg}`,
            ])}
          />
        </Sec>
      )}

      {diasComRefeicao.length > 0 && (
        <Sec title="Diário alimentar (últimos 14 dias com registro)">
          {diasComRefeicao.map((d) => {
            const ms = meals.filter((m) => m.date === d).sort((a, b) => a.hora.localeCompare(b.hora));
            const tot = somarRefeicoes(ms);
            return (
              <div key={d} className="mb-2 break-inside-avoid">
                <p className="font-medium">
                  {formatDateKey(d, { weekday: "short", day: "2-digit", month: "2-digit" })} · {tot.kcal} kcal · P {tot.proteinaG} g · C {tot.carboG} g · G {tot.gorduraG} g
                </p>
                <ul className="pl-4 text-xs text-stone-700">
                  {ms.map((m) => (
                    <li key={m.id}>
                      {m.hora} {m.refeicao}: {m.descricao} ({m.kcal} kcal, P {m.proteinaG} g){m.classificacao !== "dentro" ? ` · ${m.classificacao}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Sec>
      )}

      {labs.length > 0 && (
        <Sec title="Exames laboratoriais">
          <Table head={["Data", "Exame", "Valor", "Referência"]} rows={labs.map((l) => [fmt(l.date), l.exame, `${l.valor}${l.unidade ? ` ${l.unidade}` : ""}`, l.referencia ?? "–"])} />
        </Sec>
      )}

      {reviews.length > 0 && (
        <Sec title="Fechamentos semanais">
          {reviews.map((r) => (
            <div key={r.id} className="mb-2 break-inside-avoid">
              <p className="font-medium">
                {fmt(r.semanaInicio)}–{fmt(r.semanaFim)}
              </p>
              <pre className="whitespace-pre-wrap font-sans text-xs text-stone-700">{r.resumo}</pre>
              {r.ajustes && <pre className="whitespace-pre-wrap font-sans text-xs text-stone-700">Ajustes: {r.ajustes}</pre>}
            </div>
          ))}
        </Sec>
      )}

      {docs.length > 0 && (
        <Sec title="Documentos na biblioteca">
          <ul className="list-disc pl-5 text-stone-700">
            {docs.map((d) => (
              <li key={d.id}>
                {d.titulo} ({d.tipo}
                {d.data ? `, ${fmt(d.data)}` : ""})
              </li>
            ))}
          </ul>
        </Sec>
      )}

      <footer className="mt-6 border-t border-stone-300 pt-2 text-xs text-stone-500">{t("report.generated", { date: new Date().toLocaleDateString(loc) })}</footer>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="mb-2 border-b border-stone-200 pb-1 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-stone-500">{k}</dt>
      <dd className="col-span-1">{v}</dd>
    </>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border-b border-stone-300 py-1 pr-2 text-left font-medium text-stone-600">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="border-b border-stone-100 py-1 pr-2">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Sparkline({ pontos, meta }: { pontos: number[]; meta?: number }) {
  if (pontos.length < 2) return null;
  const w = 600;
  const h = 80;
  const all = meta ? [...pontos, meta] : pontos;
  const min = Math.min(...all) - 0.5;
  const max = Math.max(...all) + 0.5;
  const x = (i: number) => (i / (pontos.length - 1)) * (w - 10) + 5;
  const y = (v: number) => h - 5 - ((v - min) / (max - min)) * (h - 10);
  const d = pontos.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" role="img" aria-label="Evolução do peso">
      {meta && <line x1={0} x2={w} y1={y(meta)} y2={y(meta)} stroke="#0d9488" strokeDasharray="4 4" />}
      <path d={d} fill="none" stroke="#0f766e" strokeWidth={2} />
    </svg>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function s(v: number | null | undefined): string {
  return v === null || v === undefined ? "–" : String(v);
}

function umPorDiaTipo(ms: { date: string; tipo: string; valor: number; createdAt: number }[]) {
  const m = new Map<string, (typeof ms)[number]>();
  for (const x of ms) {
    const k = `${x.date}:${x.tipo}`;
    if (!m.has(k) || m.get(k)!.createdAt < x.createdAt) m.set(k, x);
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date) || a.tipo.localeCompare(b.tipo));
}
