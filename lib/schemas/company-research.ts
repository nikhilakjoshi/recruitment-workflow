import { z } from "zod";

export const companyResearchSchema = z.object({
  businessModel: z.string().min(50).max(2000),
  recentNews: z
    .array(
      z.object({
        headline: z.string().min(1),
        summary: z.string().max(500),
        url: z.string().optional(),
        publishedDate: z.string().optional(),
      }),
    )
    .max(5),
  smartQuestions: z.array(z.string().min(20).max(300)).min(3).max(7),
  redFlags: z.array(z.string().max(300)).max(3),
});

export type CompanyResearch = z.infer<typeof companyResearchSchema>;
