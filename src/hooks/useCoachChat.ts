import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Attachment } from "../lib/attachments";
import { describeError, runTurn, userContent, type HistoryTurn, type ToolEvent } from "../lib/claude";
import { db, type ChatMessage, type Conversation } from "../lib/db";
import { estimateCostUsd } from "../lib/pricing";
import { summarizeMessages } from "../lib/summarize";
import { logError } from "../lib/diag";
import { useSettings } from "../lib/settings";
import { buildSystemBlocks, type CoachMode } from "../coach/systemPrompt";
import { loadCoachContext } from "../coach/context";
import { COACH_TOOLS, ONBOARDING_TOOLS } from "../coach/toolsets";

/** Acima disso, as mensagens mais antigas são resumidas e saem do contexto. */
const HISTORY_LIMIT = 40;
/** Quantas mensagens recentes ficam íntegras após um resumo. */
const KEEP_RECENT = 24;

export interface StreamingState {
  text: string;
  toolEvents: ToolEvent[];
}

export function useCoachChat(conversationId: number | undefined, mode: CoachMode) {
  const { apiKey, settings } = useSettings();
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = useLiveQuery(
    () =>
      conversationId === undefined
        ? []
        : db.messages.where("conversationId").equals(conversationId).sortBy("createdAt"),
    [conversationId],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      if (streaming) {
        setError("Aguarde a resposta atual terminar ou toque em Parar.");
        return;
      }
      if (conversationId === undefined) {
        setError("Conversa ainda não carregada. Tente de novo em um instante.");
        logError("send", new Error("conversationId undefined"));
        return;
      }
      if (!apiKey) {
        setError("API key não encontrada. Configure em Configurações.");
        return;
      }
      const trimmed = text.trim();
      if (!trimmed && !attachments.length) return;
      setError(null);

      try {
        const now = Date.now();
        const isFirst = !(messages?.length ?? 0);
        await db.messages.add({
          conversationId,
          role: "user",
          content: trimmed || "(anexo)",
          attachments: attachments.map((a) => a.name),
          createdAt: now,
        });
        await db.conversations.update(conversationId, {
          updatedAt: now,
          ...(isFirst && mode === "coach" ? { title: (trimmed || attachments[0]?.name || "Conversa").slice(0, 60) } : {}),
        });
      } catch (err) {
        logError("send.db", err);
        setError(`Não foi possível gravar a mensagem no aparelho: ${describeError(err)}`);
        return;
      }

      await run(conversationId, attachments);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, apiKey, streaming, messages?.length, mode, settings.model],
  );

  /** Gera a resposta do coach para o histórico atual (usado no envio e na abertura da entrevista). */
  const run = useCallback(
    async (convId: number, attachments: Attachment[] = []) => {
      if (!apiKey) return;
      const all = (await db.messages.where("conversationId").equals(convId).sortBy("createdAt")).filter((m) => !m.error);
      const conv = await db.conversations.get(convId);
      let summary = conv?.summary;
      let stored = all.filter((m) => !conv?.summarizedUntilId || (m.id ?? 0) > conv.summarizedUntilId);
      if (stored.length > HISTORY_LIMIT) {
        // Resume o excedente com Haiku e guarda na conversa; falha aqui não impede a resposta.
        const antigas = stored.slice(0, stored.length - KEEP_RECENT);
        try {
          const r = await summarizeMessages(apiKey, summary, antigas);
          summary = r.text;
          await db.conversations.update(convId, { summary, summarizedUntilId: antigas.at(-1)!.id });
          await db.usage.add({
            createdAt: Date.now(),
            model: "claude-haiku-5-5",
            inputTokens: r.usage.inputTokens,
            outputTokens: r.usage.outputTokens,
            cacheWriteTokens: 0,
            cacheReadTokens: 0,
            costUsd: estimateCostUsd("claude-haiku-5-5", { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, cacheWriteTokens: 0, cacheReadTokens: 0 }),
          });
          stored = stored.slice(-KEEP_RECENT);
        } catch {
          stored = stored.slice(-HISTORY_LIMIT);
        }
      }
      const history = mergeTurns(stored);
      // Anexos só vão na mensagem atual (a última do usuário); o arquivo não é persistido.
      if (attachments.length && history.length) {
        const last = history[history.length - 1];
        if (last.role === "user" && typeof last.content === "string") last.content = userContent(last.content, attachments);
      }

      const context = await loadCoachContext();
      const controller = new AbortController();
      abortRef.current = controller;
      const state: StreamingState = { text: "", toolEvents: [] };
      setStreaming({ ...state });

      try {
        const result = await runTurn({
          apiKey,
          model: settings.model,
          system: buildSystemBlocks(mode, context, new Date(), summary),
          history,
          tools: mode === "onboarding" ? ONBOARDING_TOOLS : COACH_TOOLS,
          signal: controller.signal,
          onText: (delta) => {
            state.text += delta;
            setStreaming({ ...state });
          },
          onToolEvent: (ev) => {
            state.toolEvents.push(ev);
            setStreaming({ ...state });
          },
        });
        await db.messages.add({
          conversationId: convId,
          role: "assistant",
          content: result.text,
          toolEvents: result.toolEvents,
          createdAt: Date.now(),
        });
        await db.usage.add({
          createdAt: Date.now(),
          model: result.servedBy,
          ...result.usage,
          costUsd: estimateCostUsd(result.servedBy, result.usage),
        });
        if (result.stopReason === "refusal") setError("O modelo recusou responder a esta mensagem.");
      } catch (err) {
        logError("coach.run", err);
        const msg = describeError(err);
        if (state.text) {
          await db.messages.add({
            conversationId: convId,
            role: "assistant",
            content: state.text,
            toolEvents: state.toolEvents,
            createdAt: Date.now(),
            error: msg,
          });
        }
        setError(msg);
      } finally {
        abortRef.current = null;
        setStreaming(null);
      }
    },
    [apiKey, settings.model, mode],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, streaming, error, send, run, stop, ready: Boolean(apiKey) };
}

export async function createConversation(kind: Conversation["kind"], title = kind === "onboarding" ? "Entrevista inicial" : "Nova conversa"): Promise<number> {
  const now = Date.now();
  const id = await db.conversations.add({ title, kind, createdAt: now, updatedAt: now });
  return id as number;
}

/** A API exige alternância user/assistant; junta mensagens consecutivas do mesmo papel. */
function mergeTurns(history: ChatMessage[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  for (const m of history) {
    const last = turns[turns.length - 1];
    const content = m.attachments?.length ? `${m.content}\n[Anexos enviados: ${m.attachments.join(", ")}]` : m.content;
    if (last && last.role === m.role && typeof last.content === "string") last.content += `\n\n${content}`;
    else turns.push({ role: m.role, content });
  }
  while (turns.length && turns[0].role === "assistant") turns.shift();
  return turns;
}
