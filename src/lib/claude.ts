import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CoachTool } from "../coach/tools";
import type { PromptParts } from "../coach/systemPrompt";
import type { Attachment } from "./attachments";
import type { TokenUsage } from "./pricing";

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaTool = Anthropic.Beta.Messages.BetaTool;
type BetaToolUseBlock = Anthropic.Beta.Messages.BetaToolUseBlock;
type BetaToolResultBlockParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;
type BetaContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam;
type CacheControl = Anthropic.Beta.Messages.BetaCacheControlEphemeral;

const EPHEMERAL: CacheControl = { type: "ephemeral" };

/** Modelos em que a mensagem `role: "system"` no meio da conversa foi rejeitada (fallback por sessão). */
const midSystemUnsupported = new Set<string>();

export function makeClient(apiKey: string) {
  // A chave é do próprio usuário e fica no aparelho dele; o app é 100% client-side.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/** Faz a chamada mais barata possível só para checar a chave. */
export async function validateApiKey(apiKey: string): Promise<void> {
  const client = makeClient(apiKey);
  await client.models.list({ limit: 1 });
}

export type HistoryTurn = { role: "user" | "assistant"; content: string | BetaContentBlockParam[] };

export interface ToolEvent {
  name: string;
  summary: string;
}

export interface RunTurnOptions {
  apiKey: string;
  model: string;
  prompt: PromptParts;
  history: HistoryTurn[];
  tools: CoachTool[];
  onText: (delta: string) => void;
  onToolEvent?: (ev: ToolEvent) => void;
  signal?: AbortSignal;
}

export interface RunTurnResult {
  text: string;
  usage: TokenUsage;
  stopReason: string | null;
  servedBy: string;
  toolEvents: ToolEvent[];
}

const MAX_TOOL_ROUNDS = 8;
/** Sem nenhum evento da API por este tempo, a chamada é abortada. */
const SILENCE_TIMEOUT_MS = 150_000;

export class SilenceTimeoutError extends Error {
  constructor() {
    super("A API ficou sem responder por mais de 2,5 minutos.");
    this.name = "SilenceTimeoutError";
  }
}

/**
 * Um turno completo do coach: streaming + execução local de ferramentas até o modelo encerrar.
 *
 * Layout pensado para cache de prompt (prefixo: tools → system → messages):
 * - tools e o system fixo nunca mudam entre turnos; breakpoint no último bloco do system;
 * - o histórico cresce só no fim; breakpoint no último bloco da última mensagem do usuário;
 * - o contexto dinâmico (perfil, diário, data) vai DEPOIS do histórico, como mensagem de sistema,
 *   para não invalidar o cache da conversa;
 * - em rodadas de ferramenta, breakpoint no último tool_result (só o mais recente, para caber em 4).
 */
export async function runTurn(opts: RunTurnOptions): Promise<RunTurnResult> {
  const client = makeClient(opts.apiKey);
  const tools: BetaTool[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToInputSchema(t.schema),
  }));
  const toolMap = new Map(opts.tools.map((t) => [t.name, t]));

  const system = opts.prompt.system.map((b, i, arr) => ({
    type: "text" as const,
    text: b.text,
    ...(i === arr.length - 1 ? { cache_control: EPHEMERAL } : {}),
  }));

  let useMidSystem = !midSystemUnsupported.has(opts.model);
  // Garantia: se por algum motivo o histórico não terminar em mensagem do usuário, o contexto
  // dinâmico vai no system do topo (como antes), para nunca faltar ao modelo.
  const lastTurn = opts.history[opts.history.length - 1];
  const contextInSystem = !lastTurn || lastTurn.role !== "user";
  if (contextInSystem) system.push({ type: "text" as const, text: opts.prompt.dynamic });

  const buildMessages = (): BetaMessageParam[] => {
    const msgs: BetaMessageParam[] = opts.history.map((h) => ({ role: h.role, content: h.content }));
    const last = msgs[msgs.length - 1];
    if (last && last.role === "user" && !contextInSystem) {
      if (useMidSystem) {
        last.content = withCacheOnLast(last.content);
        msgs.push({ role: "system", content: opts.prompt.dynamic });
      } else {
        // Fallback: contexto como bloco de texto no fim da mensagem do usuário, com o breakpoint antes dele.
        const blocks = withCacheOnLast(last.content);
        last.content = [...blocks, { type: "text", text: `<contexto_do_app>\n${opts.prompt.dynamic}\n</contexto_do_app>` }];
      }
    }
    return msgs;
  };
  let messages = buildMessages();
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
  const toolEvents: ToolEvent[] = [];
  let text = "";
  let servedBy = opts.model;
  let stopReason: string | null = null;

  // Watchdog: aborta se a API ficar muda por muito tempo (rede travada, proxy etc.).
  const watchdog = new AbortController();
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const kick = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      timedOut = true;
      watchdog.abort();
    }, SILENCE_TIMEOUT_MS);
  };
  opts.signal?.addEventListener("abort", () => watchdog.abort(), { once: true });

  try {
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    kick();
    const stream = client.beta.messages.stream(
      {
        model: opts.model,
        max_tokens: 16000,
        system,
        messages,
        tools,
        output_config: { effort: "medium" },
        // Se o modelo recusar por política, a API tenta o fallback padrão na mesma chamada.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: watchdog.signal },
    );

    stream.on("streamEvent", kick);
    stream.on("text", (delta) => {
      text += delta;
      opts.onText(delta);
    });

    let message: Awaited<ReturnType<typeof stream.finalMessage>>;
    try {
      message = await stream.finalMessage();
    } catch (err) {
      if (timedOut) throw new SilenceTimeoutError();
      // Modelo sem suporte a `role: "system"` no meio da conversa: refaz com o contexto na mensagem do usuário.
      if (useMidSystem && round === 0 && err instanceof Anthropic.BadRequestError && /role.*system/i.test(err.message)) {
        midSystemUnsupported.add(opts.model);
        useMidSystem = false;
        messages = buildMessages();
        round--;
        continue;
      }
      throw err;
    }
    servedBy = message.model;
    stopReason = message.stop_reason;
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    if (message.stop_reason !== "tool_use") break;

    const toolUses = message.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
    if (!toolUses.length) break;

    // Preserva o conteúdo completo (inclui blocos de thinking) na mesma rodada.
    messages.push({ role: "assistant", content: message.content });

    const results: BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const tool = toolMap.get(tu.name);
      if (!tool) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Ferramenta desconhecida: ${tu.name}` });
        continue;
      }
      const parsed = tool.schema.safeParse(tu.input);
      if (!parsed.success) {
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          is_error: true,
          content: `Entrada inválida: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        });
        continue;
      }
      try {
        const out = await tool.run(parsed.data);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out.result });
        const ev = { name: tu.name, summary: out.summary };
        toolEvents.push(ev);
        opts.onToolEvent?.(ev);
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Erro ao executar: ${(err as Error).message}` });
      }
    }
    // Só o tool_result mais recente carrega breakpoint (limite de 4 por requisição).
    for (const m of messages) {
      if (m.role === "user" && Array.isArray(m.content)) {
        for (const b of m.content) if (b.type === "tool_result" && "cache_control" in b) delete (b as { cache_control?: CacheControl }).cache_control;
      }
    }
    messages.push({ role: "user", content: withCacheOnLast(results) });
    if (text && !text.endsWith("\n")) {
      text += "\n\n";
      opts.onText("\n\n");
    }
  }
  } finally {
    if (silenceTimer) clearTimeout(silenceTimer);
  }

  return { text, usage, stopReason, servedBy, toolEvents };
}

/** Converte o conteúdo em blocos e marca o último com cache_control. */
function withCacheOnLast(content: string | BetaContentBlockParam[]): BetaContentBlockParam[] {
  const blocks: BetaContentBlockParam[] = typeof content === "string" ? [{ type: "text", text: content }] : content.map((b) => ({ ...b }));
  const last = blocks[blocks.length - 1];
  if (last && (last.type === "text" || last.type === "image" || last.type === "document" || last.type === "tool_result" || last.type === "tool_use")) {
    (last as { cache_control?: CacheControl }).cache_control = EPHEMERAL;
  }
  return blocks;
}

/** Monta o conteúdo de uma mensagem do usuário com anexos opcionais. */
export function userContent(text: string, attachments: Attachment[]): string | BetaContentBlockParam[] {
  if (!attachments.length) return text;
  const blocks: BetaContentBlockParam[] = attachments.map((a) => a.block as BetaContentBlockParam);
  blocks.push({ type: "text", text: text || "Analise o anexo." });
  return blocks;
}

function zodToInputSchema(schema: CoachTool["schema"]): BetaTool["input_schema"] {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return { ...json, type: "object" } as BetaTool["input_schema"];
}

/** Mensagem amigável para erros da API. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "API key inválida ou revogada. Verifique em Configurações.";
  if (err instanceof Anthropic.PermissionDeniedError) return "Esta chave não tem permissão para usar o modelo escolhido.";
  if (err instanceof Anthropic.RateLimitError) return "Limite de requisições atingido. Aguarde um pouco e tente de novo.";
  if (err instanceof Anthropic.BadRequestError) return `Requisição rejeitada pela API: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Sem conexão com a API. Verifique sua internet.";
  if (err instanceof Anthropic.APIError) return `Erro da API (${err.status ?? "?"}): ${err.message}`;
  if (err instanceof SilenceTimeoutError) return `${err.message} Verifique a conexão e tente de novo.`;
  if (err instanceof Error && err.name === "AbortError") return "Resposta interrompida.";
  if (err instanceof Error) return `${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${err.message}`;
  return "Erro inesperado. Tente novamente.";
}
