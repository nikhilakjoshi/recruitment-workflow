import { generateObject, generateText, type LanguageModel, type ModelMessage } from "ai";
import type { ZodType } from "zod";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { prisma } from "@/lib/db";
import {
  estimateCostUsd,
  GEMINI_MODELS,
  MODELS,
  modelIdFor,
  type ModelChoice,
  type Provider,
} from "./models";

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
  cache?: boolean;
};

export type CallLLMArgs = {
  worker: string;
  model: ModelChoice;
  system?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  applicationId?: string | null;
  eventId?: string | null;
};

export type CallLLMResult = {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
  };
  estimatedCostUsd: number;
  provider: Provider;
};

type GenerateTextFn = typeof generateText;

let generateTextImpl: GenerateTextFn = generateText;

// Test-only injection of a mock generator.
export function _setGenerateTextForTests(fn: GenerateTextFn | null): void {
  generateTextImpl = fn ?? generateText;
}

const googleProvider = process.env.GEMINI_API_KEY
  ? createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

function toModelMessages(messages: LLMMessage[], includeAnthropicCache: boolean): ModelMessage[] {
  return messages.map((m) => {
    const part: Record<string, unknown> = { type: "text", text: m.content };
    if (m.cache && includeAnthropicCache) {
      part.providerOptions = { anthropic: { cacheControl: { type: "ephemeral" } } };
    }
    return { role: m.role, content: [part] } as ModelMessage;
  });
}

async function runGemini(args: CallLLMArgs): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}> {
  if (!googleProvider) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const modelId = GEMINI_MODELS[args.model];
  const result = await generateTextImpl({
    model: googleProvider(modelId) as LanguageModel,
    system: args.system,
    messages: toModelMessages(args.messages, false),
    maxOutputTokens: args.maxTokens,
    temperature: args.temperature,
  });
  return {
    text: result.text,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cachedTokens: result.usage.inputTokenDetails?.cacheReadTokens ?? 0,
  };
}

async function runGateway(args: CallLLMArgs): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}> {
  const modelId = MODELS[args.model];
  const result = await generateTextImpl({
    model: modelId as LanguageModel,
    system: args.system,
    messages: toModelMessages(args.messages, true),
    maxOutputTokens: args.maxTokens,
    temperature: args.temperature,
  });
  return {
    text: result.text,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cachedTokens: result.usage.inputTokenDetails?.cacheReadTokens ?? 0,
  };
}

export async function callLLM(args: CallLLMArgs): Promise<CallLLMResult> {
  const startedAt = Date.now();
  let provider: Provider;
  let attempt: { text: string; inputTokens: number; outputTokens: number; cachedTokens: number };

  if (googleProvider) {
    try {
      attempt = await runGemini(args);
      provider = "google";
    } catch (geminiErr) {
      console.warn(
        `[ai] Gemini failed for worker=${args.worker} tier=${args.model}; falling back to Gateway. Reason:`,
        geminiErr instanceof Error ? geminiErr.message : geminiErr,
      );
      attempt = await runGateway(args);
      provider = "anthropic";
    }
  } else {
    attempt = await runGateway(args);
    provider = "anthropic";
  }

  const durationMs = Date.now() - startedAt;
  const estimatedCostUsd = estimateCostUsd(
    provider,
    args.model,
    attempt.inputTokens,
    attempt.cachedTokens,
    attempt.outputTokens,
  );

  await prisma.lLMCall.create({
    data: {
      worker: args.worker,
      model: modelIdFor(provider, args.model),
      inputTokens: attempt.inputTokens,
      cachedTokens: attempt.cachedTokens,
      outputTokens: attempt.outputTokens,
      costUsd: estimatedCostUsd.toFixed(6),
      applicationId: args.applicationId ?? null,
      eventId: args.eventId ?? null,
      durationMs,
    },
  });

  return {
    text: attempt.text,
    usage: {
      inputTokens: attempt.inputTokens,
      outputTokens: attempt.outputTokens,
      cachedTokens: attempt.cachedTokens,
    },
    estimatedCostUsd,
    provider,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Structured-output path. Uses the provider's native schema-enforced JSON
// (Gemini responseSchema, Anthropic tool-use). The model literally cannot
// return malformed JSON — no parsing or repair required.
// ─────────────────────────────────────────────────────────────────────────

export type CallLLMObjectArgs<T> = {
  worker: string;
  model: ModelChoice;
  system?: string;
  messages: LLMMessage[];
  schema: ZodType<T>;
  schemaName?: string;
  schemaDescription?: string;
  maxTokens?: number;
  temperature?: number;
  applicationId?: string | null;
  eventId?: string | null;
};

export type CallLLMObjectResult<T> = {
  object: T;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  estimatedCostUsd: number;
  provider: Provider;
};

async function runGeminiObject<T>(args: CallLLMObjectArgs<T>): Promise<{
  object: T;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}> {
  if (!googleProvider) throw new Error("GEMINI_API_KEY is not configured");
  const modelId = GEMINI_MODELS[args.model];
  const result = await generateObject({
    model: googleProvider(modelId) as LanguageModel,
    system: args.system,
    messages: toModelMessages(args.messages, false),
    schema: args.schema,
    schemaName: args.schemaName,
    schemaDescription: args.schemaDescription,
    maxOutputTokens: args.maxTokens,
    temperature: args.temperature,
  });
  return {
    object: result.object,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cachedTokens: result.usage.inputTokenDetails?.cacheReadTokens ?? 0,
  };
}

async function runGatewayObject<T>(args: CallLLMObjectArgs<T>): Promise<{
  object: T;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}> {
  const modelId = MODELS[args.model];
  const result = await generateObject({
    model: modelId as LanguageModel,
    system: args.system,
    messages: toModelMessages(args.messages, true),
    schema: args.schema,
    schemaName: args.schemaName,
    schemaDescription: args.schemaDescription,
    maxOutputTokens: args.maxTokens,
    temperature: args.temperature,
  });
  return {
    object: result.object,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cachedTokens: result.usage.inputTokenDetails?.cacheReadTokens ?? 0,
  };
}

export async function callLLMObject<T>(
  args: CallLLMObjectArgs<T>,
): Promise<CallLLMObjectResult<T>> {
  const startedAt = Date.now();
  let provider: Provider;
  let attempt: { object: T; inputTokens: number; outputTokens: number; cachedTokens: number };

  if (googleProvider) {
    try {
      attempt = await runGeminiObject(args);
      provider = "google";
    } catch (geminiErr) {
      console.warn(
        `[ai] Gemini (structured) failed for worker=${args.worker} tier=${args.model}; falling back to Gateway. Reason:`,
        geminiErr instanceof Error ? geminiErr.message : geminiErr,
      );
      attempt = await runGatewayObject(args);
      provider = "anthropic";
    }
  } else {
    attempt = await runGatewayObject(args);
    provider = "anthropic";
  }

  const durationMs = Date.now() - startedAt;
  const estimatedCostUsd = estimateCostUsd(
    provider,
    args.model,
    attempt.inputTokens,
    attempt.cachedTokens,
    attempt.outputTokens,
  );

  await prisma.lLMCall.create({
    data: {
      worker: args.worker,
      model: modelIdFor(provider, args.model),
      inputTokens: attempt.inputTokens,
      cachedTokens: attempt.cachedTokens,
      outputTokens: attempt.outputTokens,
      costUsd: estimatedCostUsd.toFixed(6),
      applicationId: args.applicationId ?? null,
      eventId: args.eventId ?? null,
      durationMs,
    },
  });

  return {
    object: attempt.object,
    usage: {
      inputTokens: attempt.inputTokens,
      outputTokens: attempt.outputTokens,
      cachedTokens: attempt.cachedTokens,
    },
    estimatedCostUsd,
    provider,
  };
}
