import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { _setGenerateTextForTests, callLLM } from "./client";
import { estimateCostUsd, MODELS } from "./models";

type GeneratePayload = Parameters<typeof callLLM>[0];

let received: { args: unknown } | null = null;

const fakeGenerate = vi.fn(async (args: unknown) => {
  received = { args };
  return {
    text: "ok",
    usage: {
      inputTokens: 1000,
      outputTokens: 200,
      inputTokenDetails: { cacheReadTokens: 600, noCacheTokens: 400, cacheWriteTokens: 0 },
      outputTokenDetails: { textTokens: 200, reasoningTokens: 0 },
      totalTokens: 1200,
    },
  };
});

beforeAll(() => {
  _setGenerateTextForTests(
    fakeGenerate as unknown as Parameters<typeof _setGenerateTextForTests>[0],
  );
});

beforeEach(async () => {
  await prisma.lLMCall.deleteMany({});
  received = null;
  fakeGenerate.mockClear();
});

afterEach(async () => {
  await prisma.lLMCall.deleteMany({});
});

afterAll(async () => {
  _setGenerateTextForTests(null);
  await prisma.$disconnect();
});

describe("callLLM", () => {
  it("routes the requested ModelChoice through the gateway model id", async () => {
    const args: GeneratePayload = {
      worker: "match-scorer",
      model: "standard",
      system: "You are helpful.",
      messages: [{ role: "user", content: "hi" }],
    };
    await callLLM(args);

    expect(fakeGenerate).toHaveBeenCalledTimes(1);
    const passed = received?.args as { model: string };
    expect(passed.model).toBe(MODELS.standard);
  });

  it("attaches ephemeral cacheControl to messages flagged cache:true", async () => {
    await callLLM({
      worker: "resume-builder",
      model: "heavy",
      system: "...",
      messages: [
        { role: "user", content: "Master CV body", cache: true },
        { role: "user", content: "Tailor to JD" },
      ],
    });

    const passed = received?.args as {
      messages: Array<{ content: Array<{ providerOptions?: { anthropic?: unknown } }> }>;
    };
    expect(passed.messages[0].content[0].providerOptions).toMatchObject({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
    expect(passed.messages[1].content[0].providerOptions).toBeUndefined();
  });

  it("writes an LLMCall row with token counts and cost in USD", async () => {
    await callLLM({
      worker: "match-scorer",
      model: "standard",
      messages: [{ role: "user", content: "hi" }],
      applicationId: null,
    });

    const rows = await prisma.lLMCall.findMany();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.worker).toBe("match-scorer");
    expect(row.model).toBe(MODELS.standard);
    expect(row.inputTokens).toBe(1000);
    expect(row.cachedTokens).toBe(600);
    expect(row.outputTokens).toBe(200);

    const expectedCost = estimateCostUsd("anthropic", "standard", 1000, 600, 200);
    expect(Number(row.costUsd)).toBeCloseTo(expectedCost, 6);
    expect(row.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns text, usage breakdown, and estimatedCostUsd", async () => {
    const result = await callLLM({
      worker: "echo",
      model: "cheap",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("ok");
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 200, cachedTokens: 600 });
    expect(result.estimatedCostUsd).toBe(estimateCostUsd("anthropic", "cheap", 1000, 600, 200));
  });
});
