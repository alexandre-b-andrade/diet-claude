import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { Button, Card, Input, PageHeader } from "../components/ui";
import { db, getCombinadosAtivos, wipeAllData } from "../lib/db";
import { MODELS, formatBrl, formatUsd, type ModelId } from "../lib/pricing";
import { useSettings } from "../lib/settings";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export default function SettingsPage() {
  const { settings, apiKey, update, updateApiKey } = useSettings();
  const [newKey, setNewKey] = useState("");

  const monthUsage = useLiveQuery(() => db.usage.where("createdAt").aboveOrEqual(startOfMonth()).toArray(), []);
  const allUsage = useLiveQuery(() => db.usage.toArray(), []);
  const combinados = useLiveQuery(getCombinadosAtivos, []);

  const sum = (rows: { costUsd: number }[] | undefined) => (rows ?? []).reduce((s, r) => s + r.costUsd, 0);
  const tokens = (rows: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }[] | undefined) =>
    (rows ?? []).reduce((s, r) => s + r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens, 0);

  const masked = apiKey ? `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}` : "—";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Configurações" />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <Card title="Coach">
            <p className="text-sm text-stone-600">
              {combinados
                ? `Combinados v${combinados.versao} ${combinados.status === "aprovado" ? "aprovados" : "aguardando aprovação"}.`
                : "Entrevista inicial ainda não concluída."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link to="/combinados" className="rounded-xl bg-stone-100 px-4 py-2 font-medium text-stone-800">
                Ver Combinados
              </Link>
              <Link to="/onboarding" className="rounded-xl bg-stone-100 px-4 py-2 font-medium text-stone-800">
                {combinados ? "Continuar entrevista" : "Fazer entrevista"}
              </Link>
            </div>
          </Card>

          <Card title="Modelo">
            <div className="space-y-2">
              {MODELS.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                  <input
                    type="radio"
                    name="model"
                    className="mt-1"
                    checked={settings.model === m.id}
                    onChange={() => update({ model: m.id as ModelId })}
                  />
                  <span className="text-sm">
                    <span className="font-medium">{m.label}</span>
                    <span className="block text-stone-600">{m.description}</span>
                    <span className="block text-xs text-stone-500">
                      US$ {m.input} entrada / US$ {m.output} saída por milhão de tokens
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card title="Uso e custo estimado">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt className="text-stone-500">Este mês</dt>
              <dd className="text-right font-medium">
                {formatUsd(sum(monthUsage))} <span className="text-stone-500">≈ {formatBrl(sum(monthUsage) * settings.brlRate)}</span>
              </dd>
              <dt className="text-stone-500">Total</dt>
              <dd className="text-right">{formatUsd(sum(allUsage))}</dd>
              <dt className="text-stone-500">Tokens (total)</dt>
              <dd className="text-right">{tokens(allUsage).toLocaleString("pt-BR")}</dd>
            </dl>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <label htmlFor="brl" className="text-stone-500">
                Cotação US$ → R$
              </label>
              <Input
                id="brl"
                type="number"
                step="0.01"
                min="0"
                className="w-24"
                value={settings.brlRate}
                onChange={(e) => update({ brlRate: Number(e.target.value) || 0 })}
              />
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Estimativa calculada no aparelho a partir dos tokens informados pela API. O valor exato está no console da
              Anthropic.
            </p>
          </Card>

          <Card title="API key">
            <p className="text-sm">
              Chave atual: <code className="rounded bg-stone-100 px-1">{masked}</code>
            </p>
            <p className="text-xs text-stone-500">
              {settings.rememberKey ? "Salva neste aparelho." : "Guardada só nesta sessão do navegador."}
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                type="password"
                placeholder="Nova chave sk-ant-..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <Button
                variant="ghost"
                disabled={!newKey.trim()}
                onClick={() => {
                  updateApiKey(newKey.trim(), settings.rememberKey);
                  setNewKey("");
                }}
              >
                Trocar
              </Button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.rememberKey}
                onChange={(e) => apiKey && updateApiKey(apiKey, e.target.checked)}
              />
              Lembrar neste aparelho
            </label>
            <Button variant="danger" className="mt-3" onClick={() => updateApiKey(null, settings.rememberKey)}>
              Remover chave e sair
            </Button>
          </Card>

          <Card title="Dados">
            <p className="text-sm text-stone-600">
              Tudo fica neste aparelho. Exportar e importar backup chegam em uma fase futura.
            </p>
            <Button
              variant="danger"
              className="mt-3"
              onClick={async () => {
                if (confirm("Apagar todas as conversas e registros deste aparelho? Esta ação não pode ser desfeita.")) {
                  await wipeAllData();
                }
              }}
            >
              Apagar todos os dados
            </Button>
          </Card>

          <p className="px-1 text-xs text-stone-500">
            Diet Coach v0.1 · Este app não substitui nutricionista ou médico.
          </p>
        </div>
      </div>
    </div>
  );
}
