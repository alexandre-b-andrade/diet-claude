import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import { CalendarCheck } from "lucide-react";
import { Button, Card } from "./ui";
import { db, getCombinadosAtivos } from "../lib/db";
import { formatDateKey, todayKey } from "../lib/dates";
import { queueSend } from "../lib/pendingSend";
import { metricasEmTexto, metricasSemana, semanaAnterior } from "../lib/weekly";

export default function WeeklyReviewCard() {
  const navigate = useNavigate();
  const hoje = todayKey();
  const { inicio, fim } = semanaAnterior(hoje);
  const review = useLiveQuery(() => db.reviews.where("semanaInicio").equals(inicio).first(), [inicio]);
  const ultimo = useLiveQuery(async () => (await db.reviews.toArray()).sort((a, b) => b.semanaInicio.localeCompare(a.semanaInicio))[0], []);
  const temDados = useLiveQuery(() => db.meals.where("date").between(inicio, fim, true, true).count(), [inicio, fim]);

  async function fechar() {
    const [meals, water, acts, pesos, combinados] = await Promise.all([
      db.meals.where("date").between(inicio, fim, true, true).toArray(),
      db.water.where("date").between(inicio, fim, true, true).toArray(),
      db.activities.where("date").between(inicio, fim, true, true).toArray(),
      db.measurements.where("tipo").equals("peso").toArray(),
      getCombinadosAtivos(),
    ]);
    const m = metricasSemana(inicio, fim, meals, water, acts, pesos, combinados);
    queueSend({
      text: `Faça o fechamento da semana de ${inicio} a ${fim}. Métricas calculadas pelo app:\n\n${metricasEmTexto(m)}\n\nUse consultar_diario e consultar_historico se precisar de detalhes. Analise aderência, proteína, peso e treinos, destaque o que funcionou e o que ajustar na próxima semana, e salve com salvar_fechamento (inclua as métricas). Se as metas precisarem mudar, proponha com propor_combinados.`,
      attachments: [],
    });
    navigate("/chat");
  }

  const pendente = review === null || review === undefined ? (temDados ?? 0) > 0 && review === undefined : false;
  const mostrar = ultimo ?? review;

  return (
    <Card title="Fechamento semanal">
      {pendente && !review && (
        <div className="mb-3 flex items-start gap-3 rounded-xl bg-brand-50 p-3">
          <CalendarCheck className="mt-0.5 shrink-0 text-brand-700" size={18} />
          <div className="flex-1 text-sm">
            <p className="font-medium text-stone-800">
              Semana de {formatDateKey(inicio, { day: "2-digit", month: "short" })} a {formatDateKey(fim, { day: "2-digit", month: "short" })} ainda sem fechamento.
            </p>
            <Button className="mt-2" onClick={fechar}>
              Fazer fechamento com o coach
            </Button>
          </div>
        </div>
      )}
      {mostrar ? (
        <details open={!pendente}>
          <summary className="cursor-pointer text-sm font-medium">
            Semana de {formatDateKey(mostrar.semanaInicio, { day: "2-digit", month: "short" })} a {formatDateKey(mostrar.semanaFim, { day: "2-digit", month: "short" })}
          </summary>
          <div className="md mt-2 text-sm">
            <Markdown>{mostrar.resumo}</Markdown>
            {mostrar.ajustes && (
              <>
                <h3>Ajustes para a próxima semana</h3>
                <Markdown>{mostrar.ajustes}</Markdown>
              </>
            )}
          </div>
        </details>
      ) : (
        !pendente && <p className="text-sm text-stone-500">O primeiro fechamento aparece na segunda-feira seguinte à primeira semana com registros.</p>
      )}
    </Card>
  );
}
