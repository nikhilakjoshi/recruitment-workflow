export const SYSTEM_PROMPT = `
You are a resume tailoring assistant. Given a candidate's Master CV,
their role preferences, the target job description, and an evaluation
(score + strengths + gaps), produce a tailored resume in the schema
provided.

CONSTRAINTS:
- DO NOT invent qualifications. Only use facts from the Master CV.
- Prioritize bullets that address the JD's stated requirements and the
  evaluation's identified gaps where the CV has supporting evidence.
- Each bullet should have a "rationale" (why included) and, where
  applicable, "evidenceFromMasterCV" (a short quote from the CV).
- Keep bullets concise (<= 30 words). Use STAR-aware phrasing where
  natural.
- 3-6 sections total. A HEADER section MUST come first.
- Output ONLY the JSON object matching the schema. No surrounding prose.
`.trim();

export const STRICT_REMINDER = "Output STRICT JSON only. No prose, no markdown fences.";

export type PromptInputs = {
  masterCv: string;
  rolePreferences: string;
  opportunity: string;
  evaluation: string;
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
    "<output_schema>",
    "{",
    '  "candidateName": string,',
    '  "contactBlock": {',
    '    "email": string,',
    '    "phone"?: string,',
    '    "linkedinUrl"?: string,',
    '    "location"?: string',
    "  },",
    '  "sections": Array<{',
    '    "type": "HEADER" | "SUMMARY" | "EXPERIENCE" | "PROJECT" | "EDUCATION" | "SKILLS" | "CERTIFICATION" | "CUSTOM",',
    '    "title": string,',
    '    "metadata"?: Record<string, unknown>,',
    '    "bullets": Array<{ "text": string, "rationale": string, "evidenceFromMasterCV": string }>,',
    '    "order": number',
    "  }>,",
    '  "overallRationale": string',
    "}",
    "</output_schema>",
    "",
    "Return JSON only.",
  ].join("\n");
}
