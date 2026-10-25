import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { installGlobalErrorHandlers, logError } from "./lib/diag";

installGlobalErrorHandlers();
registerSW({ immediate: true, onRegisterError: (e) => logError("sw.register", e) });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
