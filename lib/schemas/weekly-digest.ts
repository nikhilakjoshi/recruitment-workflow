import { z } from "zod";

// Sonnet-generated narrative for the weekly digest. We keep highlights to
// a small fixed list so the Dashboard rendering is predictable.
export const weeklyDigestNarrativeSchema = z.object({
  paragraph: z.string().min(1).max(2_000),
  highlights: z.array(z.string().min(1).max(280)).min(1).max(5),
});

export type WeeklyDigestNarrative = z.infer<typeof weeklyDigestNarrativeSchema>;

// Full Insight.contentJson stored by the worker — combines deterministic
// counts with the LLM narrative.
export type WeeklyDigestContent = WeeklyDigestNarrative & {
  weekStart: string;
  weekEnd: string;
  counts: {
    opportunitiesDiscovered: number;
    opportunitiesRanked: number;
    applicationsByState: Record<string, number>;
    approvalsGranted: number;
    interviewsScheduled: number;
    offersReceived: number;
  };
  emailMessageId: string | null;
};
