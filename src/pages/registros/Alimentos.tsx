import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Barcode, Camera, Search, Trash2 } from "lucide-react";
import { Button, Card, Input } from "../../components/ui";
import { db, type CustomFood } from "../../lib/db";
import { lookupBarcode, searchFoods, TACO_FONTE, TACO_TOTAL, type FoodHit } from "../../lib/foods";

export default function Alimentos() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const custom = useLiveQuery(async () => (await db.foods.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!q.trim()) {
      setHits([]);
      return;
    }
    searchFoods(q, 15).then((h) => !cancelled && setHits(h));
    return () => {
      cancelled = true;
    };
  }, [q]);

  async function lookup(c: string) {
    setCodeBusy(true);
    setCodeMsg(null);
    try {
      const f = await lookupBarcode(c);
      setCodeMsg(f ? `Encontrado: ${f.nome}${f.marca ? ` (${f.marca})` : ""} — ${f.kcal} kcal/100 g. Salvo nos seus alimentos.` : "Produto não encontrado no Open Food Facts.");
    } catch (e) {
      setCodeMsg(`Erro: ${(e as Error).message}`);
    } finally {
      setCodeBusy(false);
      setScanning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Buscar alimento">
        <div className="relative">
          <Search size={16} className="absolute top-3 left-3 text-stone-400" />
          <Input className="pl-9" placeholder="Ex.: arroz cozido, peito de frango, pão francês" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {hits.length > 0 && (
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {hits.map((h) => (
              <li key={h.ref} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate">{h.nome}</p>
                  <p className="text-xs text-stone-500">
                    {h.marca ? `${h.marca} · ` : ""}
                    {h.categoria ?? h.fonte}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-stone-600">
                  <p className="font-medium text-stone-900">{h.kcal} kcal</p>
                  <p>
                    P {h.proteinaG} · C {h.carboG} · G {h.gorduraG}
                  </p>
                  <p className="text-stone-400">por 100 g</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-stone-500">
          {TACO_TOTAL} alimentos da {TACO_FONTE}, mais os seus alimentos. Peça ao coach para usar estes valores ao registrar.
        </p>
      </Card>

      <Card title="Código de barras">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (code.trim()) lookup(code.trim());
          }}
          className="flex gap-2"
        >
          <Input inputMode="numeric" placeholder="EAN, ex. 7891000100103" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" variant="ghost" disabled={codeBusy || !code.trim()}>
            <Barcode size={16} /> {codeBusy ? "..." : "Buscar"}
          </Button>
        </form>
        {"BarcodeDetector" in window && (
          <Button variant="ghost" className="mt-2" onClick={() => setScanning(true)} disabled={scanning}>
            <Camera size={16} /> Escanear com a câmera
          </Button>
        )}
        {scanning && <Scanner onDetect={(c) => lookup(c)} onCancel={() => setScanning(false)} />}
        {codeMsg && <p className="mt-2 text-xs text-stone-600">{codeMsg}</p>}
        <p className="mt-2 text-xs text-stone-500">Fonte: Open Food Facts (base colaborativa). Confira o rótulo quando possível.</p>
      </Card>

      <Card title="Meus alimentos">
        {!custom?.length ? (
          <p className="text-sm text-stone-500">Nenhum alimento próprio ainda. Envie um rótulo ou tabela ao coach, use o código de barras ou cadastre abaixo.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {custom.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate">{c.nome}</p>
                  <p className="text-xs text-stone-500">
                    {c.marca ? `${c.marca} · ` : ""}
                    {c.fonte}
                    {c.porcaoG ? ` · porção ${c.porcaoG} g` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-2 text-right text-xs text-stone-600">
                  <div>
                    <p className="font-medium text-stone-900">{c.kcal} kcal</p>
                    <p>
                      P {c.proteinaG} · C {c.carboG} · G {c.gorduraG}
                    </p>
                  </div>
                  <button onClick={() => confirm(`Remover ${c.nome}?`) && db.foods.delete(c.id!)} className="text-stone-400 hover:text-red-600" aria-label="Remover">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" className="mt-3" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Fechar" : "Cadastrar alimento"}
        </Button>
        {showForm && <FoodForm onSaved={() => setShowForm(false)} />}
      </Card>
    </div>
  );
}

function FoodForm({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState<Omit<CustomFood, "createdAt" | "fonte">>({ nome: "", kcal: 0, proteinaG: 0, carboG: 0, gorduraG: 0 });
  const set = (k: keyof typeof f, v: string) =>
    setF((x) => ({ ...x, [k]: k === "nome" || k === "marca" ? v : v === "" ? undefined : Number(v) }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await db.foods.add({ ...f, fonte: "usuario", createdAt: Date.now() });
        onSaved();
      }}
      className="mt-3 grid grid-cols-2 gap-2 text-sm"
    >
      <label className="col-span-2 text-xs text-stone-500">
        Nome
        <Input required value={f.nome} onChange={(e) => set("nome", e.target.value)} />
      </label>
      <label className="col-span-2 text-xs text-stone-500">
        Marca (opcional)
        <Input value={f.marca ?? ""} onChange={(e) => set("marca", e.target.value)} />
      </label>
      {(["kcal", "proteinaG", "carboG", "gorduraG", "fibraG", "porcaoG"] as const).map((k) => (
        <label key={k} className="text-xs text-stone-500">
          {{ kcal: "kcal / 100 g", proteinaG: "Proteína g / 100 g", carboG: "Carbo g / 100 g", gorduraG: "Gordura g / 100 g", fibraG: "Fibras g / 100 g", porcaoG: "Porção usual (g)" }[k]}
          <Input type="number" step="0.1" required={k === "kcal" || k === "proteinaG" || k === "carboG" || k === "gorduraG"} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
        </label>
      ))}
      <Button type="submit" className="col-span-2">
        Salvar
      </Button>
    </form>
  );
}

/** Leitor de código de barras com a API BarcodeDetector (Chrome Android, Safari recente). */
function Scanner({ onDetect, onCancel }: { onDetect: (code: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        const tick = async () => {
          if (done || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) {
              done = true;
              onDetect(codes[0].rawValue);
              return;
            }
          } catch {
            /* frame ainda não pronto */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setErr(`Câmera indisponível: ${(e as Error).message}`);
      }
    })();
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetect]);

  return (
    <div className="mt-2">
      <video ref={videoRef} className="w-full rounded-xl bg-black" muted playsInline />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      <Button variant="ghost" className="mt-2" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );
}
