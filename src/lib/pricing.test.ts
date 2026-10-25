import { describe, expect, it } from "vitest";
import { estimateCostUsd, modelInfo, DEFAULT_MODEL } from "./pricing";

describe("pricing", () => {
  it("default model is Opus 5.5", () => {
    expect(DEFAULT_MODEL).toBe("claude-opus-5-5");
    expect(modelInfo("desconhecido").id).toBe("claude-opus-5-5");
  });

  it("estimates cost per million tokens", () => {
    const cost = estimateCostUsd("claude-opus-5-5", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
    expect(cost).toBeCloseTo(24, 6);
  });

  it("cache reads are cheaper than fresh input", () => {
    const fresh = estimateCostUsd("claude-sonnet-5-5", {
      inputTokens: 10_000,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
    const cached = estimateCostUsd("claude-sonnet-5-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 10_000,
    });
    expect(cached).toBeLessThan(fresh);
  });
});
