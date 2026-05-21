import { z } from "zod";

// One entry in the batch rank response from the Job Alert Aggregator's
// Haiku call. `id` is the Opportunity row id we passed in; the worker
// matches responses back by id.
export const opportunityRankSchema = z.object({
  id: z.string().min(1),
  rankScore: z.number().int().min(0).max(100),
  rankReason: z.string().min(1).max(500),
});

export const opportunityRankBatchSchema = z.object({
  rankings: z.array(opportunityRankSchema),
});

export type OpportunityRank = z.infer<typeof opportunityRankSchema>;
export type OpportunityRankBatch = z.infer<typeof opportunityRankBatchSchema>;
