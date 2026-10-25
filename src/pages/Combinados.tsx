import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Input, PageHeader } from "../components/ui";
import { aprovarCombinados, db, getCombinadosAtivos, getCombinadosPendentes, type Combinados } from "../lib/db";

export default function CombinadosPage() {
  const navigate = useNavigate();
  const vigente = useLiveQuery(getCombinadosAtivos, []);
  const pendente = useLiveQuery(getCombinadosPendentes, []);
  // Mostra a proposta pendente quando existir; senão, a versão em vigor.
  const atual = pendente === undefined || vigente === undefined ? undefined : (pendente ?? vigente);
  const historico = useLiveQuery(() => db.combinados.orderBy("versao").reverse().toArray(), []);
  const [form, setForm] = useState<Combinados | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (atual && (!form || form.id !== atual.id)) setForm(structuredClone(atual));
  }, [atual, form]);

  if (atual === undefined) return null;

  if (!atual || !form) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Combinados" />
        <div className="px-4 py-6">
          <Card>
            <p className="text-sm text-stone-600">
              Ainda não há Combinados. Eles são definidos na entrevista inicial com o coach.
            </p>
            <Button className="mt-3" onClick={() => navigate("/onboarding")}>
              Fazer entrevista inicial
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const set = <K extends keyof Combinados>(k: K, v: Combinados[K]) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [k]: v } : f));
  };

  async function approve() {
    if (!form?.id) return;
    const { id: _fid, status: _fs, aprovadoEm: _fa, createdAt: _fc, ...formRest } = form;
    const { id: _aid, status: _as, aprovadoEm: _aa, createdAt: _ac, ...atualRest } = atual!;
    const changed = JSON.stringify(formRest) !== JSON.stringify(atualRest);
    if (changed) {
      // Edição do usuário vira uma nova versão, mantendo a proposta do coach no histórico.
      const id = (await db.combinados.add({
        ...formRest,
        versao: (await db.combinados.count()) + 1,
        status: "proposto",
        createdAt: Date.now(),
        racional: `${form.racional}\n\nAjustado manualmente pelo usuário a partir da v${atual!.versao}.`,
      })) as number;
      await aprovarCombinados(id);
    } else {
      await aprovarCombinados(form.id);
    }
    setSaved(true);
    navigate("/hoje");
  }

  const num = (k: keyof Combinados) => (
    <Input
      type="number"
      value={(form[k] as number | undefined) ?? ""}
      onChange={(e) => set(k, (e.target.value === "" ? undefined : Number(e.target.value)) as never)}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`Combinados v${form.versao}${pendente && vigente && vigente.id !== pendente.id ? ` (em vigor: v${vigente.versao})` : ""}`}
        action={
          <span className={`rounded-full px-2.5 py-1 text-xs ${form.status === "aprovado" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}`}>
            {form.status === "aprovado" ? "Aprovado" : "Aguardando aprovação"}
          </span>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <Card title="Metas diárias">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Calorias (kcal)">{num("metaKcal")}</Field>
              <Field label="Proteína (g)">{num("metaProteinaG")}</Field>
              <Field label="Carboidrato mín. (g)">{num("carboMinG")}</Field>
              <Field label="Carboidrato máx. (g)">{num("carboMaxG")}</Field>
              <Field label="Gordura mín. (g)">{num("gorduraMinG")}</Field>
              <Field label="Gordura máx. (g)">{num("gorduraMaxG")}</Field>
              <Field label="Fibras (g)">{num("fibraG")}</Field>
              <Field label="Água (ml)">{num("aguaMl")}</Field>
            </div>
          </Card>

          <Card title="Dias de treino">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="kcal extras">{num("treinoAjusteKcal")}</Field>
              <Field label="Carboidrato extra (g)">{num("treinoAjusteCarboG")}</Field>
            </div>
          </Card>

          <Card title="Refeições">
            <div className="space-y-2">
              {form.refeicoes.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="w-24"
                    value={r.horario}
                    onChange={(e) => set("refeicoes", form.refeicoes.map((x, j) => (j === i ? { ...x, horario: e.target.value } : x)))}
                  />
                  <Input
                    value={r.nome}
                    onChange={(e) => set("refeicoes", form.refeicoes.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                  />
                  <button
                    type="button"
                    className="text-stone-400 hover:text-red-600"
                    onClick={() => set("refeicoes", form.refeicoes.filter((_, j) => j !== i))}
                    aria-label="Remover refeição"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => set("refeicoes", [...form.refeicoes, { nome: "", horario: "" }])}>
                <Plus size={16} /> Adicionar
              </Button>
            </div>
          </Card>

          <Card title="Acompanhamento">
            <div className="space-y-3 text-sm">
              <Field label="Pesagem">
                <Input value={form.pesagem} onChange={(e) => set("pesagem", e.target.value)} />
              </Field>
              <Field label="Cintura">
                <Input value={form.cintura} onChange={(e) => set("cintura", e.target.value)} />
              </Field>
              <Field label="Bioimpedância">
                <Input value={form.bioimpedancia} onChange={(e) => set("bioimpedancia", e.target.value)} />
              </Field>
              <Field label="Tom do coach">
                <select
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
                  value={form.tom}
                  onChange={(e) => set("tom", e.target.value as Combinados["tom"])}
                >
                  <option value="tecnico">Técnico e detalhado</option>
                  <option value="direto">Direto e objetivo</option>
                  <option value="acolhedor">Acolhedor</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Regras">
            <div className="space-y-2">
              {form.regras.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={r} onChange={(e) => set("regras", form.regras.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button
                    type="button"
                    className="text-stone-400 hover:text-red-600"
                    onClick={() => set("regras", form.regras.filter((_, j) => j !== i))}
                    aria-label="Remover regra"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => set("regras", [...form.regras, ""])}>
                <Plus size={16} /> Adicionar
              </Button>
            </div>
          </Card>

          <Card title="Como o coach chegou nesses números">
            <p className="whitespace-pre-wrap text-sm text-stone-600">{form.racional}</p>
          </Card>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={approve}>
              {form.status === "aprovado" ? "Salvar alterações" : "Aprovar Combinados"}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/onboarding")}>
              Ajustar com o coach
            </Button>
          </div>
          {saved && <p className="text-center text-xs text-brand-700">Salvo.</p>}

          {historico && historico.length > 1 && (
            <details className="text-xs text-stone-500">
              <summary className="cursor-pointer">Histórico de versões ({historico.length})</summary>
              <ul className="mt-2 space-y-1">
                {historico.map((h) => (
                  <li key={h.id}>
                    v{h.versao} · {new Date(h.createdAt).toLocaleDateString("pt-BR")} · {h.metaKcal} kcal / {h.metaProteinaG} g proteína · {h.status}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-stone-500">{label}</span>
      {children}
    </label>
  );
}
