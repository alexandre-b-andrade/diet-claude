import { Suspense, lazy } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { Droplets, MessageCircle } from "lucide-react";
import Insights from "../components/Insights";
import RemindersCard from "../components/RemindersCard";
import Ring from "../components/Ring";
import WeeklyReviewCard from "../components/WeeklyReviewCard";
import { useReminders } from "../hooks/useReminders";
import { useSettings } from "../lib/settings";
import { formatUsd } from "../lib/pricing";
import { useT } from "../i18n";
const Trends = lazy(() => import("../components/Trends"));
import { Card, PageHeader } from "../components/ui";
import { db, getCombinadosAtivos, getCombinadosPendentes, getProfile } from "../lib/db";
import { todayKey } from "../lib/dates";
import { CLASSIFICACAO_LABEL, calcularSaldo, somarRefeicoes } from "../lib/diary";
import { idadeAnos } from "../lib/metas";

const OBJETIVO_LABEL: Record<string, string> = {
  emagrecer: "Emagrecer",
  manter: "Manter o peso",
  ganhar_massa: "Ganhar massa",
  saude: "Saúde",
};

const CLASS_STYLE = {
  dentro: "bg-brand-100 text-brand-800",
  atencao: "bg-amber-100 text-amber-800",
  fora: "bg-red-100 text-red-700",
};

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export default function DashboardPage() {
  const hoje = todayKey();
  const { settings } = useSettings();
  const { t } = useT();
  const due = useReminders();
  const monthUsage = useLiveQuery(() => db.usage.where("createdAt").aboveOrEqual(startOfMonth()).toArray(), []);
  const gastoMes = (monthUsage ?? []).reduce((s, u) => s + u.costUsd, 0);
  const budget = settings.monthlyBudgetUsd;
  const profile = useLiveQuery(getProfile, []);
  const combinados = useLiveQuery(getCombinadosAtivos, []);
  const pendente = useLiveQuery(getCombinadosPendentes, []);
  const meals = useLiveQuery(() => db.meals.where("date").equals(hoje).sortBy("hora"), [hoje]);
  const water = useLiveQuery(() => db.water.where("date").equals(hoje).toArray(), [hoje]);
  const treinos = useLiveQuery(() => db.activities.where("date").equals(hoje).toArray(), [hoje]);

  const totais = somarRefeicoes(meals ?? []);
  const saldo = combinados ? calcularSaldo(totais, combinados, (treinos?.length ?? 0) > 0) : undefined;
  const aguaMl = (water ?? []).reduce((s, w) => s + w.ml, 0);
  const aguaMeta = combinados?.aguaMl ?? 2500;
  const onboardingPending = !profile || profile.status !== "active";

  async function addWater(ml: number) {
    await db.water.add({ date: hoje, ml, createdAt: Date.now() });
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={t("today.title")}
        action={
          <Link to="/chat" className="flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-medium text-white">
            <MessageCircle size={14} /> {t("today.log")}
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <RemindersCard due={due} />
          {budget > 0 && gastoMes >= budget * 0.8 && (
            <Card className={gastoMes >= budget ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
              <p className="text-sm">
                {t("today.budget", { spent: formatUsd(gastoMes), budget: formatUsd(budget) })}
                {gastoMes >= budget ? t("today.budgetReached") : "."}{" "}
                <Link to="/config" className="underline">
                  {t("today.adjust")}
                </Link>
              </p>
            </Card>
          )}
          {onboardingPending && (
            <Card className="border-brand-200 bg-brand-50">
              <p className="text-sm font-medium text-stone-800">
                {combinados ? t("today.agreementsReady") : t("today.startInterview")}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {combinados ? t("today.agreementsReadyHint") : t("today.startInterviewHint")}
              </p>
              <Link
                to={combinados ? "/combinados" : "/onboarding"}
                className="mt-3 inline-block rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white"
              >
                {combinados ? t("today.reviewAgreements") : profile?.status === "skipped" ? t("today.resumeInterview") : t("today.beginInterview")}
              </Link>
            </Card>
          )}

          {!onboardingPending && pendente && pendente.id !== combinados?.id && (
            <Card className="border-amber-200 bg-amber-50">
              <p className="text-sm font-medium text-stone-800">{t("today.pendingProposal", { v: pendente.versao })}</p>
              <p className="mt-1 text-sm text-stone-600">{t("today.pendingProposalHint", { kcal: pendente.metaKcal, prot: pendente.metaProteinaG, cur: combinados?.versao ?? "" })}</p>
              <Link to="/combinados" className="mt-3 inline-block rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white">
                {t("today.reviewProposal")}
              </Link>
            </Card>
          )}

          {combinados && saldo && (
            <Card title={`${t("today.balance")} · Combinados v${combinados.versao}${saldo.diaDeTreino ? ` · ${t("today.trainingDay")}` : ""}`}>
              <div className="flex justify-around">
                <Ring value={saldo.consumidoKcal} max={saldo.metaKcal} label={t("today.calories")} unit="kcal" />
                <Ring value={saldo.consumidoProteinaG} max={saldo.metaProteinaG} label={t("today.protein")} unit="g" color="var(--color-sky-600)" />
              </div>
              <p className="mt-3 text-center text-sm text-stone-700">
                {saldo.restanteKcal >= 0 ? (
                  <strong className="font-medium">{t("today.remaining", { kcal: saldo.restanteKcal, prot: saldo.restanteProteinaG })}</strong>
                ) : (
                  <>
                    <strong>{t("today.over", { kcal: -saldo.restanteKcal })}</strong>
                    {saldo.restanteProteinaG > 0 ? t("today.overProtein", { prot: saldo.restanteProteinaG }) : "."}
                  </>
                )}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Macro label={t("today.carbs")} value={totais.carboG} min={combinados.carboMinG} max={combinados.carboMaxG} />
                <Macro label={t("today.fat")} value={totais.gorduraG} min={combinados.gorduraMinG} max={combinados.gorduraMaxG} />
                <Macro label={t("today.fiber")} value={totais.fibraG} min={combinados.fibraG ?? 25} max={combinados.fibraG ?? 25} />
              </div>
            </Card>
          )}

          <Card title={t("today.meals")}>
            {!meals?.length ? (
              <p className="text-sm text-stone-500">
                {t("today.noMeals")}
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {meals.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="text-stone-500">{m.hora}</span> {m.refeicao}
                      </p>
                      <p className="truncate text-stone-600">{m.descricao}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">{m.kcal} kcal</p>
                      <p className="text-xs text-stone-500">P {m.proteinaG} g</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${CLASS_STYLE[m.classificacao]}`}>
                        {CLASSIFICACAO_LABEL[m.classificacao]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {combinados && combinados.refeicoes.length > 0 && (
              <p className="mt-3 text-xs text-stone-500">
                {t("today.agreed")}: {combinados.refeicoes.map((r) => `${r.nome} ${r.horario}`).join(" · ")}
              </p>
            )}
            <Link to="/registros" className="mt-2 inline-block text-sm font-medium text-brand-700 underline">
              {t("today.fullDiary")}
            </Link>
          </Card>

          <Card title={t("today.water")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Droplets className="text-sky-600" size={20} />
                <span>
                  <strong>{aguaMl} ml</strong> <span className="text-stone-500">{t("today.of")} {aguaMeta} ml</span>
                </span>
              </div>
              <div className="flex gap-1">
                {[200, 300, 500].map((ml) => (
                  <button
                    key={ml}
                    onClick={() => addWater(ml)}
                    className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                  >
                    +{ml}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, (aguaMl / aguaMeta) * 100)}%` }} />
            </div>
          </Card>

          {!onboardingPending && <Insights />}
          {!onboardingPending && <WeeklyReviewCard />}

          <Suspense fallback={<Card title="Tendências"><p className="text-sm text-stone-400">Carregando…</p></Card>}>
            <Trends />
          </Suspense>

          {profile && (profile.pesoAtualKg || profile.objetivo) && (
            <Card title={t("today.profile")}>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {profile.objetivo && (
                  <>
                    <dt className="text-stone-500">{t("today.goal")}</dt>
                    <dd>
                      {OBJETIVO_LABEL[profile.objetivo]}
                      {profile.metaPesoKg ? ` · meta ${profile.metaPesoKg} kg` : ""}
                      {profile.prazo ? ` · ${profile.prazo}` : ""}
                    </dd>
                  </>
                )}
                {profile.pesoAtualKg && (
                  <>
                    <dt className="text-stone-500">{t("today.currentWeight")}</dt>
                    <dd>{profile.pesoAtualKg} kg</dd>
                  </>
                )}
                {profile.alturaCm && profile.nascimento && (
                  <>
                    <dt className="text-stone-500">{t("today.heightAge")}</dt>
                    <dd>
                      {profile.alturaCm} cm · {idadeAnos(profile.nascimento)} {t("today.years")}
                    </dd>
                  </>
                )}
              </dl>
              <Link to="/combinados" className="mt-2 inline-block text-sm font-medium text-brand-700 underline">
                {t("today.viewAgreements")}
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Macro({ label, value, min, max }: { label: string; value: number; min: number; max: number }) {
  const ok = value >= min * 0.9 && value <= max * 1.1;
  return (
    <div className="rounded-xl bg-stone-50 p-2">
      <p className="text-stone-500">{label}</p>
      <p className={`text-sm font-semibold ${ok ? "text-stone-900" : "text-amber-700"}`}>{Math.round(value)} g</p>
      <p className="text-[10px] text-stone-400">{min === max ? `meta ${min}` : `${min}–${max}`}</p>
    </div>
  );
}
