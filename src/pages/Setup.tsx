import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Input } from "../components/ui";
import { describeError, validateApiKey } from "../lib/claude";
import { useSettings } from "../lib/settings";

export default function SetupPage() {
  const { settings, updateApiKey } = useSettings();
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
    <div className="mx-auto flex h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <img src="icons/icon.svg" alt="" className="mx-auto mb-4 h-20 w-20" />
        <h1 className="text-2xl font-semibold">Diet Coach</h1>
        <p className="mt-2 text-sm text-stone-600">
          Seu coach de dieta com Claude. Para começar, informe sua API key da Anthropic.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="apikey" className="mb-1 block text-sm font-medium">
            API key
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
            Crie uma em{" "}
            <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            . Você paga diretamente à Anthropic pelo uso.
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
            Lembrar neste aparelho
            <span className="block text-xs text-stone-500">
              Desmarque para pedir a chave a cada vez que abrir o app.
            </span>
          </span>
        </label>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Verificando..." : "Começar"}
        </Button>
      </form>

      <div className="mt-8 flex gap-3 rounded-2xl bg-brand-50 p-4 text-xs text-stone-700">
        <ShieldCheck className="shrink-0 text-brand-700" size={20} />
        <p>
          Sua chave e todos os seus dados de saúde ficam somente neste aparelho. O app não tem servidor: o único
          tráfego externo é a conversa enviada à API da Anthropic. Este app não substitui nutricionista ou médico.
        </p>
      </div>
    </div>
  );
}
