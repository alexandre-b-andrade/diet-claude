import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import { FileText, Trash2, Upload } from "lucide-react";
import { Button, Card } from "../../components/ui";
import { fileToAttachment } from "../../lib/attachments";
import { db, type DocumentoTipo } from "../../lib/db";
import { formatDateKey } from "../../lib/dates";
import { queueSend } from "../../lib/pendingSend";

export const TIPO_LABEL: Record<DocumentoTipo, string> = {
  plano: "Plano alimentar",
  nutricionista: "Orientações do nutricionista",
  laudo: "Laudo de bioimpedância",
  exame: "Exame laboratorial",
  tabela: "Tabela nutricional",
  receita: "Receita",
  outro: "Outro",
};

export default function Documentos() {
  const navigate = useNavigate();
  const docs = useLiveQuery(async () => (await db.documents.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
  const [open, setOpen] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setErr(null);
    try {
      const attachments = await Promise.all(Array.from(list).map(fileToAttachment));
      queueSend({
        text: "Leia este documento, extraia o que for útil para o meu acompanhamento e salve na minha biblioteca com salvar_documento (e registre exames, bioimpedância ou alimentos, se houver).",
        attachments,
      });
      navigate("/chat");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Enviar documento">
        <p className="text-sm text-stone-600">
          Plano alimentar, orientações do nutricionista, laudo de bioimpedância, exames, tabelas nutricionais ou receitas, em PDF ou foto. O coach lê, resume e guarda só o resumo; o arquivo não fica no aparelho.
        </p>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <Button className="mt-3" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> Escolher arquivo
        </Button>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      </Card>

      <Card title={`Biblioteca${docs?.length ? ` (${docs.length})` : ""}`}>
        {!docs?.length ? (
          <p className="text-sm text-stone-500">Nenhum documento ainda.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {docs.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <button className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(open === d.id ? null : d.id!)}>
                  <FileText size={18} className="mt-0.5 shrink-0 text-brand-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{d.titulo}</span>
                    <span className="block text-xs text-stone-500">
                      {TIPO_LABEL[d.tipo]}
                      {d.data ? ` · ${formatDateKey(d.data, { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                      {d.arquivoNome ? ` · ${d.arquivoNome}` : ""}
                    </span>
                  </span>
                </button>
                {open === d.id && (
                  <div className="mt-2 rounded-xl bg-stone-50 p-3">
                    <div className="md text-sm">
                      <Markdown>{d.resumo}</Markdown>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button onClick={() => confirm(`Remover "${d.titulo}"?`) && db.documents.delete(d.id!)} className="flex items-center gap-1 text-xs text-red-600">
                        <Trash2 size={12} /> Remover
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
