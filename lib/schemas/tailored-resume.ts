import { z } from "zod";

export const RESUME_SECTION_TYPES = [
  "HEADER",
  "SUMMARY",
  "EXPERIENCE",
  "PROJECT",
  "EDUCATION",
  "SKILLS",
  "CERTIFICATION",
  "CUSTOM",
] as const;

export type ResumeSectionType = (typeof RESUME_SECTION_TYPES)[number];

export const resumeBulletSchema = z.object({
  text: z.string().min(5).max(500),
  rationale: z.string().min(0).max(300),
  evidenceFromMasterCV: z.string().min(0).max(300),
});

export type ResumeBullet = z.infer<typeof resumeBulletSchema>;

export const resumeSectionSchema = z.object({
  type: z.enum(RESUME_SECTION_TYPES),
  title: z.string().min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).optional(),
  bullets: z.array(resumeBulletSchema).max(15),
  order: z.number().int().nonnegative(),
});

export type ResumeSection = z.infer<typeof resumeSectionSchema>;

export const tailoredResumeSchema = z.object({
  candidateName: z.string().min(1),
  contactBlock: z.object({
    email: z.string(),
    phone: z.string().optional(),
    linkedinUrl: z.string().optional(),
    location: z.string().optional(),
  }),
  sections: z.array(resumeSectionSchema).min(2).max(10),
  overallRationale: z.string().min(50).max(2000),
});

export type TailoredResume = z.infer<typeof tailoredResumeSchema>;
