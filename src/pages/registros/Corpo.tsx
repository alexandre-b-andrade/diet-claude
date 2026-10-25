import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { Button, Card, Input } from "../../components/ui";
import { db, upsertProfile, type Activity, type BioimpedanceEntry, type LabResult, type MedidaTipo } from "../../lib/db";
import { formatDateKey, todayKey } from "../../lib/dates";

const MEDIDA_LABEL: Record<MedidaTipo, string> = {
  peso: "Peso (kg)",
  cintura: "Cintura (cm)",
  quadril: "Quadril (cm)",
  pescoco: "Pescoço (cm)",
  peito: "Peito (cm)",
  braco: "Braço (cm)",
  coxa: "Coxa (cm)",
};

export default function Corpo() {
  return (
    <div className="space-y-4">
      <MedidaRapida />
      <BioForm />
      <TreinoForm />
      <DiaForm />
      <ExameForm />
      <Historico />
    </div>
  );
}

function MedidaRapida() {
  const [tipo, setTipo] = useState<MedidaTipo>("peso");
  const [valor, setValor] = useState("");
  const [date, setDate] = useState(todayKey());
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = Number(valor.replace(",", "."));
    if (!v) return;
    await db.measurements.add({ date, tipo, valor: v, createdAt: Date.now() });
    if (tipo === "peso" && date === todayKey()) await upsertProfile({ pesoAtualKg: v });
    if (tipo === "cintura") await upsertProfile({ cinturaCm: v });
    setMsg(`${MEDIDA_LABEL[tipo]}: ${v} registrado em ${formatDateKey(date)}.`);
    setValor("");
  }

  return (
    <Card title="Peso e medidas">
      <form onSubmit={submit} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as MedidaTipo)}>
          {(Object.keys(MEDIDA_LABEL) as MedidaTipo[]).map((k) => (
            <option key={k} value={k}>
              {MEDIDA_LABEL[k]}
            </option>
          ))}
        </select>
        <Input className="w-28" inputMode="decimal" placeholder={tipo === "peso" ? "kg" : "cm"} value={valor} onChange={(e) => setValor(e.target.value)} required />
        <Input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        <Button type="submit">Salvar</Button>
      </form>
      {msg && <p className="mt-2 text-xs text-brand-700">{msg}</p>}
      <p className="mt-2 text-xs text-stone-500">Pese-se nas mesmas condições (manhã, em jejum). O dashboard usa a média de 7 dias.</p>
    </Card>
  );
}

const BIO_FIELDS: { k: keyof BioimpedanceEntry; label: string }[] = [
  { k: "pesoKg", label: "Peso (kg)" },
  { k: "gorduraPct", label: "Gordura (%)" },
  { k: "massaGordaKg", label: "Massa gorda (kg)" },
  { k: "massaMagraKg", label: "Massa magra (kg)" },
  { k: "massaMuscularKg", label: "Massa muscular (kg)" },
  { k: "gorduraVisceral", label: "Gordura visceral" },
  { k: "aguaPct", label: "Água (%)" },
  { k: "tmbKcal", label: "TMB (kcal)" },
  { k: "idadeMetabolica", label: "Idade metabólica" },
];

function BioForm() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<BioimpedanceEntry>>({ date: todayKey() });
  const set = (k: keyof BioimpedanceEntry, v: string) => setF((x) => ({ ...x, [k]: k === "date" || k === "fonte" ? v : v === "" ? undefined : Number(v.replace(",", ".")) }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const date = f.date ?? todayKey();
    const entry = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "")) as Partial<BioimpedanceEntry>;
    await db.bioimpedance.add({ ...entry, date, createdAt: Date.now() });
    if (entry.pesoKg) await db.measurements.add({ date, tipo: "peso", valor: entry.pesoKg, createdAt: Date.now(), notas: "bioimpedância" });
    const { date: _d, fonte: _f, pesoKg, createdAt: _c, id: _i, ...bio } = entry;
    await upsertProfile({ bioimpedancia: { data: date, ...bio }, ...(pesoKg ? { pesoAtualKg: pesoKg } : {}) });
    setF({ date: todayKey() });
    setOpen(false);
  }

  return (
    <Card title="Bioimpedância">
      <p className="text-sm text-stone-600">Digite os valores da balança ou envie a foto do laudo ao coach, que extrai e registra.</p>
      <Button variant="ghost" className="mt-2" onClick={() => setOpen((v) => !v)}>
        {open ? "Fechar" : "Registrar manualmente"}
      </Button>
      {open && (
        <form onSubmit={submit} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="text-xs text-stone-500">
            Data
            <Input type="date" value={f.date ?? ""} max={todayKey()} onChange={(e) => set("date", e.target.value)} />
          </label>
          <label className="text-xs text-stone-500">
            Fonte
            <Input placeholder="balança Xiaomi, InBody…" value={f.fonte ?? ""} onChange={(e) => set("fonte", e.target.value)} />
          </label>
          {BIO_FIELDS.map(({ k, label }) => (
            <label key={k} className="text-xs text-stone-500">
              {label}
              <Input inputMode="decimal" value={(f[k] as number | undefined) ?? ""} onChange={(e) => set(k, e.target.value)} />
            </label>
          ))}
          <Button type="submit" className="col-span-2 sm:col-span-3">
            Salvar bioimpedância
          </Button>
        </form>
      )}
    </Card>
  );
}

function TreinoForm() {
  const [f, setF] = useState<Partial<Activity>>({ date: todayKey(), intensidade: "moderada" });
  const treinos = useLiveQuery(() => db.activities.where("date").equals(todayKey()).toArray(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.tipo || !f.duracaoMin) return;
    await db.activities.add({ date: f.date ?? todayKey(), tipo: f.tipo, duracaoMin: f.duracaoMin, intensidade: f.intensidade ?? "moderada", kcal: f.kcal, createdAt: Date.now() });
    setF({ date: todayKey(), intensidade: "moderada" });
  }

  return (
    <Card title="Treino">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input placeholder="musculação, corrida…" value={f.tipo ?? ""} onChange={(e) => setF({ ...f, tipo: e.target.value })} required />
        <Input type="number" placeholder="min" value={f.duracaoMin ?? ""} onChange={(e) => setF({ ...f, duracaoMin: Number(e.target.value) || undefined })} required />
        <select className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm" value={f.intensidade} onChange={(e) => setF({ ...f, intensidade: e.target.value as Activity["intensidade"] })}>
          <option value="leve">leve</option>
          <option value="moderada">moderada</option>
          <option value="intensa">intensa</option>
        </select>
        <Button type="submit">Salvar</Button>
      </form>
      {treinos?.length ? (
        <p className="mt-2 text-xs text-brand-700">
          Hoje: {treinos.map((t) => `${t.tipo} ${t.duracaoMin} min`).join(", ")}. O saldo do dia usa o ajuste de treino.
        </p>
      ) : (
        <p className="mt-2 text-xs text-stone-500">Com treino registrado, a meta do dia recebe o ajuste dos Combinados.</p>
      )}
    </Card>
  );
}

function DiaForm() {
  const hoje = todayKey();
  const daily = useLiveQuery(() => db.daily.get(hoje), [hoje]);
  const [sono, setSono] = useState("");
  const [passos, setPassos] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    await db.daily.put({
      date: hoje,
      sonoHoras: sono ? Number(sono.replace(",", ".")) : daily?.sonoHoras,
      passos: passos ? Number(passos) : daily?.passos,
      updatedAt: Date.now(),
    });
    setSono("");
    setPassos("");
  }

  return (
    <Card title="Sono e passos de hoje">
      <form onSubmit={submit} className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Input inputMode="decimal" placeholder={daily?.sonoHoras != null ? `${daily.sonoHoras} h` : "horas de sono"} value={sono} onChange={(e) => setSono(e.target.value)} />
        <Input inputMode="numeric" placeholder={daily?.passos != null ? `${daily.passos} passos` : "passos"} value={passos} onChange={(e) => setPassos(e.target.value)} />
        <Button type="submit" variant="ghost">
          Salvar
        </Button>
      </form>
    </Card>
  );
}

function ExameForm() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<LabResult>>({ date: todayKey() });
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.exame || f.valor == null) return;
    await db.labs.add({ date: f.date ?? todayKey(), exame: f.exame, valor: f.valor, unidade: f.unidade, referencia: f.referencia, createdAt: Date.now() });
    setF({ date: todayKey() });
    setOpen(false);
  }
  return (
    <Card title="Exames laboratoriais">
      <p className="text-sm text-stone-600">Envie a foto ou PDF do exame ao coach, ou registre manualmente.</p>
      <Button variant="ghost" className="mt-2" onClick={() => setOpen((v) => !v)}>
        {open ? "Fechar" : "Registrar exame"}
      </Button>
      {open && (
        <form onSubmit={submit} className="mt-3 grid grid-cols-2 gap-2">
          <Input placeholder="Exame (ex.: glicemia)" value={f.exame ?? ""} onChange={(e) => setF({ ...f, exame: e.target.value })} required />
          <Input inputMode="decimal" placeholder="Valor" value={f.valor ?? ""} onChange={(e) => setF({ ...f, valor: Number(e.target.value.replace(",", ".")) })} required />
          <Input placeholder="Unidade (mg/dL)" value={f.unidade ?? ""} onChange={(e) => setF({ ...f, unidade: e.target.value })} />
          <Input placeholder="Referência (70–99)" value={f.referencia ?? ""} onChange={(e) => setF({ ...f, referencia: e.target.value })} />
          <Input type="date" value={f.date ?? ""} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <Button type="submit">Salvar</Button>
        </form>
      )}
    </Card>
  );
}

function Historico() {
  const medidas = useLiveQuery(async () => (await db.measurements.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 30), []);
  const bios = useLiveQuery(async () => (await db.bioimpedance.toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
  const labs = useLiveQuery(async () => (await db.labs.toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
  const treinos = useLiveQuery(async () => (await db.activities.toArray()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20), []);

  return (
    <Card title="Histórico">
      <Section title="Medidas">
        {medidas?.map((m) => (
          <Row key={m.id} left={`${formatDateKey(m.date)} · ${MEDIDA_LABEL[m.tipo].replace(/ \(.*\)/, "")}`} right={`${m.valor} ${m.tipo === "peso" ? "kg" : "cm"}`} onDelete={() => db.measurements.delete(m.id!)} />
        ))}
      </Section>
      <Section title="Bioimpedância">
        {bios?.map((b) => (
          <Row
            key={b.id}
            left={`${formatDateKey(b.date)}${b.fonte ? ` · ${b.fonte}` : ""}`}
            right={[b.gorduraPct != null ? `${b.gorduraPct}%` : null, b.massaMagraKg != null ? `${b.massaMagraKg} kg magra` : null, b.gorduraVisceral != null ? `visc ${b.gorduraVisceral}` : null].filter(Boolean).join(" · ")}
            onDelete={() => db.bioimpedance.delete(b.id!)}
          />
        ))}
      </Section>
      <Section title="Treinos">
        {treinos?.map((t) => (
          <Row key={t.id} left={`${formatDateKey(t.date)} · ${t.tipo}`} right={`${t.duracaoMin} min · ${t.intensidade}`} onDelete={() => db.activities.delete(t.id!)} />
        ))}
      </Section>
      <Section title="Exames">
        {labs?.map((l) => (
          <Row key={l.id} left={`${formatDateKey(l.date)} · ${l.exame}`} right={`${l.valor}${l.unidade ? ` ${l.unidade}` : ""}${l.referencia ? ` (ref ${l.referencia})` : ""}`} onDelete={() => db.labs.delete(l.id!)} />
        ))}
      </Section>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  if (!arr.length || arr.every((c) => !c)) return null;
  return (
    <div className="mb-3">
      <h3 className="mb-1 text-xs font-semibold text-stone-500 uppercase">{title}</h3>
      <ul className="divide-y divide-stone-100 text-sm">{children}</ul>
    </div>
  );
}

function Row({ left, right, onDelete }: { left: string; right: string; onDelete: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span className="min-w-0 truncate text-stone-700">{left}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-medium">{right}</span>
        <button onClick={() => confirm("Remover registro?") && onDelete()} className="text-stone-400 hover:text-red-600" aria-label="Remover">
          <Trash2 size={14} />
        </button>
      </span>
    </li>
  );
}
