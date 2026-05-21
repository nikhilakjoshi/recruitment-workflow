import { ApplicationState, type Application } from "@prisma/client";

export const FUNNEL_STAGES = [
  "DISCOVERED",
  "SHORTLISTED",
  "SUBMITTED",
  "INTERVIEWING",
  "OFFERED",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type FunnelStageCount = {
  stage: FunnelStage;
  count: number;
  conversionFromPrev: number | null;
};

const REACHED_BY_STAGE: Record<FunnelStage, ApplicationState[]> = {
  DISCOVERED: [
    ApplicationState.DISCOVERED,
    ApplicationState.SHORTLISTED,
    ApplicationState.EVALUATED,
    ApplicationState.TAILORING,
    ApplicationState.APPROVED,
    ApplicationState.SUBMITTED,
    ApplicationState.RECRUITER_ENGAGED,
    ApplicationState.INTERVIEWING,
    ApplicationState.NEGOTIATING,
    ApplicationState.ACCEPTED,
    // Rejected & archived applications were still discovered.
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  SHORTLISTED: [
    ApplicationState.SHORTLISTED,
    ApplicationState.EVALUATED,
    ApplicationState.TAILORING,
    ApplicationState.APPROVED,
    ApplicationState.SUBMITTED,
    ApplicationState.RECRUITER_ENGAGED,
    ApplicationState.INTERVIEWING,
    ApplicationState.NEGOTIATING,
    ApplicationState.ACCEPTED,
  ],
  SUBMITTED: [
    ApplicationState.SUBMITTED,
    ApplicationState.RECRUITER_ENGAGED,
    ApplicationState.INTERVIEWING,
    ApplicationState.NEGOTIATING,
    ApplicationState.ACCEPTED,
  ],
  INTERVIEWING: [
    ApplicationState.INTERVIEWING,
    ApplicationState.NEGOTIATING,
    ApplicationState.ACCEPTED,
  ],
  OFFERED: [ApplicationState.NEGOTIATING, ApplicationState.ACCEPTED],
};

export function computeFunnel(
  applications: Pick<Application, "state" | "shortlistedAt" | "submittedAt">[],
): FunnelStageCount[] {
  const counts: Record<FunnelStage, number> = {
    DISCOVERED: 0,
    SHORTLISTED: 0,
    SUBMITTED: 0,
    INTERVIEWING: 0,
    OFFERED: 0,
  };
  for (const app of applications) {
    for (const stage of FUNNEL_STAGES) {
      if (REACHED_BY_STAGE[stage].includes(app.state)) {
        counts[stage] += 1;
      }
    }
  }

  return FUNNEL_STAGES.map((stage, i) => {
    const count = counts[stage];
    const prev = i > 0 ? counts[FUNNEL_STAGES[i - 1]] : null;
    return { stage, count, conversionFromPrev: pctFromPrev(count, prev) };
  });
}

function pctFromPrev(count: number, prev: number | null): number | null {
  if (prev === null) return null;
  if (prev === 0) return 0;
  return Math.round((count / prev) * 100);
}
