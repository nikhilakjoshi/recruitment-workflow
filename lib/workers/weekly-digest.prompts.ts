export const SYSTEM_PROMPT = `You are the writer of a one-paragraph weekly digest for a single job seeker.
You receive a JSON object of activity counts for the past 7 days.
Return JSON: {"paragraph": "...", "highlights": ["...", "...", "..."]}.
- paragraph: 3-5 sentences, second person ("you"), neutral encouraging tone.
- highlights: 1-5 short bullet phrases, each <= 100 characters.
- JSON only. No markdown code fences.`;

export function buildUserMessage(counts: unknown): string {
  return `Activity for the past 7 days:\n${JSON.stringify(counts, null, 2)}\n\nWrite the digest.`;
}
