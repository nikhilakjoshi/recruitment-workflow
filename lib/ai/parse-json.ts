import { jsonrepair } from "jsonrepair";

function tryParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    // jsonrepair handles unescaped newlines, trailing commas, single quotes, etc.
    try {
      return JSON.parse(jsonrepair(s));
    } catch {
      return null;
    }
  }
}

export function parseLLMJson(text: string): unknown {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    const parsed = tryParse(fenced[1]);
    if (parsed !== null) return parsed;
  }

  const direct = tryParse(trimmed);
  if (direct !== null) return direct;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = tryParse(trimmed.slice(firstBrace, lastBrace + 1));
    if (sliced !== null) return sliced;
  }

  return null;
}
