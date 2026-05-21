import { RemotePolicy } from "@prisma/client";
import { z } from "zod";

const REMOTE_POLICY_VALUES = Object.values(RemotePolicy) as [
  RemotePolicy,
  ...RemotePolicy[],
];

export const rolePreferenceSchema = z
  .object({
    targetRoles: z.array(z.string().min(1)).min(1, "Add at least one target role"),
    targetIndustries: z.array(z.string().min(1)),
    targetCompanies: z.array(z.string().min(1)),
    excludedCompanies: z.array(z.string().min(1)),
    compMin: z.number().int().nonnegative().nullable(),
    compMax: z.number().int().nonnegative().nullable(),
    compCurrency: z.string().min(3).max(3).default("USD"),
    geoLocations: z.array(z.string().min(1)).min(1, "Add at least one location"),
    remotePolicy: z.enum(REMOTE_POLICY_VALUES),
    workAuth: z.string().nullable(),
    careerGoals: z.string().nullable(),
  })
  .refine(
    (v) => v.compMin == null || v.compMax == null || v.compMin <= v.compMax,
    { message: "Min comp must be <= max comp", path: ["compMin"] },
  );

export type RolePreferenceInput = z.input<typeof rolePreferenceSchema>;
