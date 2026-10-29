import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, List, Plus, Search, X } from "lucide-react";
import { fold } from "../lib/foods";
import ConversationsPanel from "../components/ConversationsPanel";
import ChatView from "../components/ChatView";
import { PageHeader } from "../components/ui";
import { createConversation, useCoachChat } from "../hooks/useCoachChat";
import { db } from "../lib/db";
import { takePendingSend } from "../lib/pendingSend";
import { useT } from "../i18n";

export default function ChatPage() {
  const { conversationId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const convId = conversationId ? Number(conversationId) : undefined;
  const highlightId = search.get("m") ? Number(search.get("m")) : undefined;
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [hitIdx, setHitIdx] = useState(0);

  // Sem id na URL: abre a conversa livre mais recente ou cria a primeira.
  useEffect(() => {
    if (convId !== undefined) return;
    let cancelled = false;
    (async () => {
      const last = await db.conversations.where("kind").equals("coach").last();
      const id = last?.id ?? (await createConversation("coach"));
      if (!cancelled) navigate(`/chat/${id}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [convId, navigate]);

  const chat = useCoachChat(convId, "coach");
  const { t } = useT();

  // Busca na conversa atual: ids das mensagens que contêm o termo, em ordem cronológica.
  const hits = useMemo(() => {
    const n = fold(term.trim());
    if (n.length < 2 || !chat.messages) return [] as number[];
    return chat.messages.filter((m) => !m.hidden && fold(m.content).includes(n)).map((m) => m.id!);
  }, [term, chat.messages]);
  useEffect(() => setHitIdx(hits.length ? hits.length - 1 : 0), [hits.length, term]);
  const activeHit = searchOpen && hits.length ? hits[Math.min(hitIdx, hits.length - 1)] : undefined;
  const step = (d: number) => setHitIdx((i) => (hits.length ? (i + d + hits.length) % hits.length : 0));
  function closeSearch() {
    setSearchOpen(false);
    setTerm("");
  }

  // Envio pendente vindo de outra tela (ex.: upload em Registros › Documentos).
  useEffect(() => {
    if (convId === undefined || !chat.ready || chat.streaming || chat.messages === undefined) return;
    const p = takePendingSend();
    if (p) void chat.send(p.text, p.attachments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, chat.ready, chat.messages === undefined]);

  async function startNew() {
    const id = await createConversation("coach");
    navigate(`/chat/${id}`);
  }

  return (
    <div className="relative flex h-full flex-col">
      <PageHeader
        title={t("chat.title")}
        action={
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchOpen((v) => !v)} className={`rounded-full p-2 hover:bg-stone-100 ${searchOpen ? "bg-brand-50 text-brand-700" : "text-stone-600"}`} aria-label={t("chat.searchInChat")}>
              <Search size={20} />
            </button>
            <button onClick={() => setPanelOpen(true)} className="rounded-full p-2 text-stone-600 hover:bg-stone-100" aria-label={t("chat.conversations")}>
              <List size={20} />
            </button>
            <button onClick={startNew} className="rounded-full p-2 text-stone-600 hover:bg-stone-100" aria-label={t("chat.new")}>
              <Plus size={20} />
            </button>
          </div>
        }
      />
      <ConversationsPanel open={panelOpen} onClose={() => setPanelOpen(false)} currentId={convId} onNew={startNew} />
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2">
          <Search size={16} className="shrink-0 text-stone-400" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                step(e.shiftKey ? -1 : 1);
              } else if (e.key === "Escape") closeSearch();
            }}
            placeholder={t("chat.searchInChatPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <span className="shrink-0 text-xs text-stone-500" aria-live="polite">
            {term.trim().length >= 2 ? (hits.length ? t("chat.searchHits", { i: Math.min(hitIdx, hits.length - 1) + 1, n: hits.length }) : t("chat.noHits")) : ""}
          </span>
          <button onClick={() => step(-1)} disabled={!hits.length} className="rounded-full p-1.5 text-stone-600 hover:bg-stone-100 disabled:opacity-30" aria-label={t("chat.prevHit")}>
            <ChevronUp size={18} />
          </button>
          <button onClick={() => step(1)} disabled={!hits.length} className="rounded-full p-1.5 text-stone-600 hover:bg-stone-100 disabled:opacity-30" aria-label={t("chat.nextHit")}>
            <ChevronDown size={18} />
          </button>
          <button onClick={closeSearch} className="rounded-full p-1.5 text-stone-600 hover:bg-stone-100" aria-label={t("install.dismiss")}>
            <X size={18} />
          </button>
        </div>
      )}
      <ChatView
        messages={chat.messages}
        streaming={chat.streaming}
        error={chat.error}
        onSend={chat.send}
        onStop={chat.stop}
        placeholder={t("chat.placeholder")}
        empty={<Welcome />}
        highlightId={activeHit ?? highlightId}
        searchTerm={searchOpen && term.trim().length >= 2 ? term : undefined}
      />
    </div>
  );
}

function Welcome() {
  const { t } = useT();
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
      <p className="font-medium text-stone-800">{t("chat.hello")}</p>
      <p className="mt-2">{t("chat.youCan")}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>{t("chat.tip1")}</li>
        <li>{t("chat.tip2")}</li>
        <li>{t("chat.tip3")}</li>
      </ul>
    </div>
  );
}
