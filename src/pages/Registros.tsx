import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { PageHeader } from "../components/ui";
import { useT, type Key } from "../i18n";
import Alimentos from "./registros/Alimentos";
import Corpo from "./registros/Corpo";
import Documentos from "./registros/Documentos";
import Semanas from "./registros/Semanas";
import Refeicoes from "./registros/Refeicoes";

const TABS: { to: string; label: Key }[] = [
  { to: "/registros/refeicoes", label: "records.meals" },
  { to: "/registros/corpo", label: "records.body" },
  { to: "/registros/alimentos", label: "records.foods" },
  { to: "/registros/documentos", label: "records.documents" },
  { to: "/registros/semanas", label: "records.weeks" },
];

export default function RegistrosPage() {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={t("records.title")} />
      <nav className="flex flex-wrap gap-1.5 border-b border-stone-200 bg-white px-4 py-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm ${isActive ? "bg-brand-700 font-medium text-white" : "bg-stone-100 text-stone-600"}`
            }
          >
            {t(tab.label)}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <Routes>
            <Route index element={<Navigate to="refeicoes" replace />} />
            <Route path="refeicoes" element={<Refeicoes />} />
            <Route path="corpo" element={<Corpo />} />
            <Route path="alimentos" element={<Alimentos />} />
            <Route path="documentos" element={<Documentos />} />
            <Route path="semanas" element={<Semanas />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
