import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Markdown from "react-markdown";
import { Check, GripHorizontal, Loader2, Paperclip, Send, Square, X } from "lucide-react";
import { fileToAttachment, type Attachment } from "../lib/attachments";
import type { ChatMessage } from "../lib/db";
import type { StreamingState } from "../hooks/useCoachChat";
import { useT } from "../i18n";

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
  /** Mensagem a destacar e rolar até ela ao abrir (vinda da busca). */
  highlightId?: number;
}

const MIN_H = 44;
const COMPOSER_KEY = "dietcoach.composerMax";

function loadComposerMax(): number {
  const v = Number(localStorage.getItem(COMPOSER_KEY));
  return Number.isFinite(v) && v >= 80 ? v : 160;
}

export default function ChatView({ messages, streaming, error, onSend, onStop, placeholder, empty, footer, highlightId }: Props) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

  // Altura máxima do campo (ajustável pelo divisor) e se o usuário fixou uma altura por arrasto.
  const [composerMax, setComposerMax] = useState<number>(loadComposerMax);
  const [pinnedHeight, setPinnedHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  /** Ajusta a altura do campo ao conteúdo, limitada ao máximo (ou à altura fixada pelo arrasto). */
  const fit = useCallback(
    (el: HTMLTextAreaElement | null, reset = false) => {
      if (!el) return;
      if (reset) {
        el.style.height = `${MIN_H}px`;
        return;
      }
      if (pinnedHeight) {
        el.style.height = `${pinnedHeight}px`;
        return;
      }
      // Vazio: altura mínima fixa (o placeholder pode quebrar linha e inflar o scrollHeight).
      if (!el.value) {
        el.style.height = `${MIN_H}px`;
        return;
      }
      el.style.height = "auto";
      const h = Math.max(MIN_H, Math.min(el.scrollHeight, composerMax));
      el.style.height = `${h}px`;
    },
    [composerMax, pinnedHeight],
  );

  useEffect(() => fit(textRef.current), [draft, fit]);

  // Rolagem: até a mensagem destacada quando houver; senão, para o fim.
  useEffect(() => {
    if (highlightId && messages?.length) {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-mid="${highlightId}"]`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        return;
      }
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, streaming?.text, highlightId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (streaming) return;
    const text = draft;
    const files = attachments;
    setDraft("");
    setAttachments([]);
    // Volta ao tamanho mínimo depois de enviar.
    setPinnedHeight(null);
    fit(textRef.current, true);
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

  // Divisor arrastável entre a conversa e o campo de texto.
  function onDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    const el = textRef.current;
    if (!el) return;
    dragRef.current = { startY: e.clientY, startH: el.getBoundingClientRect().height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const el = textRef.current;
    if (!d || !el) return;
    const maxAllowed = Math.round(window.innerHeight * 0.6);
    const h = Math.max(MIN_H, Math.min(maxAllowed, d.startH + (d.startY - e.clientY)));
    el.style.height = `${h}px`;
    setPinnedHeight(h);
  }
  function onDragEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const h = textRef.current?.getBoundingClientRect().height ?? composerMax;
    const next = Math.max(80, Math.round(h));
    setComposerMax(next);
    localStorage.setItem(COMPOSER_KEY, String(next));
    // Altura fixada só até o próximo envio; se o texto for menor, segue como máximo.
    if (h <= MIN_H + 2) setPinnedHeight(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {!messages?.some((m) => !m.hidden) && !streaming && empty}
          {messages
            ?.filter((m) => !m.hidden)
            .map((m) => (
              <Bubble key={m.id} msg={m} highlighted={m.id === highlightId} />
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

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t("chat.resize")}
        title={t("chat.resize")}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="flex shrink-0 cursor-row-resize touch-none items-center justify-center border-t border-stone-200 bg-white py-1 text-stone-300 select-none hover:text-stone-500"
      >
        <GripHorizontal size={18} />
      </div>

      <div className="bg-white px-4 pb-3">
        <div className="mx-auto max-w-2xl space-y-2">
          {footer}
          {streaming && (
            <p className="flex items-center gap-2 text-xs text-stone-500">
              <Loader2 size={14} className="animate-spin text-brand-700" />
              {streaming.text ? t("chat.writing") : t("chat.thinking")}
            </p>
          )}
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
              aria-label={t("chat.attach")}
              disabled={Boolean(streaming)}
            >
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              style={{ height: MIN_H }}
              disabled={Boolean(streaming)}
              placeholder={streaming ? t("chat.wait") : (placeholder ?? "Escreva aqui…")}
              className="flex-1 resize-none overflow-y-auto rounded-2xl border border-stone-300 px-4 py-2.5 text-sm leading-relaxed outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-stone-50 disabled:text-stone-400"
            />
            {streaming ? (
              <button type="button" onClick={onStop} className="rounded-full bg-stone-800 p-3 text-white" aria-label={t("chat.stop")}>
                <Square size={18} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim() && !attachments.length}
                className="rounded-full bg-brand-700 p-3 text-white disabled:opacity-40"
                aria-label={t("chat.send")}
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

function Bubble({ msg, live = false, highlighted = false }: { msg: ChatMessage; live?: boolean; highlighted?: boolean }) {
  const mine = msg.role === "user";
  const { t } = useT();
  const thinkingLabel = t("chat.thinking");
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} data-mid={msg.id}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          mine ? "bg-brand-700 text-white" : "border border-stone-200 bg-white text-stone-900"
        } ${highlighted ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
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
                {msg.toolEvents.map((tev, i) => (
                  <li key={i} className="flex items-start gap-1 text-xs text-brand-700">
                    <Check size={12} className="mt-0.5 shrink-0" /> <span>{tev.summary}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="md">
              <Markdown>{msg.content}</Markdown>
            </div>
            {live && !msg.content.trim() && (
              <span className="flex items-center gap-2 text-xs text-stone-500">
                <Loader2 size={14} className="animate-spin text-brand-700" /> {thinkingLabel}
              </span>
            )}
          </>
        )}
        {msg.error && <p className="mt-2 text-xs text-red-600">{msg.error}</p>}
      </div>
    </div>
  );
}
