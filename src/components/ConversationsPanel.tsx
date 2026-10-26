import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Input } from "./ui";
import { db, type ChatMessage, type Conversation } from "../lib/db";
import { normalize } from "../lib/foods";
import { useT } from "../i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  currentId?: number;
  onNew: () => void;
}

interface Hit {
  msg: ChatMessage;
  conv: Conversation;
  snippet: string;
}

export default function ConversationsPanel({ open, onClose, currentId, onNew }: Props) {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const conversations = useLiveQuery(async () => (await db.conversations.toArray()).sort((a, b) => b.updatedAt - a.updatedAt), []);
  const lastMessages = useLiveQuery(async () => {
    const all = await db.messages.toArray();
    const byConv = new Map<number, ChatMessage>();
    for (const m of all) {
      if (m.hidden) continue;
      const cur = byConv.get(m.conversationId);
      if (!cur || m.createdAt > cur.createdAt) byConv.set(m.conversationId, m);
    }
    const counts = new Map<number, number>();
    for (const m of all) counts.set(m.conversationId, (counts.get(m.conversationId) ?? 0) + (m.hidden ? 0 : 1));
    return { byConv, counts };
  }, []);

  // Busca por texto em todas as mensagens, sem acento e sem caixa.
  useEffect(() => {
    const term = normalize(q);
    if (term.length < 2) {
      setHits(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const convs = new Map((await db.conversations.toArray()).map((c) => [c.id!, c]));
      const found = (await db.messages.filter((m) => !m.hidden && normalize(m.content).includes(term)).toArray())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50)
        .map((m) => ({ msg: m, conv: convs.get(m.conversationId)!, snippet: snippet(m.content, q) }))
        .filter((h) => h.conv);
      if (!cancelled) setHits(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  // Limpa a busca sempre que o painel fecha.
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;

  const loc = lang === "en" ? "en-US" : "pt-BR";
  const fmt = (ts: number) => new Date(ts).toLocaleDateString(loc, { day: "2-digit", month: "short" });

  async function rename(c: Conversation) {
    const title = prompt(t("chat.renamePrompt"), c.title);
    if (title && title.trim()) await db.conversations.update(c.id!, { title: title.trim().slice(0, 80) });
  }

  async function remove(c: Conversation) {
    if (!confirm(t("chat.deleteConfirm", { title: c.title }))) return;
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.messages.where("conversationId").equals(c.id!).delete();
      await db.conversations.delete(c.id!);
    });
    if (c.id === currentId) {
      onClose();
      navigate("/chat");
    }
  }

  function openConv(id: number, messageId?: number) {
    onClose();
    navigate(`/chat/${id}${messageId ? `?m=${messageId}` : ""}`);
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <h2 className="flex-1 text-lg font-semibold">{t("chat.conversations")}</h2>
        <button
          onClick={() => {
            onClose();
            onNew();
          }}
          className="flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-medium text-white"
        >
          <Plus size={14} /> {t("chat.new")}
        </button>
        <button onClick={onClose} className="rounded-full p-2 text-stone-600 hover:bg-stone-100" aria-label={t("install.dismiss")}>
          <X size={20} />
        </button>
      </div>
      <div className="border-b border-stone-200 px-4 py-2">
        <div className="relative">
          <Search size={16} className="absolute top-3 left-3 text-stone-400" />
          <Input className="pl-9" placeholder={t("chat.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {hits ? (
          hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-500">{t("chat.noResults")}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {hits.map((h) => (
                <li key={h.msg.id}>
                  <button onClick={() => openConv(h.conv.id!, h.msg.id)} className="w-full px-4 py-3 text-left text-sm hover:bg-stone-50">
                    <p className="flex justify-between text-xs text-stone-500">
                      <span className="truncate">{h.conv.title}</span>
                      <span className="shrink-0">{fmt(h.msg.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 text-stone-800">
                      <span className="text-stone-400">{h.msg.role === "user" ? t("chat.you") : "Coach"}: </span>
                      <Highlight text={h.snippet} term={q} />
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <ul className="divide-y divide-stone-100">
            {conversations?.map((c) => {
              const last = lastMessages?.byConv.get(c.id!);
              const n = lastMessages?.counts.get(c.id!) ?? 0;
              return (
                <li key={c.id} className={`flex items-start gap-2 px-4 py-3 ${c.id === currentId ? "bg-brand-50" : ""}`}>
                  <button onClick={() => openConv(c.id!)} className="min-w-0 flex-1 text-left text-sm">
                    <p className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 font-medium">
                        <MessageCircle size={14} className="shrink-0 text-brand-700" />
                        <span className="truncate">{c.kind === "onboarding" ? t("chat.interview") : c.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-stone-500">{fmt(c.updatedAt)}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {last ? `${last.role === "user" ? `${t("chat.you")}: ` : ""}${last.content.replace(/\s+/g, " ").slice(0, 90)}` : t("chat.emptyConv")}
                      {n ? ` · ${n}` : ""}
                    </p>
                  </button>
                  <button onClick={() => rename(c)} className="p-1 text-stone-400 hover:text-stone-700" aria-label={t("chat.rename")}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(c)} className="p-1 text-stone-400 hover:text-red-600" aria-label={t("chat.delete")}>
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
            {conversations?.length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-500">{t("chat.emptyConv")}</p>}
          </ul>
        )}
      </div>
    </div>
  );
}

function snippet(content: string, q: string, radius = 60): string {
  const flat = content.replace(/\s+/g, " ");
  const idx = normalize(flat).indexOf(normalize(q));
  if (idx < 0) return flat.slice(0, radius * 2);
  // normalize não muda o comprimento de forma confiável; aproxima pela posição em minúsculas sem acento
  const start = Math.max(0, idx - radius);
  const end = Math.min(flat.length, idx + q.length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

function Highlight({ text, term }: { text: string; term: string }) {
  const n = normalize(term);
  if (!n) return <>{text}</>;
  const lower = normalize(text);
  const i = lower.indexOf(n);
  if (i < 0 || lower.length !== text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-200 px-0.5">{text.slice(i, i + n.length)}</mark>
      {text.slice(i + n.length)}
    </>
  );
}
