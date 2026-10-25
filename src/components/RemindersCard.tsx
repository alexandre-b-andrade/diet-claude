import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Card } from "./ui";
import type { DueReminder } from "../lib/reminders";

export default function RemindersCard({ due }: { due: DueReminder[] }) {
  if (!due.length) return null;
  return (
    <Card className="border-sky-200 bg-sky-50">
      <ul className="space-y-1.5 text-sm">
        {due.map((r) => (
          <li key={r.id} className="flex items-start gap-2">
            <Bell size={16} className="mt-0.5 shrink-0 text-sky-700" />
            <span>
              <strong>{r.titulo}.</strong> {r.corpo}{" "}
              <Link to={r.tipo === "refeicao" ? "/chat" : "/registros/corpo"} className="text-sky-700 underline">
                {r.tipo === "refeicao" ? "Registrar" : "Anotar"}
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
