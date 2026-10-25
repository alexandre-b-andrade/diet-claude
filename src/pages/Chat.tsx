import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Markdown from "react-markdown";
import { Plus, Send, Square } from "lucide-react";
import { PageHeader } from "../components/ui";
import { db, type ChatMessage } from "../lib/db";
import { describeError, streamReply } from "../lib/claude";
import { estimateCostUsd } from "../lib/pricing";
import { useSettings } from "../lib/settings";
import { COACH_SYSTEM_PROMPT } from "../coach/systemPrompt";

/** Quantas mensagens anteriores vão no contexto. Resumos chegam na Fase 1. */
const HISTORY_LIMIT = 40;

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { apiKey, settings } = useSettings();

  const convId = conversationId ? Number(conversationId) : undefined;

  // Sem id na URL: abre a conversa mais recente ou cria a primeira.
  useEffect(() => {
    if (convId !== undefined) return;
    let cancelled = false;
    (async () => {
      const last = await db.conversations.orderBy("updatedAt").last();
      const id = last?.id ?? (await newConversation());
      if (!cancelled) navigate(`/chat/${id}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [convId, navigate]);

  const messages = useLiveQuery(
    () => (convId === undefined ? [] : db.messages.where("conversationId").equals(convId).sortBy("createdAt")),
    [convId],
  );

  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, streaming]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || convId === undefined || !apiKey || streaming !== null) return;
    setDraft("");
    setError(null);

    const now = Date.now();
    await db.messages.add({ conversationId: convId, role: "user", content: text, createdAt: now });
    await db.conversations.update(convId, { updatedAt: now, ...(messages?.length ? {} : { title: text.slice(0, 60) }) });

    const history = (await db.messages.where("conversationId").equals(convId).sortBy("createdAt"))
      .filter((m) => !m.error)
      .slice(-HISTORY_LIMIT);

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming("");
    let acc = "";

    try {
      const result = await streamReply({
        apiKey,
        model: settings.model,
        system: COACH_SYSTEM_PROMPT,
        turns: mergeTurns(history),
        signal: controller.signal,
        onText: (delta) => {
          acc += delta;
          setStreaming(acc);
        },
      });
      await db.messages.add({ conversationId: convId, role: "assistant", content: result.text, createdAt: Date.now() });
      await db.usage.add({
        createdAt: Date.now(),
        model: result.servedBy,
        ...result.usage,
        costUsd: estimateCostUsd(result.servedBy, result.usage),
      });
      if (result.stopReason === "refusal") {
        setError("O modelo recusou responder a esta mensagem.");
      }
    } catch (err) {
      const msg = describeError(err);
      if (acc) {
        await db.messages.add({ conversationId: convId, role: "assistant", content: acc, createdAt: Date.now(), error: msg });
      }
      setError(msg);
    } finally {
      abortRef.current = null;
      setStreaming(null);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function startNew() {
    const id = await newConversation();
    navigate(`/chat/${id}`);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Coach"
        action={
          <button onClick={startNew} className="rounded-full p-2 text-stone-600 hover:bg-stone-100" aria-label="Nova conversa">
            <Plus size={20} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {messages?.length === 0 && streaming === null && <Welcome />}
          {messages?.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {streaming !== null && (
            <Bubble msg={{ conversationId: convId ?? 0, role: "assistant", content: streaming || "…", createdAt: Date.now() }} />
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={send} className="border-t border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            placeholder="Conte o que comeu, seu peso, ou peça uma sugestão…"
            className="max-h-40 flex-1 resize-none rounded-2xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          {streaming !== null ? (
            <button type="button" onClick={stop} className="rounded-full bg-stone-800 p-3 text-white" aria-label="Parar">
              <Square size={18} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-full bg-brand-700 p-3 text-white disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

async function newConversation(): Promise<number> {
  const now = Date.now();
  const id = await db.conversations.add({ title: "Nova conversa", createdAt: now, updatedAt: now });
  return id as number;
}

/** A API exige alternância user/assistant; junta mensagens consecutivas do mesmo papel. */
function mergeTurns(history: ChatMessage[]) {
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else turns.push({ role: m.role, content: m.content });
  }
  // Nunca começar com assistant.
  while (turns.length && turns[0].role === "assistant") turns.shift();
  return turns;
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          mine ? "bg-brand-700 text-white" : "border border-stone-200 bg-white text-stone-900"
        }`}
      >
        {mine ? <p className="whitespace-pre-wrap">{msg.content}</p> : <div className="md"><Markdown>{msg.content}</Markdown></div>}
        {msg.error && <p className="mt-2 text-xs text-red-600">{msg.error}</p>}
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
      <p className="font-medium text-stone-800">Olá. Sou seu coach de dieta.</p>
      <p className="mt-2">Você pode começar me contando:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>seu objetivo, peso atual, altura, idade e rotina de treinos;</li>
        <li>o que comeu hoje, para eu calcular kcal e macros;</li>
        <li>o que tem em casa, para eu sugerir uma refeição.</li>
      </ul>
      <p className="mt-3 text-xs text-stone-500">
        Em breve: entrevista inicial guiada, registro automático de refeições e medidas, e dashboard.
      </p>
    </div>
  );
}
