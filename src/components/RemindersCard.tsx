import { Link } from "react-router-dom";
import { Bell, Check, Clock } from "lucide-react";
import { Card } from "./ui";
import type { DueReminder } from "../lib/reminders";

interface Props {
  due: DueReminder[];
  onDone: (id: string) => void;
  onSnooze: (id: string, minutos?: number) => void;
}

export default function RemindersCard({ due, onDone, onSnooze }: Props) {
  if (!due.length) return null;
  return (
    <Card className="border-sky-200 bg-sky-50">
      <ul className="space-y-2 text-sm">
        {due.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            <Bell size={16} className="mt-0.5 shrink-0 text-sky-700" />
            <div className="min-w-0 flex-1">
              <p>
                <strong>{r.titulo}.</strong> {r.corpo}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                <Link to={r.tipo === "refeicao" ? "/chat" : "/registros/corpo"} className="rounded-full bg-sky-700 px-2.5 py-1 font-medium text-white">
                  {r.tipo === "refeicao" ? "Registrar" : "Anotar"}
                </Link>
                <button onClick={() => onDone(r.id)} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sky-800">
                  <Check size={12} /> Feito
                </button>
                <button onClick={() => onSnooze(r.id, 60)} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-sky-800">
                  <Clock size={12} /> Adiar 1 h
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
