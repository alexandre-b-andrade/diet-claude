import { useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button, Card } from "./ui";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { useT } from "../i18n";

const DISMISS_KEY = "dietcoach.installDismissed";

interface Props {
  /** Mostra o botão de fechar e lembra a dispensa (usado na tela Hoje). */
  dismissible?: boolean;
  /** Mostra mesmo já instalado, com a confirmação (usado em Configurações). */
  showWhenInstalled?: boolean;
  className?: string;
}

export default function InstallCard({ dismissible = false, showWhenInstalled = false, className = "" }: Props) {
  const { mode, install } = useInstallPrompt();
  const { t } = useT();
  const [dismissed, setDismissed] = useState(() => dismissible && localStorage.getItem(DISMISS_KEY) === "1");
  const [busy, setBusy] = useState(false);

  if (dismissed) return null;
  if (mode === "installed" && !showWhenInstalled) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <Card className={`relative border-brand-200 bg-brand-50 ${className}`}>
      {dismissible && (
        <button onClick={dismiss} className="absolute top-3 right-3 text-stone-400 hover:text-stone-600" aria-label={t("install.dismiss")}>
          <X size={16} />
        </button>
      )}
      <div className="flex items-start gap-3">
        <Smartphone size={22} className="mt-0.5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1 text-sm">
          {mode === "installed" && <p className="font-medium text-stone-800">{t("install.done")}</p>}

          {mode === "native" && (
            <>
              <p className="font-medium text-stone-800">{t("install.title")}</p>
              <p className="mt-1 text-stone-600">{t("install.why")}</p>
              <Button
                className="mt-3"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await install();
                  setBusy(false);
                }}
              >
                <Download size={16} /> {t("install.button")}
              </Button>
            </>
          )}

          {mode === "ios" && (
            <>
              <p className="font-medium text-stone-800">{t("install.title")}</p>
              <p className="mt-1 text-stone-600">{t("install.why")}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-700">
                <li>
                  {t("install.ios1")} <Share size={14} className="inline text-sky-600" />
                </li>
                <li>{t("install.ios2")}</li>
                <li>{t("install.ios3")}</li>
              </ol>
              <p className="mt-2 text-xs text-stone-500">{t("install.iosNote")}</p>
            </>
          )}

          {mode === "manual" && (
            <>
              <p className="font-medium text-stone-800">{t("install.title")}</p>
              <p className="mt-1 text-stone-600">{t("install.why")}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone-700">
                <li>{t("install.manual1")}</li>
                <li>{t("install.manual2")}</li>
              </ol>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
