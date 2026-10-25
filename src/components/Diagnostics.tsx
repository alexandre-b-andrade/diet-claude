import { useEffect, useState } from "react";
import { Button, Card } from "./ui";
import { ALL_TABLES, db, wipeAllData } from "../lib/db";
import { APP_VERSION, clearErrors, loadErrors, type ErrorEntry } from "../lib/diag";
import { getApiKey, loadSettings } from "../lib/settings";

interface Info {
  version: string;
  userAgent: string;
  standalone: boolean;
  online: boolean;
  notification: string;
  serviceWorker: string;
  dbOpen: string;
  dbVersion: number | null;
  counts: Record<string, number | string>;
  apiKey: string;
  model: string;
  storage: string;
  errors: ErrorEntry[];
}

async function collect(): Promise<Info> {
  let dbOpen = "ok";
  let dbVersion: number | null = null;
  const counts: Record<string, number | string> = {};
  try {
    if (!db.isOpen()) await db.open();
    dbVersion = db.verno;
    for (const t of ALL_TABLES) {
      try {
        counts[t] = await db.table(t).count();
      } catch (e) {
        counts[t] = `erro: ${(e as Error).message}`;
      }
    }
  } catch (e) {
    dbOpen = `falha: ${(e as Error).name}: ${(e as Error).message}`;
  }
  let serviceWorker = "indisponível";
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    serviceWorker = reg ? `${reg.active ? "ativo" : "sem ativo"}${reg.waiting ? ", atualização aguardando" : ""}${navigator.serviceWorker.controller ? ", controlando a página" : ", não controla a página"}` : "não registrado";
  } catch (e) {
    serviceWorker = `erro: ${(e as Error).message}`;
  }
  let storage = "desconhecido";
  try {
    const est = await navigator.storage?.estimate();
    if (est) storage = `${Math.round((est.usage ?? 0) / 1024 / 1024)} MB usados de ${Math.round((est.quota ?? 0) / 1024 / 1024)} MB${(await navigator.storage?.persisted?.()) ? ", persistente" : ""}`;
  } catch {
    /* ignore */
  }
  const key = getApiKey();
  return {
    version: APP_VERSION,
    userAgent: navigator.userAgent,
    standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    online: navigator.onLine,
    notification: typeof Notification === "undefined" ? "sem suporte" : Notification.permission,
    serviceWorker,
    dbOpen,
    dbVersion,
    counts,
    apiKey: key ? `presente (${key.slice(0, 7)}…${key.slice(-4)}, ${key.length} caracteres)` : "ausente",
    model: loadSettings().model,
    storage,
    errors: loadErrors(),
  };
}

function toText(i: Info): string {
  return [
    `Diet Coach ${i.version}`,
    `Navegador: ${i.userAgent}`,
    `Instalado: ${i.standalone} · Online: ${i.online} · Notificações: ${i.notification}`,
    `Service worker: ${i.serviceWorker}`,
    `Banco: ${i.dbOpen} (v${i.dbVersion ?? "?"}) · ${i.storage}`,
    `Tabelas: ${Object.entries(i.counts).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    `API key: ${i.apiKey} · Modelo: ${i.model}`,
    `Erros recentes (${i.errors.length}):`,
    ...i.errors.map((e) => `- ${e.at} [${e.scope}] ${e.message}${e.stack ? `\n    ${e.stack.replace(/\n/g, "\n    ")}` : ""}`),
  ].join("\n");
}

export default function Diagnostics() {
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = () => collect().then(setInfo);
  useEffect(() => {
    void refresh();
  }, []);

  if (!info) return null;
  const text = toText(info);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: o texto está visível abaixo */
    }
  }

  async function clearCacheAndReload() {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
      const keys = await caches?.keys();
      await Promise.all((keys ?? []).map((k) => caches.delete(k)));
    } finally {
      location.reload();
    }
  }

  return (
    <Card title={`Diagnóstico · ${info.version}`}>
      <pre className="max-h-64 overflow-auto rounded-xl bg-stone-50 p-3 text-[11px] leading-snug whitespace-pre-wrap text-stone-700">{text}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={copy}>
          {copied ? "Copiado" : "Copiar diagnóstico"}
        </Button>
        <Button variant="ghost" onClick={refresh}>
          Atualizar
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            clearErrors();
            void refresh();
          }}
        >
          Limpar erros
        </Button>
        <Button variant="ghost" onClick={clearCacheAndReload}>
          Limpar cache e recarregar
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (confirm("Recriar o banco local apaga TODOS os dados deste aparelho. Exporte um backup antes. Continuar?")) {
              await wipeAllData();
              location.reload();
            }
          }}
        >
          Recriar banco local
        </Button>
      </div>
    </Card>
  );
}
