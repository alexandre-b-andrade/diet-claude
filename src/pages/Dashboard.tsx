import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { Card, PageHeader } from "../components/ui";
import { db } from "../lib/db";
import { formatUsd, modelInfo } from "../lib/pricing";
import { useSettings } from "../lib/settings";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function DashboardPage() {
  const { settings } = useSettings();
  const todayUsage = useLiveQuery(() => db.usage.where("createdAt").aboveOrEqual(startOfToday()).toArray(), []);
  const conversations = useLiveQuery(() => db.conversations.count(), []);

  const costToday = (todayUsage ?? []).reduce((s, u) => s + u.costUsd, 0);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Hoje" />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <Card title="Resumo do dia">
            <p className="text-sm text-stone-600">
              O dashboard de calorias, proteína, peso vs meta e medidas entra nas próximas fases, depois da entrevista
              inicial com o coach.
            </p>
            <Link to="/chat" className="mt-3 inline-block text-sm font-medium text-brand-700 underline">
              Falar com o coach
            </Link>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Conversas" value={String(conversations ?? 0)} />
            <Stat label="Gasto hoje (estimado)" value={formatUsd(costToday)} />
          </div>

          <Card title="Configuração atual">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-stone-500">Modelo</dt>
              <dd>{modelInfo(settings.model).label}</dd>
              <dt className="text-stone-500">Dados</dt>
              <dd>Somente neste aparelho</dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
