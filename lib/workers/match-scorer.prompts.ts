export const SYSTEM_PROMPT = `
You are a hiring-fit evaluation assistant. Given a candidate's master
CV and a job description, return a JSON evaluation following the schema
provided. Be concrete, cite evidence from the CV when listing strengths,
and identify specific gaps where the JD's requirements are not met by
the CV. Do not invent qualifications the CV does not state. Output
ONLY the JSON object, no surrounding prose.
`.trim();

export const STRICT_REMINDER = "Output STRICT JSON only. No prose, no markdown fences.";

export type PromptInputs = {
  masterCv: string;
  rolePreferences: string;
  jobDescription: string;
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
    "<job_description>",
    inputs.jobDescription,
    "</job_description>",
    "",
    "<output_schema>",
    "{",
    '  "score": integer 0-100,',
    '  "fit": "STRONG" | "MARGINAL" | "WEAK",',
    '  "confidence": "LOW" | "MEDIUM" | "HIGH",',
    '  "strengths": string[]  // 1-8 items, each 5-600 chars',
    '  "gaps": string[]       // 0-8 items, each 5-600 chars',
    '  "rationale": string    // 50-4000 chars, one paragraph',
    "}",
    "</output_schema>",
    "",
    "Constraints:",
    "- Output ONLY the JSON object. No markdown fences, no prose before or after.",
    "- Keep each strength/gap bullet under 600 characters.",
    "- Keep rationale under 4000 characters.",
    "- All string fields must be plain UTF-8 with no control characters.",
  ].join("\n");
}
