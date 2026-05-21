import { ApplicationState } from "@prisma/client";

export const TRANSITIONS: Readonly<Record<ApplicationState, ReadonlyArray<ApplicationState>>> = {
  [ApplicationState.DISCOVERED]: [ApplicationState.SHORTLISTED, ApplicationState.ARCHIVED],
  [ApplicationState.SHORTLISTED]: [ApplicationState.EVALUATED, ApplicationState.ARCHIVED],
  [ApplicationState.EVALUATED]: [ApplicationState.TAILORING, ApplicationState.ARCHIVED],
  [ApplicationState.TAILORING]: [ApplicationState.APPROVED, ApplicationState.ARCHIVED],
  [ApplicationState.APPROVED]: [ApplicationState.SUBMITTED, ApplicationState.ARCHIVED],
  [ApplicationState.SUBMITTED]: [
    ApplicationState.RECRUITER_ENGAGED,
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  [ApplicationState.RECRUITER_ENGAGED]: [
    ApplicationState.INTERVIEWING,
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  [ApplicationState.INTERVIEWING]: [
    ApplicationState.NEGOTIATING,
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  [ApplicationState.NEGOTIATING]: [
    ApplicationState.ACCEPTED,
    ApplicationState.REJECTED,
    ApplicationState.ARCHIVED,
  ],
  [ApplicationState.REJECTED]: [ApplicationState.ARCHIVED],
  [ApplicationState.ACCEPTED]: [ApplicationState.ARCHIVED],
  [ApplicationState.ARCHIVED]: [],
};

export function canTransition(from: ApplicationState, to: ApplicationState): boolean {
  return TRANSITIONS[from].includes(to);
}
