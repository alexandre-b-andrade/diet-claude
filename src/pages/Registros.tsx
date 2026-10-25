import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { PageHeader } from "../components/ui";
import Alimentos from "./registros/Alimentos";
import Corpo from "./registros/Corpo";
import Documentos from "./registros/Documentos";
import Refeicoes from "./registros/Refeicoes";

const TABS = [
  { to: "/registros/refeicoes", label: "Refeições" },
  { to: "/registros/corpo", label: "Corpo" },
  { to: "/registros/alimentos", label: "Alimentos" },
  { to: "/registros/documentos", label: "Documentos" },
];

export default function RegistrosPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Registros" />
      <nav className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-4">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `shrink-0 border-b-2 px-3 py-2 text-sm ${isActive ? "border-brand-700 font-medium text-brand-800" : "border-transparent text-stone-500"}`
            }
          >
            {t.label}
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
          </Routes>
        </div>
      </div>
    </div>
  );
}
