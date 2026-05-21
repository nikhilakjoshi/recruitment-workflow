import { OpportunitySource } from "@prisma/client";
import { z } from "zod";

const SOURCE_VALUES = Object.values(OpportunitySource) as [
  OpportunitySource,
  ...OpportunitySource[],
];

export const opportunityCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company is required"),
  sourceUrl: z
    .string()
    .url("Source URL must be a valid URL")
    .nullable()
    .or(z.literal("").transform(() => null))
    .optional(),
  sourcePlatform: z.enum(SOURCE_VALUES).default(OpportunitySource.MANUAL),
  jdText: z.string().min(50, "Job description must be at least 50 characters"),
});

export type OpportunityCreateInput = z.input<typeof opportunityCreateSchema>;
