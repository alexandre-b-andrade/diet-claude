import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CoachTool } from "../coach/tools";
import type { SystemBlock } from "../coach/systemPrompt";
import type { Attachment } from "./attachments";
import type { TokenUsage } from "./pricing";

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaTool = Anthropic.Beta.Messages.BetaTool;
type BetaToolUseBlock = Anthropic.Beta.Messages.BetaToolUseBlock;
type BetaToolResultBlockParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;
type BetaContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam;

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
  system: SystemBlock[];
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

/** Um turno completo do coach: streaming + execução local de ferramentas até o modelo encerrar. */
export async function runTurn(opts: RunTurnOptions): Promise<RunTurnResult> {
  const client = makeClient(opts.apiKey);
  const tools: BetaTool[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToInputSchema(t.schema),
  }));
  const toolMap = new Map(opts.tools.map((t) => [t.name, t]));

  const messages: BetaMessageParam[] = opts.history.map((h) => ({ role: h.role, content: h.content }));
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };
  const toolEvents: ToolEvent[] = [];
  let text = "";
  let servedBy = opts.model;
  let stopReason: string | null = null;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const stream = client.beta.messages.stream(
      {
        model: opts.model,
        max_tokens: 16000,
        system: opts.system.map((b) => ({
          type: "text" as const,
          text: b.text,
          ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
        })),
        messages,
        tools,
        output_config: { effort: "medium" },
        // Se o modelo recusar por política, a API tenta o fallback padrão na mesma chamada.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: opts.signal },
    );

    stream.on("text", (delta) => {
      text += delta;
      opts.onText(delta);
    });

    const message = await stream.finalMessage();
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
    messages.push({ role: "user", content: results });
    if (text && !text.endsWith("\n")) {
      text += "\n\n";
      opts.onText("\n\n");
    }
  }

  return { text, usage, stopReason, servedBy, toolEvents };
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
  if (err instanceof Error && err.name === "AbortError") return "Resposta interrompida.";
  if (err instanceof Error) return err.message;
  return "Erro inesperado. Tente novamente.";
}
