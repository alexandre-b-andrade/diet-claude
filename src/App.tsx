import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ChatPage from "./pages/Chat";
import DashboardPage from "./pages/Dashboard";
import SettingsPage from "./pages/Settings";
import SetupPage from "./pages/Setup";
import { useSettings } from "./lib/settings";

export default function App() {
  const { apiKey } = useSettings();

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
            <Route index element={<Navigate to="/hoje" replace />} />
            <Route path="/hoje" element={<DashboardPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:conversationId" element={<ChatPage />} />
            <Route path="/config" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/hoje" replace />} />
          </Route>
        )}
      </Routes>
    </HashRouter>
  );
}
