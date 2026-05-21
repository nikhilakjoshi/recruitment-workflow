export const MODELS = {
  cheap: "anthropic/claude-haiku-4.5",
  standard: "anthropic/claude-sonnet-4.6",
  heavy: "anthropic/claude-opus-4.7",
} as const;

export type ModelChoice = keyof typeof MODELS;

export type ModelPricing = {
  inputPerMTok: number;
  cachedInputPerMTok: number;
  outputPerMTok: number;
};

export const MODEL_PRICING: Record<ModelChoice, ModelPricing> = {
  cheap: { inputPerMTok: 1.0, cachedInputPerMTok: 0.1, outputPerMTok: 5.0 },
  standard: { inputPerMTok: 3.0, cachedInputPerMTok: 0.3, outputPerMTok: 15.0 },
  heavy: { inputPerMTok: 15.0, cachedInputPerMTok: 1.5, outputPerMTok: 75.0 },
};

export function estimateCostUsd(
  model: ModelChoice,
  inputTokens: number,
  cachedTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[model];
  const nonCached = Math.max(0, inputTokens - cachedTokens);
  const cost =
    (nonCached / 1_000_000) * p.inputPerMTok +
    (cachedTokens / 1_000_000) * p.cachedInputPerMTok +
    (outputTokens / 1_000_000) * p.outputPerMTok;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
