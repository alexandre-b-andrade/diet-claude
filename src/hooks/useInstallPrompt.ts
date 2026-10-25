import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "installed" | "native" | "ios" | "manual";

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOS;
}

/** Como o app pode ser instalado neste navegador e um disparador para o prompt nativo. */
export function useInstallPrompt() {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const l = () => {
      force((n) => n + 1);
      setInstalled(isStandalone());
    };
    listeners.add(l);
    const mq = window.matchMedia("(display-mode: standalone)");
    const onMq = () => setInstalled(isStandalone());
    mq.addEventListener("change", onMq);
    return () => {
      listeners.delete(l);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  const mode: InstallMode = installed ? "installed" : deferred ? "native" : isIOS() ? "ios" : "manual";

  async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") deferred = null;
    listeners.forEach((l) => l());
    return outcome;
  }

  return { mode, install };
}
