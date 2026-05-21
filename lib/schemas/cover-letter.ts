import { z } from "zod";

export const COVER_LETTER_PARAGRAPH_KINDS = [
  "OPENING",
  "WHY_ME",
  "WHY_YOU",
  "CLOSE",
] as const;

export type CoverLetterParagraphKind = (typeof COVER_LETTER_PARAGRAPH_KINDS)[number];

export const coverLetterParagraphSchema = z.object({
  kind: z.enum(COVER_LETTER_PARAGRAPH_KINDS),
  text: z.string().min(20).max(2000),
});

export type CoverLetterParagraph = z.infer<typeof coverLetterParagraphSchema>;

export const coverLetterSchema = z.object({
  recipient: z.object({
    name: z.string().optional(),
    company: z.string().min(1),
    address: z.string().optional(),
  }),
  paragraphs: z.array(coverLetterParagraphSchema).length(4),
  signoff: z.string().default("Sincerely,"),
  signature: z.string().min(1),
});

export type CoverLetter = z.infer<typeof coverLetterSchema>;
