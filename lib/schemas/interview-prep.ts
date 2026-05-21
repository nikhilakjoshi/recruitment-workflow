import { z } from "zod";

export const QUESTION_CATEGORIES = [
  "BEHAVIORAL",
  "TECHNICAL",
  "LEADERSHIP",
  "CASE",
  "CULTURE_FIT",
  "OTHER",
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const interviewPrepSchema = z.object({
  interviewType: z.string().min(1),
  expectedQuestions: z
    .array(
      z.object({
        category: z.enum(QUESTION_CATEGORIES),
        question: z.string().min(5),
        why: z.string().min(5),
        starPrompt: z.string().optional(),
      }),
    )
    .min(5)
    .max(20),
  starStories: z
    .array(
      z.object({
        label: z.string().min(3),
        situation: z.string().min(10),
        task: z.string().min(10),
        action: z.string().min(10),
        result: z.string().min(10),
        relevantTo: z.array(z.string()).default([]),
      }),
    )
    .min(3)
    .max(10),
  questionsToAsk: z.array(z.string().min(5)).min(3).max(7),
});

export type InterviewPrep = z.infer<typeof interviewPrepSchema>;
