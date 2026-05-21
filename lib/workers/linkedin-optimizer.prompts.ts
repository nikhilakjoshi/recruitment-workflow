export const SYSTEM_PROMPT = `
You are a LinkedIn profile optimizer for a senior technologist.
Given the candidate's Master CV, role preferences, and the text
they pasted from their current LinkedIn profile, produce concrete
rewrite suggestions for: headline, about section, and up to 8
experience-block improvements.

Stay grounded in evidence from the Master CV — never invent
qualifications. The candidate will manually paste these suggestions
into LinkedIn after reviewing them; treat your output as a draft.

Output ONLY the JSON object — no surrounding prose, no markdown
fences.
`.trim();

export const STRICT_REMINDER =
  "Output STRICT JSON only. No prose, no markdown fences.";

export type PromptInputs = {
  masterCv: string;
  rolePreferences: string;
  linkedinText: string;
};

export function buildCachedBlock(inputs: PromptInputs): string {
  return [
    "<role_preferences>",
    inputs.rolePreferences,
    "</role_preferences>",
    "",
    "<master_cv>",
    inputs.masterCv,
    "</master_cv>",
  ].join("\n");
}

export function buildUncachedBlock(inputs: PromptInputs): string {
  return [
    "<current_linkedin_text>",
    inputs.linkedinText,
    "</current_linkedin_text>",
    "",
    "<output_schema>",
    "{",
    '  "headline": { "current": string, "suggested": string, "rationale": string },',
    '  "about":    { "current": string, "suggested": string, "rationale": string },',
    '  "experienceImprovements": Array<{ "section": string, "current": string, "suggested": string, "rationale": string }> (<=8),',
    '  "keywordsToAdd": string[] (<=15)',
    "}",
    "</output_schema>",
    "",
    "Return JSON only.",
  ].join("\n");
}
