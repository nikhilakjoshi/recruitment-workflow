import { generateText, type LanguageModel, type ModelMessage } from "ai";
import { prisma } from "@/lib/db";
import { estimateCostUsd, MODELS, type ModelChoice } from "./models";

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
};

type GenerateTextFn = typeof generateText;

let generateTextImpl: GenerateTextFn = generateText;

// Test-only injection of a mock generator. Used by ai/client.test.ts to avoid
// real HTTP calls to the Vercel AI Gateway during unit tests.
export function _setGenerateTextForTests(fn: GenerateTextFn | null): void {
  generateTextImpl = fn ?? generateText;
}

function toModelMessages(messages: LLMMessage[]): ModelMessage[] {
  return messages.map((m) => {
    const part: Record<string, unknown> = { type: "text", text: m.content };
    if (m.cache) {
      part.providerOptions = { anthropic: { cacheControl: { type: "ephemeral" } } };
    }
    return { role: m.role, content: [part] } as ModelMessage;
  });
}

export async function callLLM(args: CallLLMArgs): Promise<CallLLMResult> {
  const startedAt = Date.now();
  const modelId = MODELS[args.model];

  const result = await generateTextImpl({
    model: modelId as LanguageModel,
    system: args.system,
    messages: toModelMessages(args.messages),
    maxOutputTokens: args.maxTokens,
    temperature: args.temperature,
  });

  const durationMs = Date.now() - startedAt;
  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const cachedTokens = result.usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const estimatedCostUsd = estimateCostUsd(args.model, inputTokens, cachedTokens, outputTokens);

  await prisma.lLMCall.create({
    data: {
      worker: args.worker,
      model: modelId,
      inputTokens,
      cachedTokens,
      outputTokens,
      costUsd: estimatedCostUsd.toFixed(6),
      applicationId: args.applicationId ?? null,
      eventId: args.eventId ?? null,
      durationMs,
    },
  });

  return {
    text: result.text,
    usage: { inputTokens, outputTokens, cachedTokens },
    estimatedCostUsd,
  };
}
