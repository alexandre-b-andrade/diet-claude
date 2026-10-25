import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card } from "./ui";
import { db, getCombinadosAtivos, getProfile } from "../lib/db";
import { addDays, todayKey } from "../lib/dates";
import { gerarInsights } from "../lib/insights";

const ICON = {
  positivo: <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-700" />,
  atencao: <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />,
  info: <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />,
};

export default function Insights() {
  const hoje = todayKey();
  const inicio = addDays(hoje, -6);
  const profile = useLiveQuery(getProfile, []);
  const combinados = useLiveQuery(getCombinadosAtivos, []);
  const meals7 = useLiveQuery(() => db.meals.where("date").between(inicio, hoje, true, true).toArray(), [hoje]);
  const water7 = useLiveQuery(() => db.water.where("date").between(inicio, hoje, true, true).toArray(), [hoje]);
  const activities7 = useLiveQuery(() => db.activities.where("date").between(inicio, hoje, true, true).toArray(), [hoje]);
  const pesos = useLiveQuery(() => db.measurements.where("tipo").equals("peso").toArray(), []);
  const cinturas = useLiveQuery(() => db.measurements.where("tipo").equals("cintura").toArray(), []);

  if (!meals7 || !water7 || !activities7 || !pesos || !cinturas) return null;
  const list = gerarInsights({ hoje, horaAgora: new Date().getHours(), profile, combinados, meals7, water7, activities7, pesos, cinturas });
  if (!list.length) return null;

  return (
    <Card title="Insights">
      <ul className="space-y-2 text-sm">
        {list.map((i, k) => (
          <li key={k} className="flex gap-2">
            {ICON[i.nivel]}
            <span>{i.texto}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
