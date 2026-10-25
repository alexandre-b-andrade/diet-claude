/** Modelos oferecidos ao usuário e preços (US$ por milhão de tokens). */
export type ModelId = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";

export interface ModelInfo {
  id: ModelId;
  label: string;
  description: string;
  /** US$ por 1M tokens */
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const MODELS: ModelInfo[] = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    description: "Padrão. Mais capaz para análises nutricionais detalhadas.",
    input: 4,
    output: 20,
    cacheWrite: 5,
    cacheRead: 0.2,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    description: "Mais econômico, bom para o dia a dia.",
    input: 2,
    output: 10,
    cacheWrite: 2.5,
    cacheRead: 0.2,
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    description: "Muito barato e rápido. Menos profundidade nas análises.",
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
  },
];

export const DEFAULT_MODEL: ModelId = "claude-opus-5-5";

export function modelInfo(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

/** Custo estimado em US$ de um uso em um modelo. */
export function estimateCostUsd(model: string, u: TokenUsage): number {
  const m = modelInfo(model);
  const perTok = 1 / 1_000_000;
  return (
    u.inputTokens * m.input * perTok +
    u.outputTokens * m.output * perTok +
    u.cacheWriteTokens * m.cacheWrite * perTok +
    u.cacheReadTokens * m.cacheRead * perTok
  );
}

export function formatUsd(v: number): string {
  return v < 0.01 && v > 0 ? "< US$ 0,01" : `US$ ${v.toFixed(2).replace(".", ",")}`;
}

export function formatBrl(v: number): string {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}
