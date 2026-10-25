import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Input } from "../components/ui";
import { describeError, validateApiKey } from "../lib/claude";
import { useSettings } from "../lib/settings";
import { useT } from "../i18n";
import InstallCard from "../components/InstallCard";

export default function SetupPage() {
  const { settings, updateApiKey, update } = useSettings();
  const { t, lang } = useT();
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(settings.rememberKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await validateApiKey(trimmed);
      updateApiKey(trimmed, remember);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-full max-w-md overflow-y-auto px-6 py-10">
      <div className="mb-8 text-center">
        <img src="icons/icon.svg" alt="" className="mx-auto mb-4 h-20 w-20" />
        <h1 className="text-2xl font-semibold">Diet Coach</h1>
        <p className="mt-2 text-sm text-stone-600">{t("setup.tagline")}</p>
        <div className="mt-3 flex justify-center gap-1 text-xs">
          {(["pt-BR", "en"] as const).map((l) => (
            <button key={l} type="button" onClick={() => update({ language: l })} className={`rounded-full px-3 py-1 ${lang === l ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-600"}`}>
              {l === "pt-BR" ? "Português" : "English"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="apikey" className="mb-1 block text-sm font-medium">
            {t("setup.apiKey")}
          </label>
          <Input
            id="apikey"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-stone-500">
            {t("setup.createKey")}{" "}
            <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            . {t("setup.pay")}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>
            {t("setup.remember")}
            <span className="block text-xs text-stone-500">{t("setup.rememberHint")}</span>
          </span>
        </label>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t("setup.checking") : t("setup.start")}
        </Button>
      </form>

      <InstallCard className="mt-6" />

      <div className="mt-4 flex gap-3 rounded-2xl bg-brand-50 p-4 text-xs text-stone-700">
        <ShieldCheck className="shrink-0 text-brand-700" size={20} />
        <p>{t("setup.privacy")}</p>
      </div>
    </div>
  );
}
