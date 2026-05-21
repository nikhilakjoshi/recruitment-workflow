import { ApplicationState, EventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import type { Worker } from "./types";

export type ApplicationCreatorInput = {
  opportunityId?: unknown;
};

export type ApplicationCreatorOutput = {
  applicationId: string;
  created: boolean;
};

function extractOpportunityId(input: unknown): string {
  if (
    typeof input === "object" &&
    input !== null &&
    "opportunityId" in input &&
    typeof (input as { opportunityId?: unknown }).opportunityId === "string"
  ) {
    return (input as { opportunityId: string }).opportunityId;
  }
  throw new Error("application-creator: payload missing string opportunityId");
}

export const applicationCreatorWorker: Worker<
  ApplicationCreatorInput,
  ApplicationCreatorOutput
> = {
  name: "application-creator",
  scope: "per-application",
  model: "cheap",
  subscribes: [EventType.JOB_SHORTLISTED],
  async run(ctx) {
    const opportunityId = extractOpportunityId(ctx.event.payloadJson);

    const existing = await prisma.application.findUnique({
      where: {
        candidateId_opportunityId: {
          candidateId: ctx.candidate.id,
          opportunityId,
        },
      },
    });
    if (existing) {
      return {
        output: { applicationId: existing.id, created: false },
      };
    }

    const rolePreference = await prisma.rolePreference.findUnique({
      where: { candidateId: ctx.candidate.id },
    });
    const snapshot = rolePreference
      ? {
          targetRoles: rolePreference.targetRoles,
          targetIndustries: rolePreference.targetIndustries,
          targetCompanies: rolePreference.targetCompanies,
          excludedCompanies: rolePreference.excludedCompanies,
          compMin: rolePreference.compMin,
          compMax: rolePreference.compMax,
          compCurrency: rolePreference.compCurrency,
          geoLocations: rolePreference.geoLocations,
          remotePolicy: rolePreference.remotePolicy,
          workAuth: rolePreference.workAuth,
          careerGoals: rolePreference.careerGoals,
        }
      : {};

    const application = await prisma.application.create({
      data: {
        candidateId: ctx.candidate.id,
        opportunityId,
        state: ApplicationState.SHORTLISTED,
        targetRoleSnapshot: snapshot,
        shortlistedAt: new Date(),
      },
    });

    await emitEvent({
      type: EventType.APPLICATION_CREATED,
      candidateId: ctx.candidate.id,
      applicationId: application.id,
      payload: {
        applicationId: application.id,
        opportunityId,
        triggeredByEventId: ctx.event.id,
      },
      emittedBy: "application-creator",
    });

    return {
      output: { applicationId: application.id, created: true },
    };
  },
};
