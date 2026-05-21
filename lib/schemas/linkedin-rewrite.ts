import { z } from "zod";

const rewriteBlock = z.object({
  current: z.string(),
  suggested: z.string().min(1),
  rationale: z.string().min(10),
});

export const linkedinRewriteSchema = z.object({
  headline: rewriteBlock,
  about: rewriteBlock,
  experienceImprovements: z
    .array(
      z.object({
        section: z.string().min(1),
        current: z.string(),
        suggested: z.string().min(1),
        rationale: z.string().min(10),
      }),
    )
    .max(8),
  keywordsToAdd: z.array(z.string().min(1)).max(15),
});

export type LinkedInRewrite = z.infer<typeof linkedinRewriteSchema>;
