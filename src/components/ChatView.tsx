import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Markdown from "react-markdown";
import { Check, Paperclip, Send, Square, X } from "lucide-react";
import { fileToAttachment, type Attachment } from "../lib/attachments";
import type { ChatMessage } from "../lib/db";
import type { StreamingState } from "../hooks/useCoachChat";

interface Props {
  messages: ChatMessage[] | undefined;
  streaming: StreamingState | null;
  error: string | null;
  onSend: (text: string, attachments: Attachment[]) => Promise<void>;
  onStop: () => void;
  placeholder?: string;
  empty?: ReactNode;
  /** Conteúdo fixo acima do campo de texto (ex.: botão de revisar Combinados). */
  footer?: ReactNode;
}

export default function ChatView({ messages, streaming, error, onSend, onStop, placeholder, empty, footer }: Props) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, streaming?.text]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (streaming) return;
    const text = draft;
    const files = attachments;
    setDraft("");
    setAttachments([]);
    await onSend(text, files);
  }

  async function pickFiles(list: FileList | null) {
    if (!list) return;
    setAttachError(null);
    const next: Attachment[] = [];
    for (const f of Array.from(list)) {
      try {
        next.push(await fileToAttachment(f));
      } catch (err) {
        setAttachError((err as Error).message);
      }
    }
    setAttachments((a) => [...a, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {!messages?.some((m) => !m.hidden) && !streaming && empty}
          {messages?.filter((m) => !m.hidden).map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {streaming && (
            <Bubble
              msg={{ conversationId: 0, role: "assistant", content: streaming.text || "…", toolEvents: streaming.toolEvents, createdAt: Date.now() }}
              live
            />
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl space-y-2">
          {footer}
          {(attachments.length > 0 || attachError) && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-xs">
                  {a.name}
                  <button type="button" onClick={() => setAttachments((l) => l.filter((_, j) => j !== i))} aria-label="Remover anexo">
                    <X size={12} />
                  </button>
                </span>
              ))}
              {attachError && <span className="text-xs text-red-600">{attachError}</span>}
            </div>
          )}
          <form onSubmit={submit} className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => pickFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-full p-3 text-stone-500 hover:bg-stone-100"
              aria-label="Anexar foto ou PDF"
              disabled={Boolean(streaming)}
            >
              <Paperclip size={18} />
            </button>
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
              placeholder={placeholder ?? "Escreva aqui…"}
              className="max-h-40 flex-1 resize-none rounded-2xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
            {streaming ? (
              <button type="button" onClick={onStop} className="rounded-full bg-stone-800 p-3 text-white" aria-label="Parar">
                <Square size={18} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() && !attachments.length}
                className="rounded-full bg-brand-700 p-3 text-white disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send size={18} />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, live = false }: { msg: ChatMessage; live?: boolean }) {
  const mine = msg.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          mine ? "bg-brand-700 text-white" : "border border-stone-200 bg-white text-stone-900"
        }`}
      >
        {mine ? (
          <>
            <p className="whitespace-pre-wrap">{msg.content}</p>
            {msg.attachments?.length ? (
              <p className="mt-1 text-xs text-brand-100">Anexos: {msg.attachments.join(", ")}</p>
            ) : null}
          </>
        ) : (
          <>
            {msg.toolEvents?.length ? (
              <ul className="mb-2 space-y-0.5">
                {msg.toolEvents.map((t, i) => (
                  <li key={i} className="flex items-start gap-1 text-xs text-brand-700">
                    <Check size={12} className="mt-0.5 shrink-0" /> <span>{t.summary}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="md">
              <Markdown>{msg.content}</Markdown>
            </div>
            {live && !msg.content.trim() && <span className="text-xs text-stone-400">pensando…</span>}
          </>
        )}
        {msg.error && <p className="mt-2 text-xs text-red-600">{msg.error}</p>}
      </div>
    </div>
  );
}
