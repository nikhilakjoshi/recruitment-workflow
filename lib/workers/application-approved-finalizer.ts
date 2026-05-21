import {
  ApplicationState,
  ArtifactState,
  ArtifactType,
  EventType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { transition } from "@/lib/state-machine/application";
import { canTransition } from "@/lib/state-machine/transitions-table";
import type { Worker } from "./types";
import { EMPTY_SCOPE } from "./types";

export type ApplicationApprovedFinalizerOutput = {
  transitioned: boolean;
  reason?: string;
};

export const applicationApprovedFinalizerWorker: Worker<
  unknown,
  ApplicationApprovedFinalizerOutput
> = {
  name: "application-approved-finalizer",
  runtime: "per-application",
  scope: EMPTY_SCOPE,
  model: "cheap",
  subscribes: [EventType.COVER_LETTER_APPROVED],
  async run(ctx) {
    const applicationId = ctx.event.applicationId;
    if (!applicationId) {
      return { output: { transitioned: false, reason: "no_application_id" } };
    }
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      return { output: { transitioned: false, reason: "application_not_found" } };
    }

    const [latestResume, latestLetter] = await Promise.all([
      prisma.artifact.findFirst({
        where: { applicationId, type: ArtifactType.TAILORED_RESUME },
        orderBy: { versionNumber: "desc" },
      }),
      prisma.artifact.findFirst({
        where: { applicationId, type: ArtifactType.COVER_LETTER },
        orderBy: { versionNumber: "desc" },
      }),
    ]);

    if (latestResume?.state !== ArtifactState.APPROVED) {
      return { output: { transitioned: false, reason: "resume_not_approved" } };
    }
    if (latestLetter?.state !== ArtifactState.APPROVED) {
      return { output: { transitioned: false, reason: "letter_not_approved" } };
    }

    if (application.state === ApplicationState.APPROVED) {
      return { output: { transitioned: false, reason: "already_approved" } };
    }
    if (!canTransition(application.state, ApplicationState.APPROVED)) {
      return {
        output: {
          transitioned: false,
          reason: `cannot_transition_from_${application.state}`,
        },
      };
    }

    await transition(applicationId, ApplicationState.APPROVED, {
      actor: "application-approved-finalizer",
      reason: "Both tailored resume and cover letter approved",
    });

    return { output: { transitioned: true } };
  },
};
