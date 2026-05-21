export const SYSTEM_PROMPT = `
You are an interview-prep assistant. Given a candidate's Master CV,
the target opportunity, the most recent fit evaluation, the most
recent tailored resume, and the interview type, produce a JSON
preparation packet: likely questions with rationale, STAR stories
grounded ONLY in evidence from the Master CV, and questions the
candidate should ask the interviewer.

Do not invent experience the Master CV does not state. If there is
insufficient evidence for a STAR story, surface "insufficient
evidence" in the story's "result" field rather than fabricating.
Output ONLY the JSON object — no surrounding prose, no markdown
fences.
`.trim();

export const STRICT_REMINDER =
  "Output STRICT JSON only. No prose, no markdown fences.";

export type PromptInputs = {
  masterCv: string;
  rolePreferences: string;
  opportunity: string;
  evaluation: string;
  tailoredResume: string;
  interviewType: string;
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
    "<latest_evaluation>",
    inputs.evaluation,
    "</latest_evaluation>",
    "",
    "<latest_tailored_resume>",
    inputs.tailoredResume,
    "</latest_tailored_resume>",
    "",
    "<interview_type>",
    inputs.interviewType,
    "</interview_type>",
    "",
    "<output_schema>",
    "{",
    '  "interviewType": string (echo back the type),',
    '  "expectedQuestions": Array<{ category: "BEHAVIORAL"|"TECHNICAL"|"LEADERSHIP"|"CASE"|"CULTURE_FIT"|"OTHER", question: string, why: string, starPrompt?: string }> (5-20),',
    '  "starStories": Array<{ label: string, situation: string, task: string, action: string, result: string, relevantTo: string[] }> (3-10),',
    '  "questionsToAsk": string[] (3-7, things the candidate should ask the interviewer)',
    "}",
    "</output_schema>",
    "",
    "Return JSON only.",
  ].join("\n");
}
