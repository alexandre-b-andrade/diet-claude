import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Trash2, Undo2 } from "lucide-react";
import { Card } from "./ui";
import { db, type WaterEntry } from "../lib/db";
import { useT } from "../i18n";

interface Props {
  title: string;
  icon: ReactNode;
  entries: WaterEntry[];
  /** Valor atual (ml ou contagem) e meta/limite. */
  value: number;
  goal: number;
  unit: string;
  /** Quando true, passar da meta é ruim (café); quando false, é bom (água). */
  limit?: boolean;
  quick: { label: string; ml: number }[];
  tipo: "agua" | "cafe";
  date: string;
  color: string; // classes tailwind da barra
  accent: string; // classes dos botões rápidos
  summary: string;
}

export default function IntakeCard({ title, icon, entries, value, goal, unit, limit = false, quick, tipo, date, color, accent, summary }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const over = limit && value > goal;
  const pct = Math.min(100, goal ? (value / goal) * 100 : 0);

  async function add(ml: number) {
    await db.water.add({ date, ml, tipo, createdAt: Date.now() });
  }
  async function undo() {
    // Último inserido (maior id), não o de horário mais tarde: evita apagar o registro errado.
    const last = [...entries].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    if (last?.id) await db.water.delete(last.id);
  }

  return (
    <Card title={title}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {icon}
          <span>
            <strong className={over ? "text-amber-700" : ""}>{summary}</strong>{" "}
            <span className="text-stone-500">
              {limit ? t("intake.limit") : t("today.of")} {goal} {unit}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {quick.map((q) => (
            <button key={q.label} onClick={() => add(q.ml)} className={`rounded-full px-3 py-1 text-xs font-medium ${accent}`}>
              {q.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full ${over ? "bg-amber-500" : color}`} style={{ width: `${pct}%` }} />
      </div>
      {entries.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <button onClick={undo} className="flex items-center gap-1 text-stone-600 hover:text-stone-900">
            <Undo2 size={12} /> {t("intake.undo")}
          </button>
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-stone-500 hover:text-stone-800">
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {t("intake.entries", { n: entries.length })}
          </button>
        </div>
      )}
      {open && (
        <ul className="mt-2 divide-y divide-stone-100 text-xs">
          {[...entries]
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((e) => (
              <li key={e.id} className="flex items-center justify-between py-1">
                <span className="text-stone-600">
                  {new Date(e.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {e.ml} ml
                </span>
                <button onClick={() => db.water.delete(e.id!)} className="text-stone-400 hover:text-red-600" aria-label={t("intake.remove")}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}
