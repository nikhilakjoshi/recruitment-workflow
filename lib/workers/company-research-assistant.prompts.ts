export const SYSTEM_PROMPT = `
You are a company-research assistant for an interview-prep workflow.
Given a candidate's role preferences, the target opportunity, and a
short list of recent search results about the company, produce a
JSON object summarizing the company's business model, the most
notable recent news items, smart questions the candidate could ask,
and any red flags surfaced by the search results.

Do not invent news that is not present in the supplied search results.
If a fact is uncertain, omit it. Output ONLY the JSON object — no
surrounding prose, no markdown fences.
`.trim();

export const STRICT_REMINDER =
  "Output STRICT JSON only. No prose, no markdown fences.";

export type PromptInputs = {
  rolePreferences: string;
  opportunity: string;
  searchResults: string;
};

export function buildCachedBlock(inputs: PromptInputs): string {
  return [
    "<role_preferences>",
    inputs.rolePreferences,
    "</role_preferences>",
    "",
    "<opportunity>",
    inputs.opportunity,
    "</opportunity>",
  ].join("\n");
}

export function buildUncachedBlock(inputs: PromptInputs): string {
  return [
    "<recent_search_results>",
    inputs.searchResults,
    "</recent_search_results>",
    "",
    "<output_schema>",
    "{",
    '  "businessModel": string (50-2000 chars; how this company makes money + who it serves),',
    '  "recentNews": Array<{ headline: string, summary: string (<=500), url?: string, publishedDate?: string }> (<=5),',
    '  "smartQuestions": string[] (3-7, each 20-300 chars; questions the candidate could ask),',
    '  "redFlags": string[] (0-3, each <=300; surfaced by the news)',
    "}",
    "</output_schema>",
    "",
    "Return JSON only.",
  ].join("\n");
}
