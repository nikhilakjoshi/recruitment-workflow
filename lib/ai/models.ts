export const MODELS = {
  cheap: "anthropic/claude-haiku-4.5",
  standard: "anthropic/claude-sonnet-4.6",
  heavy: "anthropic/claude-opus-4.7",
} as const;

export const GEMINI_MODELS = {
  cheap: "gemini-2.5-flash-lite",
  standard: "gemini-2.5-flash",
  heavy: "gemini-2.5-pro",
} as const;

export type ModelChoice = keyof typeof MODELS;
export type Provider = "anthropic" | "google";

export type ModelPricing = {
  inputPerMTok: number;
  cachedInputPerMTok: number;
  outputPerMTok: number;
};

export const MODEL_PRICING: Record<Provider, Record<ModelChoice, ModelPricing>> = {
  anthropic: {
    cheap: { inputPerMTok: 1.0, cachedInputPerMTok: 0.1, outputPerMTok: 5.0 },
    standard: { inputPerMTok: 3.0, cachedInputPerMTok: 0.3, outputPerMTok: 15.0 },
    heavy: { inputPerMTok: 15.0, cachedInputPerMTok: 1.5, outputPerMTok: 75.0 },
  },
  google: {
    cheap: { inputPerMTok: 0.1, cachedInputPerMTok: 0.025, outputPerMTok: 0.4 },
    standard: { inputPerMTok: 0.3, cachedInputPerMTok: 0.075, outputPerMTok: 2.5 },
    heavy: { inputPerMTok: 1.25, cachedInputPerMTok: 0.31, outputPerMTok: 10.0 },
  },
};

export function estimateCostUsd(
  provider: Provider,
  model: ModelChoice,
  inputTokens: number,
  cachedTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[provider][model];
  const nonCached = Math.max(0, inputTokens - cachedTokens);
  const cost =
    (nonCached / 1_000_000) * p.inputPerMTok +
    (cachedTokens / 1_000_000) * p.cachedInputPerMTok +
    (outputTokens / 1_000_000) * p.outputPerMTok;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function modelIdFor(provider: Provider, choice: ModelChoice): string {
  if (provider === "anthropic") return MODELS[choice];
  return `google/${GEMINI_MODELS[choice]}`;
}
