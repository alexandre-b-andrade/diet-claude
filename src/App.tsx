import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Layout from "./components/Layout";
import ChatPage from "./pages/Chat";
import CombinadosPage from "./pages/Combinados";
import DashboardPage from "./pages/Dashboard";
import OnboardingPage from "./pages/Onboarding";
import RegistrosPage from "./pages/Registros";
import SettingsPage from "./pages/Settings";
import SetupPage from "./pages/Setup";
import { getProfile } from "./lib/db";
import { useSettings } from "./lib/settings";

export default function App() {
  const { apiKey } = useSettings();
  // undefined = carregando; null = ainda não existe perfil.
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, []);

  if (apiKey && profile === undefined) return null; // aguardando IndexedDB

  // Primeiro uso: vai direto para a entrevista. Depois de pular ou concluir, entra pelo dashboard.
  const home = apiKey && !profile ? "/onboarding" : "/hoje";

  return (
    <HashRouter>
      <Routes>
        {!apiKey ? (
          <>
            <Route path="/setup" element={<SetupPage />} />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </>
        ) : (
          <Route element={<Layout />}>
            <Route index element={<Navigate to={home} replace />} />
            <Route path="/hoje" element={<DashboardPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/combinados" element={<CombinadosPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:conversationId" element={<ChatPage />} />
            <Route path="/registros/*" element={<RegistrosPage />} />
            <Route path="/config" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={home} replace />} />
          </Route>
        )}
      </Routes>
    </HashRouter>
  );
}
