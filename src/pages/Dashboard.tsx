import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { Card, PageHeader } from "../components/ui";
import { db, getCombinadosAtivos, getProfile } from "../lib/db";
import { idadeAnos } from "../lib/metas";
import { formatUsd, modelInfo } from "../lib/pricing";
import { useSettings } from "../lib/settings";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const OBJETIVO_LABEL: Record<string, string> = {
  emagrecer: "Emagrecer",
  manter: "Manter o peso",
  ganhar_massa: "Ganhar massa",
  saude: "Saúde",
};

export default function DashboardPage() {
  const { settings } = useSettings();
  const profile = useLiveQuery(getProfile, []);
  const combinados = useLiveQuery(getCombinadosAtivos, []);
  const todayUsage = useLiveQuery(() => db.usage.where("createdAt").aboveOrEqual(startOfToday()).toArray(), []);
  const costToday = (todayUsage ?? []).reduce((s, u) => s + u.costUsd, 0);

  const onboardingPending = !profile || profile.status !== "active";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Hoje" />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {onboardingPending && (
            <Card className="border-brand-200 bg-brand-50">
              <p className="text-sm font-medium text-stone-800">
                {combinados ? "Seus Combinados estão prontos para aprovação." : "Comece pela entrevista inicial."}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {combinados
                  ? "Revise as metas e regras propostas pelo coach e aprove para ativar o acompanhamento."
                  : "O coach entende seu objetivo, histórico e rotina e propõe os Combinados: metas e regras do acompanhamento."}
              </p>
              <Link
                to={combinados ? "/combinados" : "/onboarding"}
                className="mt-3 inline-block rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white"
              >
                {combinados ? "Revisar Combinados" : profile?.status === "skipped" ? "Retomar entrevista" : "Iniciar entrevista"}
              </Link>
            </Card>
          )}

          {combinados && (
            <Card title={`Metas do dia · Combinados v${combinados.versao}`}>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Calorias" value={`${combinados.metaKcal} kcal`} />
                <Stat label="Proteína" value={`${combinados.metaProteinaG} g`} />
                <Stat label="Carboidrato" value={`${combinados.carboMinG}–${combinados.carboMaxG} g`} />
                <Stat label="Gordura" value={`${combinados.gorduraMinG}–${combinados.gorduraMaxG} g`} />
              </div>
              {combinados.refeicoes.length > 0 && (
                <ul className="mt-3 divide-y divide-stone-100 text-sm">
                  {combinados.refeicoes.map((r, i) => (
                    <li key={i} className="flex justify-between py-1.5">
                      <span>{r.nome}</span>
                      <span className="text-stone-500">{r.horario}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-stone-500">
                O registro de refeições e o saldo do dia entram na próxima fase. Por enquanto, registre pelo chat.
              </p>
              <Link to="/combinados" className="mt-2 inline-block text-sm font-medium text-brand-700 underline">
                Ver ou editar Combinados
              </Link>
            </Card>
          )}

          {profile && (profile.pesoAtualKg || profile.objetivo) && (
            <Card title="Perfil">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {profile.objetivo && (
                  <>
                    <dt className="text-stone-500">Objetivo</dt>
                    <dd>
                      {OBJETIVO_LABEL[profile.objetivo]}
                      {profile.metaPesoKg ? ` · meta ${profile.metaPesoKg} kg` : ""}
                      {profile.prazo ? ` · ${profile.prazo}` : ""}
                    </dd>
                  </>
                )}
                {profile.pesoAtualKg && (
                  <>
                    <dt className="text-stone-500">Peso atual</dt>
                    <dd>{profile.pesoAtualKg} kg</dd>
                  </>
                )}
                {profile.cinturaCm && (
                  <>
                    <dt className="text-stone-500">Cintura</dt>
                    <dd>{profile.cinturaCm} cm</dd>
                  </>
                )}
                {profile.alturaCm && profile.nascimento && (
                  <>
                    <dt className="text-stone-500">Altura / idade</dt>
                    <dd>
                      {profile.alturaCm} cm · {idadeAnos(profile.nascimento)} anos
                    </dd>
                  </>
                )}
                {profile.bioimpedancia?.gorduraPct && (
                  <>
                    <dt className="text-stone-500">Gordura</dt>
                    <dd>
                      {profile.bioimpedancia.gorduraPct}%
                      {profile.bioimpedancia.massaMagraKg ? ` · ${profile.bioimpedancia.massaMagraKg} kg massa magra` : ""}
                    </dd>
                  </>
                )}
              </dl>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Modelo" value={modelInfo(settings.model).label.replace("Claude ", "")} />
            <Stat label="Gasto hoje (estimado)" value={formatUsd(costToday)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
