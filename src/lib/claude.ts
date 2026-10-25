import Anthropic from "@anthropic-ai/sdk";
import type { TokenUsage } from "./pricing";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function makeClient(apiKey: string) {
  // A chave é do próprio usuário e fica no aparelho dele; o app é 100% client-side.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/** Faz a chamada mais barata possível só para checar a chave. */
export async function validateApiKey(apiKey: string): Promise<void> {
  const client = makeClient(apiKey);
  await client.models.list({ limit: 1 });
}

export interface StreamOptions {
  apiKey: string;
  model: string;
  system: string;
  turns: ChatTurn[];
  onText: (delta: string) => void;
  signal?: AbortSignal;
}

export interface StreamResult {
  text: string;
  usage: TokenUsage;
  stopReason: string | null;
  servedBy: string;
}

export async function streamReply(opts: StreamOptions): Promise<StreamResult> {
  const client = makeClient(opts.apiKey);
  const stream = client.beta.messages.stream(
    {
      model: opts.model,
      max_tokens: 16000,
      // Prefixo estável em cache: o prompt do coach não muda entre mensagens.
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: opts.turns.map((t) => ({ role: t.role, content: t.content })),
      output_config: { effort: "medium" },
      // Se o modelo recusar por política, a API tenta o fallback padrão na mesma chamada.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { signal: opts.signal },
  );

  stream.on("text", opts.onText);
  const final = await stream.finalMessage();

  const text = final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text,
    stopReason: final.stop_reason,
    servedBy: final.model,
    usage: {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
    },
  };
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
  return "Erro inesperado. Tente novamente.";
}
