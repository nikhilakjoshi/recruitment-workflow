import { ApplicationState, type Application } from "@prisma/client";

export type RoleFamilyConversionRow = {
  roleFamily: string;
  total: number;
  offered: number;
  conversionPct: number;
};

const OFFERED_STATES: ApplicationState[] = [
  ApplicationState.NEGOTIATING,
  ApplicationState.ACCEPTED,
];

function pickRoleFamily(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return "(unspecified)";
  const obj = snapshot as Record<string, unknown>;
  const roles = obj.targetRoles;
  if (Array.isArray(roles) && roles.length > 0 && typeof roles[0] === "string") {
    return roles[0].trim() || "(unspecified)";
  }
  return "(unspecified)";
}

export function computeRoleFamilyConversion(
  applications: Pick<Application, "state" | "targetRoleSnapshot">[],
): RoleFamilyConversionRow[] {
  const acc = new Map<string, { total: number; offered: number }>();
  for (const app of applications) {
    const family = pickRoleFamily(app.targetRoleSnapshot);
    const row = acc.get(family) ?? { total: 0, offered: 0 };
    row.total += 1;
    if (OFFERED_STATES.includes(app.state)) row.offered += 1;
    acc.set(family, row);
  }
  return Array.from(acc.entries())
    .map(([roleFamily, v]) => ({
      roleFamily,
      total: v.total,
      offered: v.offered,
      conversionPct: v.total > 0 ? Math.round((v.offered / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
