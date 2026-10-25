import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { Button, Card, Input, PageHeader } from "../components/ui";
import { db, getCombinadosAtivos, wipeAllData } from "../lib/db";
import { backupFileName, exportBackup, importBackup, validateBackup } from "../lib/backup";
import { gerarIcs } from "../lib/ics";
import { useRef } from "react";
import { MODELS, formatBrl, formatUsd, type ModelId } from "../lib/pricing";
import { useSettings } from "../lib/settings";
import { useT } from "../i18n";
import InstallCard from "../components/InstallCard";
import Diagnostics from "../components/Diagnostics";
import { APP_VERSION } from "../lib/diag";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export default function SettingsPage() {
  const { settings, apiKey, update, updateApiKey } = useSettings();
  const [newKey, setNewKey] = useState("");
  const { t } = useT();
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const rem = settings.reminders;
  const notifPerm = typeof Notification !== "undefined" ? Notification.permission : "unsupported";

  async function doExport() {
    const b = await exportBackup();
    const blob = new Blob([JSON.stringify(b)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    a.click();
    URL.revokeObjectURL(url);
    const n = Object.values(b.tables).reduce((s, t) => s + (t?.length ?? 0), 0);
    setBackupMsg(`Backup exportado com ${n} registros.`);
  }

  async function doImport(file: File | undefined, modo: "substituir" | "mesclar") {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!validateBackup(json)) throw new Error("Arquivo não é um backup do Diet Coach.");
      if (modo === "substituir" && !confirm("Substituir TODOS os dados deste aparelho pelo backup? Esta ação não pode ser desfeita.")) return;
      const counts = await importBackup(json, modo);
      setBackupMsg(`Importado (${modo}): ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}.`);
    } catch (e) {
      setBackupMsg(`Erro ao importar: ${(e as Error).message}`);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

  function exportIcs() {
    const appUrl = `${location.origin}${location.pathname}`;
    const blob = new Blob([gerarIcs(settings.reminders, appUrl)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diet-coach-lembretes.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  const monthUsage = useLiveQuery(() => db.usage.where("createdAt").aboveOrEqual(startOfMonth()).toArray(), []);
  const allUsage = useLiveQuery(() => db.usage.toArray(), []);
  const combinados = useLiveQuery(getCombinadosAtivos, []);

  const sum = (rows: { costUsd: number }[] | undefined) => (rows ?? []).reduce((s, r) => s + r.costUsd, 0);
  const tokens = (rows: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }[] | undefined) =>
    (rows ?? []).reduce((s, r) => s + r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens, 0);

  const masked = apiKey ? `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}` : "—";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t("settings.title")} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <InstallCard showWhenInstalled />

          <Card title={t("settings.language")}>
            <div className="flex gap-1 text-sm">
              {(["pt-BR", "en"] as const).map((l) => (
                <button key={l} onClick={() => update({ language: l })} className={`rounded-full px-3 py-1 ${settings.language === l ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-600"}`}>
                  {l === "pt-BR" ? "Português (Brasil)" : "English"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">{t("settings.languageHint")}</p>
          </Card>

          <Card title={t("settings.coach")}>
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

          <Card title={t("settings.report")}>
            <p className="text-sm text-stone-600">{t("settings.reportHint")}</p>
            <Link to="/relatorio" className="mt-3 inline-block rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium text-stone-800">
              {t("settings.openReport")}
            </Link>
          </Card>

          <Card title={t("settings.usda")}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.usdaEnabled} onChange={(e) => update({ usdaEnabled: e.target.checked })} />
              {t("settings.usdaEnable")}
            </label>
            {settings.usdaEnabled && (
              <label className="mt-2 block text-xs text-stone-500">
                {t("settings.usdaKey")}
                <Input type="password" placeholder="DEMO_KEY" value={settings.usdaApiKey} onChange={(e) => update({ usdaApiKey: e.target.value.trim() })} />
              </label>
            )}
            <p className="mt-2 text-xs text-stone-500">
              {t("settings.usdaHint")}{" "}
              <a className="underline" href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">
                fdc.nal.usda.gov
              </a>
            </p>
          </Card>

          <Card title={t("settings.model")}>
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

          <Card title={t("settings.usage")}>
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
            <div className="mt-3 flex items-center gap-2 text-sm">
              <label htmlFor="budget" className="text-stone-500">
                Orçamento mensal (US$)
              </label>
              <Input
                id="budget"
                type="number"
                step="1"
                min="0"
                className="w-24"
                value={settings.monthlyBudgetUsd || ""}
                placeholder="0"
                onChange={(e) => update({ monthlyBudgetUsd: Number(e.target.value) || 0 })}
              />
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Estimativa calculada no aparelho a partir dos tokens informados pela API. O valor exato está no console da
              Anthropic. Com orçamento definido, o app avisa ao passar de 80%.
            </p>
          </Card>

          <Card title={t("settings.apiKey")}>
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

          <Card title={t("settings.reminders")}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rem.enabled} onChange={(e) => update({ reminders: { ...rem, enabled: e.target.checked } })} />
              Ativar lembretes
            </label>
            {rem.enabled && (
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-xs text-stone-500">Pesagem</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {DIAS.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => update({ reminders: { ...rem, pesagemDias: rem.pesagemDias.includes(i) ? rem.pesagemDias.filter((x) => x !== i) : [...rem.pesagemDias, i].sort() } })}
                        className={`h-8 w-8 rounded-full text-xs ${rem.pesagemDias.includes(i) ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-600"}`}
                      >
                        {d}
                      </button>
                    ))}
                    <Input type="time" className="w-28" value={rem.pesagemHora} onChange={(e) => update({ reminders: { ...rem, pesagemHora: e.target.value } })} />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-stone-500">Cintura (um dia por semana)</p>
                  <div className="flex items-center gap-1">
                    <select
                      className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                      value={rem.cinturaDia ?? ""}
                      onChange={(e) => update({ reminders: { ...rem, cinturaDia: e.target.value === "" ? null : Number(e.target.value) } })}
                    >
                      <option value="">desligado</option>
                      {["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"].map((d, i) => (
                        <option key={i} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <Input type="time" className="w-28" value={rem.cinturaHora} onChange={(e) => update({ reminders: { ...rem, cinturaHora: e.target.value } })} />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-stone-500">Registrar refeições (horários)</p>
                  <div className="flex flex-wrap gap-1">
                    {rem.refeicoesHoras.map((h, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Input type="time" className="w-28" value={h} onChange={(e) => update({ reminders: { ...rem, refeicoesHoras: rem.refeicoesHoras.map((x, j) => (j === i ? e.target.value : x)) } })} />
                        <button className="text-stone-400" onClick={() => update({ reminders: { ...rem, refeicoesHoras: rem.refeicoesHoras.filter((_, j) => j !== i) } })} aria-label="Remover">
                          ×
                        </button>
                      </span>
                    ))}
                    <Button variant="ghost" onClick={() => update({ reminders: { ...rem, refeicoesHoras: [...rem.refeicoesHoras, "18:00"] } })}>
                      +
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl bg-brand-50 p-3 text-xs text-stone-700">
                  <p className="font-medium text-stone-800">Lembretes com o app fechado: use o calendário do celular.</p>
                  <p className="mt-1">
                    Exporte os lembretes acima como eventos recorrentes com alarme e importe no Google Calendar ou no Calendário do iPhone. O calendário notifica mesmo com o app fechado. Se mudar os horários aqui, exporte de novo: os eventos têm o mesmo identificador e são atualizados.
                  </p>
                  <Button variant="ghost" className="mt-2" onClick={exportIcs}>
                    Exportar para o calendário (.ics)
                  </Button>
                  <p className="mt-2 text-stone-500">
                    Android: abra o arquivo baixado e escolha o Google Agenda, ou importe em calendar.google.com › Configurações › Importar. iPhone: toque no arquivo em Arquivos e em "Adicionar tudo".
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
                  {notifPerm === "granted" && "Notificações do app permitidas. Elas só são enviadas enquanto o app estiver aberto ou em segundo plano recente; o lembrete também aparece no topo da tela Hoje, com os botões Feito e Adiar, e o ícone do app mostra a quantidade pendente onde o sistema suportar."}
                  {notifPerm === "default" && (
                    <>
                      <p>Para receber notificação no aparelho, permita as notificações.</p>
                      <Button variant="ghost" className="mt-2" onClick={() => Notification.requestPermission().then(() => update({}))}>
                        Permitir notificações
                      </Button>
                    </>
                  )}
                  {notifPerm === "denied" && "Notificações bloqueadas no navegador. Os lembretes aparecem só dentro do app."}
                  {notifPerm === "unsupported" && "Este navegador não suporta notificações. Os lembretes aparecem só dentro do app."}
                </div>
              </div>
            )}
          </Card>

          <Card title={t("settings.backup")}>
            <p className="text-sm text-stone-600">Exporte um arquivo JSON com tudo (conversas, diário, medidas, documentos). Use para trocar de aparelho ou guardar uma cópia.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={doExport}>Exportar backup</Button>
              <Button variant="ghost" onClick={() => { importRef.current!.dataset.modo = "mesclar"; importRef.current?.click(); }}>
                Importar (mesclar)
              </Button>
              <Button variant="danger" onClick={() => { importRef.current!.dataset.modo = "substituir"; importRef.current?.click(); }}>
                Importar (substituir)
              </Button>
              <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => doImport(e.target.files?.[0], (e.target.dataset.modo as "substituir" | "mesclar") ?? "mesclar")} />
            </div>
            {backupMsg && <p className="mt-2 text-xs text-stone-600">{backupMsg}</p>}
          </Card>

          <Card title={t("settings.data")}>
            <p className="text-sm text-stone-600">Tudo fica neste aparelho.</p>
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

          <Diagnostics />

          <p className="px-1 text-xs text-stone-500">
            Diet Coach {APP_VERSION} · Este app não substitui nutricionista ou médico.
          </p>
        </div>
      </div>
    </div>
  );
}
