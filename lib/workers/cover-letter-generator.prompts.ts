export const SYSTEM_PROMPT = `
You are a cover-letter writer. Given a candidate's Master CV, role
preferences, target job, evaluation, and the approved tailored resume,
produce a 4-paragraph cover letter (Opening, Why Me, Why You, Close).

CONSTRAINTS:
- Each paragraph 100-250 words.
- Reference 2-3 specific points from the tailored resume.
- Connect strengths to the JD's requirements.
- Acknowledge one stretch (from the evaluation's gaps) honestly and
  frame growth orientation.
- No cliches ("I am passionate about..."). Specific, evidence-based.
- Output ONLY the JSON object matching the schema. No surrounding prose.
`.trim();

export const STRICT_REMINDER = "Output STRICT JSON only. No prose, no markdown fences.";

export type PromptInputs = {
  masterCv: string;
  rolePreferences: string;
  opportunity: string;
  evaluation: string;
  tailoredResume: string;
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
    "<opportunity>",
    inputs.opportunity,
    "</opportunity>",
    "",
    "<evaluation>",
    inputs.evaluation,
    "</evaluation>",
    "",
    "<tailored_resume>",
    inputs.tailoredResume,
    "</tailored_resume>",
    "",
    "<output_schema>",
    "{",
    '  "recipient": { "name"?: string, "company": string, "address"?: string },',
    '  "paragraphs": [',
    '    { "kind": "OPENING",  "text": string },',
    '    { "kind": "WHY_ME",   "text": string },',
    '    { "kind": "WHY_YOU",  "text": string },',
    '    { "kind": "CLOSE",    "text": string }',
    "  ],",
    '  "signoff": string,',
    '  "signature": string',
    "}",
    "</output_schema>",
    "",
    "Return JSON only.",
  ].join("\n");
}
