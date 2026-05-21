import { z } from "zod";

export const narrativeThemesSchema = z.object({
  themes: z
    .array(
      z.object({
        label: z.string().min(3),
        description: z.string().min(10),
        frequency: z.number().int().min(1),
        representativeBullets: z.array(z.string()).max(3),
      }),
    )
    .max(10),
  emergent: z.array(z.string()).max(5),
  fading: z.array(z.string()).max(5),
});

export type NarrativeThemes = z.infer<typeof narrativeThemesSchema>;
