import { useLiveQuery } from "dexie-react-hooks";
import Markdown from "react-markdown";
import { Trash2 } from "lucide-react";
import { Card } from "../../components/ui";
import { db } from "../../lib/db";
import { formatDateKey } from "../../lib/dates";

export default function Semanas() {
  const reviews = useLiveQuery(async () => (await db.reviews.toArray()).sort((a, b) => b.semanaInicio.localeCompare(a.semanaInicio)), []);
  if (!reviews?.length) {
    return (
      <Card>
        <p className="text-sm text-stone-500">Nenhum fechamento semanal ainda. O botão aparece no dashboard na segunda-feira.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <Card key={r.id}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {formatDateKey(r.semanaInicio, { day: "2-digit", month: "short" })} a {formatDateKey(r.semanaFim, { day: "2-digit", month: "short", year: "numeric" })}
            </h3>
            <button onClick={() => confirm("Remover fechamento?") && db.reviews.delete(r.id!)} className="text-stone-400 hover:text-red-600" aria-label="Remover">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="md mt-2 text-sm">
            <Markdown>{r.resumo}</Markdown>
            {r.ajustes && (
              <>
                <h3>Ajustes</h3>
                <Markdown>{r.ajustes}</Markdown>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
