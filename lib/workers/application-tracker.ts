import { ApplicationState, EventType, type Application } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import type { ScheduledWorker } from "./types";

// Pinned per /home/agent/.plans/07-tracker-aggregator.md:
//   if Application.updatedAt is older than this many days for the given
//   state, the Tracker schedules a follow-up.
export const STALE_THRESHOLDS_DAYS: Partial<Record<ApplicationState, number>> = {
  [ApplicationState.SHORTLISTED]: 7,
  [ApplicationState.EVALUATED]: 3,
  [ApplicationState.APPROVED]: 2,
  [ApplicationState.SUBMITTED]: 14,
  [ApplicationState.RECRUITER_ENGAGED]: 10,
  [ApplicationState.INTERVIEWING]: 14,
  [ApplicationState.NEGOTIATING]: 7,
};

export const NEXT_ACTIONS: Partial<Record<ApplicationState, string>> = {
  [ApplicationState.SHORTLISTED]: "Review evaluation, decide to tailor or archive",
  [ApplicationState.EVALUATED]: "Tailor the resume or archive",
  [ApplicationState.APPROVED]: "Submit externally",
  [ApplicationState.SUBMITTED]: "Follow up with recruiter or archive",
  [ApplicationState.RECRUITER_ENGAGED]: "Prepare for interview or follow up",
  [ApplicationState.INTERVIEWING]: "Follow up",
  [ApplicationState.NEGOTIATING]: "Accept or reject",
};

export type StaleDetection = {
  application: Application;
  daysSinceLastActivity: number;
  nextAction: string;
};

export function isStale(application: Application, now: Date): StaleDetection | null {
  const threshold = STALE_THRESHOLDS_DAYS[application.state];
  if (threshold === undefined) return null;
  const ageMs = now.getTime() - application.updatedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < threshold) return null;
  const nextAction = NEXT_ACTIONS[application.state] ?? "Take action";
  return {
    application,
    daysSinceLastActivity: Math.floor(ageDays),
    nextAction,
  };
}

export type TrackerOutput = {
  scanned: number;
  followUpsCreated: number;
};

export const applicationTrackerWorker: ScheduledWorker<TrackerOutput> = {
  name: "application-tracker",
  schedule: "0 9 * * *",
  runtime: "always-on",
  model: "cheap",
  timeoutMs: 60_000,
  async run(ctx) {
    const now = ctx.runAt;
    const applications = await prisma.application.findMany({
      where: { candidateId: ctx.candidate.id },
    });

    let followUpsCreated = 0;
    for (const app of applications) {
      const stale = isStale(app, now);
      if (!stale) continue;

      // Idempotency: skip if there is already an unacknowledged FollowUp
      // for this application.
      const existing = await prisma.followUp.findFirst({
        where: { applicationId: app.id, acknowledged: false },
      });
      if (existing) continue;

      const reason = `${app.state} for ${stale.daysSinceLastActivity}d (threshold ${STALE_THRESHOLDS_DAYS[app.state]}d)`;
      await prisma.followUp.create({
        data: {
          applicationId: app.id,
          reason,
          suggestedAction: stale.nextAction,
        },
      });
      await emitEvent({
        type: EventType.FOLLOW_UP_SCHEDULED,
        candidateId: ctx.candidate.id,
        applicationId: app.id,
        payload: {
          daysSinceLastActivity: stale.daysSinceLastActivity,
          nextAction: stale.nextAction,
          fromState: app.state,
        },
        emittedBy: "application-tracker",
      });
      followUpsCreated += 1;
    }

    return {
      output: { scanned: applications.length, followUpsCreated },
    };
  },
};
