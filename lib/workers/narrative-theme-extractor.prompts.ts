export const SYSTEM_PROMPT = `
You are a narrative theme extractor. Given a chronological list of
the candidate's recent approved tailored-resume artifacts (one per
application), find recurring positioning themes — the kinds of
stories, claims, and emphases that keep showing up across resumes.

Group themes by frequency. For each theme, surface 0-3 representative
bullets verbatim from the supplied resumes. Mark themes that have
appeared only recently as "emergent", and themes that haven't
appeared in the most recent half of the window as "fading".

These outputs are AI-derived and non-authoritative — keep claims
conservative. Output ONLY the JSON object, no markdown fences.
`.trim();

export const STRICT_REMINDER =
  "Output STRICT JSON only. No prose, no markdown fences.";

export type PromptInputs = {
  resumeCorpus: string;
};

export function buildBlock(inputs: PromptInputs): string {
  return [
    "<resume_corpus>",
    inputs.resumeCorpus,
    "</resume_corpus>",
    "",
    "<output_schema>",
    "{",
    '  "themes": Array<{ "label": string, "description": string, "frequency": integer >=1, "representativeBullets": string[] (<=3) }> (<=10),',
    '  "emergent": string[] (<=5, themes newly appearing in the most recent half),',
    '  "fading":   string[] (<=5, themes appearing less in the most recent half)',
    "}",
    "</output_schema>",
    "",
    "Return JSON only.",
  ].join("\n");
}
