import { z } from "zod";

export const FIT_VALUES = ["STRONG", "MARGINAL", "WEAK"] as const;
export const CONFIDENCE_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;

export type Fit = (typeof FIT_VALUES)[number];
export type Confidence = (typeof CONFIDENCE_VALUES)[number];

export const evaluationSchema = z.object({
  score: z.number().int().min(0).max(100),
  fit: z.enum(FIT_VALUES),
  confidence: z.enum(CONFIDENCE_VALUES),
  strengths: z.array(z.string().min(5).max(300)).min(1).max(8),
  gaps: z.array(z.string().min(5).max(300)).max(8),
  rationale: z.string().min(50).max(1500),
});

export type Evaluation = z.infer<typeof evaluationSchema>;

export function fitFromScore(score: number): Fit {
  if (score >= 75) return "STRONG";
  if (score >= 50) return "MARGINAL";
  return "WEAK";
}
