import { ArtifactState, type Artifact } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { eventForApproval, eventForRejection } from "./approval-events";

type ActorContext = {
  actor: "system" | "user" | string;
};

type RequireReviewArgs = ActorContext & {
  artifactId: string;
};

type ApproveArgs = ActorContext & {
  artifactId: string;
};

type RejectArgs = ActorContext & {
  artifactId: string;
  reason?: string;
};

type EditArgs = ActorContext & {
  artifactId: string;
  contentText: string;
};

async function loadArtifactWithApp(artifactId: string) {
  return prisma.artifact.findUniqueOrThrow({
    where: { id: artifactId },
    include: { application: { select: { candidateId: true } } },
  });
}

export async function requireReview(args: RequireReviewArgs): Promise<Artifact> {
  const current = await loadArtifactWithApp(args.artifactId);
  if (current.state !== ArtifactState.DRAFT) {
    throw new Error(
      `Artifact ${args.artifactId} is in state ${current.state}; expected DRAFT to move to PENDING_REVIEW`,
    );
  }
  return prisma.artifact.update({
    where: { id: args.artifactId },
    data: { state: ArtifactState.PENDING_REVIEW },
  });
}

export async function approveArtifact(args: ApproveArgs): Promise<Artifact> {
  const current = await loadArtifactWithApp(args.artifactId);
  if (
    current.state !== ArtifactState.DRAFT &&
    current.state !== ArtifactState.PENDING_REVIEW
  ) {
    throw new Error(
      `Artifact ${args.artifactId} is in state ${current.state}; cannot approve`,
    );
  }
  const updated = await prisma.artifact.update({
    where: { id: args.artifactId },
    data: {
      state: ArtifactState.APPROVED,
      approvedAt: new Date(),
    },
  });

  const eventType = eventForApproval(current.type);
  if (eventType) {
    await emitEvent({
      type: eventType,
      candidateId: current.application.candidateId,
      applicationId: current.applicationId,
      payload: {
        artifactId: current.id,
        artifactType: current.type,
        versionNumber: current.versionNumber,
        actor: args.actor,
      },
      emittedBy: args.actor,
    });
  }

  return updated;
}

export async function rejectArtifact(args: RejectArgs): Promise<Artifact> {
  const current = await loadArtifactWithApp(args.artifactId);
  if (
    current.state !== ArtifactState.DRAFT &&
    current.state !== ArtifactState.PENDING_REVIEW
  ) {
    throw new Error(
      `Artifact ${args.artifactId} is in state ${current.state}; cannot reject`,
    );
  }
  const updated = await prisma.artifact.update({
    where: { id: args.artifactId },
    data: { state: ArtifactState.REJECTED },
  });

  const eventType = eventForRejection(current.type);
  if (eventType) {
    await emitEvent({
      type: eventType,
      candidateId: current.application.candidateId,
      applicationId: current.applicationId,
      payload: {
        artifactId: current.id,
        artifactType: current.type,
        versionNumber: current.versionNumber,
        actor: args.actor,
        reason: args.reason ?? null,
      },
      emittedBy: args.actor,
    });
  }

  return updated;
}

export async function editArtifact(args: EditArgs): Promise<Artifact> {
  const current = await loadArtifactWithApp(args.artifactId);
  const next = await prisma.artifact.create({
    data: {
      applicationId: current.applicationId,
      type: current.type,
      state: ArtifactState.DRAFT,
      contentJson: current.contentJson ?? {},
      contentText: args.contentText,
      versionNumber: current.versionNumber + 1,
      parentVersionId: current.id,
      generatedByWorker: "manual-edit",
      generationContext: { editedBy: args.actor },
    },
  });

  await emitEvent({
    type: "ARTIFACT_EDITED",
    candidateId: current.application.candidateId,
    applicationId: current.applicationId,
    payload: {
      artifactId: next.id,
      artifactType: next.type,
      parentVersionId: current.id,
      versionNumber: next.versionNumber,
      actor: args.actor,
    },
    emittedBy: args.actor,
  });

  return next;
}
