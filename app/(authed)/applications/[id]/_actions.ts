"use server";

import { revalidatePath } from "next/cache";
import { ApplicationState, ArtifactState, ArtifactType, EventType, type Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { transition } from "@/lib/state-machine/application";
import { InvalidTransitionError } from "@/lib/state-machine/errors";
import {
  approveArtifact,
  editArtifact,
  rejectArtifact,
  requireReview,
} from "@/lib/artifacts/transitions";
import { dispatchOnce } from "@/lib/workers/dispatch";
import { renderResumeToPDF, renderCoverLetterToPDF } from "@/lib/pdf/render";
import { getSignedReadUrl, uploadGeneratedArtifactPdf } from "@/lib/storage";
import { tailoredResumeSchema, type ResumeBullet, type TailoredResume } from "@/lib/schemas/tailored-resume";
import { coverLetterSchema, type CoverLetter } from "@/lib/schemas/cover-letter";
import { callLLM } from "@/lib/ai/client";
import "@/lib/workers";

export type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function requireOwner(applicationId: string): Promise<string | null> {
  const session = await getSession();
  if (!session.userId) return "Unauthorized";
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidate: { select: { userId: true } } },
  });
  if (!app || app.candidate.userId !== session.userId) {
    return "Application not found";
  }
  return null;
}

export async function transitionApplicationAction(
  applicationId: string,
  next: ApplicationState,
): Promise<ActionResult<{ state: ApplicationState }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };

  try {
    const updated = await transition(applicationId, next, { actor: "user" });
    revalidatePath(`/applications/${applicationId}`);
    revalidatePath("/applications");
    return { ok: true, value: { state: updated.state } };
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Transition failed" };
  }
}

export async function requireReviewAction(
  artifactId: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Unauthorized" };
  try {
    await requireReview({ artifactId, actor: "user" });
    return { ok: true, value: { artifactId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function approveArtifactAction(
  artifactId: string,
  applicationId: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  try {
    await approveArtifact({ artifactId, actor: "user" });
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, value: { artifactId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Approve failed" };
  }
}

export async function rejectArtifactAction(
  artifactId: string,
  applicationId: string,
  reason?: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  try {
    await rejectArtifact({ artifactId, actor: "user", reason });
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, value: { artifactId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reject failed" };
  }
}

export async function regenerateEvaluationAction(
  applicationId: string,
): Promise<ActionResult<{ requested: true }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };

  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { candidateId: true },
  });
  await emitEvent({
    type: EventType.EVALUATION_REGENERATION_REQUESTED,
    candidateId: app.candidateId,
    applicationId,
    payload: { reason: "manual" },
    emittedBy: "user",
  });
  await dispatchOnce();
  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, value: { requested: true } };
}

export async function editArtifactAction(
  artifactId: string,
  applicationId: string,
  contentText: string,
): Promise<ActionResult<{ artifactId: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  try {
    const next = await editArtifact({ artifactId, actor: "user", contentText });
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, value: { artifactId: next.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Edit failed" };
  }
}

export async function regenerateResumeAction(
  applicationId: string,
): Promise<ActionResult<{ requested: true }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { candidateId: true },
  });
  await emitEvent({
    type: EventType.TAILORED_RESUME_REGENERATION_REQUESTED,
    candidateId: app.candidateId,
    applicationId,
    payload: { reason: "manual" },
    emittedBy: "user",
  });
  await dispatchOnce();
  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, value: { requested: true } };
}

export async function regenerateCoverLetterAction(
  applicationId: string,
): Promise<ActionResult<{ requested: true }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: { candidateId: true },
  });
  await emitEvent({
    type: EventType.COVER_LETTER_REGENERATION_REQUESTED,
    candidateId: app.candidateId,
    applicationId,
    payload: { reason: "manual" },
    emittedBy: "user",
  });
  await dispatchOnce();
  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, value: { requested: true } };
}

const REWRITE_SYSTEM_PROMPT =
  "You are a resume bullet editor. Rewrite the bullet below so it is sharper, " +
  "tightens to the JD's stated requirements, stays under 30 words, and never " +
  "invents qualifications beyond the candidate's evidence. Output ONLY the new " +
  "bullet text, no quotes, no prose.";

export async function rewriteBulletAction(
  applicationId: string,
  _sectionIndex: number,
  _bulletIndex: number,
  bullet: ResumeBullet,
): Promise<ActionResult<{ text: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };

  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      opportunity: { select: { jdText: true, title: true, company: true } },
      candidate: { include: { masterCV: { select: { rawText: true } } } },
    },
  });
  const jd = app.opportunity?.jdText ?? "";
  const masterCv = app.candidate?.masterCV?.rawText ?? "";

  try {
    const result = await callLLM({
      worker: "rewrite-bullet",
      model: "standard",
      system: REWRITE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `<master_cv>${masterCv}</master_cv>\n<jd>${jd}</jd>`,
          cache: true,
        },
        {
          role: "user",
          content:
            `Current bullet: ${bullet.text}\n` +
            `Rationale: ${bullet.rationale || "(none)"}\n` +
            `Evidence: ${bullet.evidenceFromMasterCV || "(none)"}\n` +
            `\nReturn the rewritten bullet text only.`,
        },
      ],
      maxTokens: 200,
      temperature: 0.4,
      applicationId,
    });
    const text = result.text.trim().replace(/^["'`]|["'`]$/g, "");
    return { ok: true, value: { text } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Rewrite failed" };
  }
}

export async function saveResumeVersionAction(
  applicationId: string,
  parentArtifactId: string,
  resume: TailoredResume,
): Promise<ActionResult<{ artifactId: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  const parsed = tailoredResumeSchema.safeParse(resume);
  if (!parsed.success) {
    return { ok: false, error: "Resume failed schema validation" };
  }
  const parent = await prisma.artifact.findUnique({ where: { id: parentArtifactId } });
  if (!parent || parent.applicationId !== applicationId) {
    return { ok: false, error: "Parent artifact not found" };
  }
  const next = await prisma.artifact.create({
    data: {
      applicationId,
      type: ArtifactType.TAILORED_RESUME,
      state: ArtifactState.DRAFT,
      contentJson: parsed.data as unknown as Prisma.InputJsonValue,
      contentText: null,
      versionNumber: parent.versionNumber + 1,
      parentVersionId: parent.id,
      generatedByWorker: "manual-edit",
      generationContext: { editedBy: "user" },
    },
  });
  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, value: { artifactId: next.id } };
}

export async function saveCoverLetterVersionAction(
  applicationId: string,
  parentArtifactId: string,
  letter: CoverLetter,
): Promise<ActionResult<{ artifactId: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };
  const parsed = coverLetterSchema.safeParse(letter);
  if (!parsed.success) {
    return { ok: false, error: "Cover letter failed schema validation" };
  }
  const parent = await prisma.artifact.findUnique({ where: { id: parentArtifactId } });
  if (!parent || parent.applicationId !== applicationId) {
    return { ok: false, error: "Parent artifact not found" };
  }
  const next = await prisma.artifact.create({
    data: {
      applicationId,
      type: ArtifactType.COVER_LETTER,
      state: ArtifactState.DRAFT,
      contentJson: parsed.data as unknown as Prisma.InputJsonValue,
      contentText: null,
      versionNumber: parent.versionNumber + 1,
      parentVersionId: parent.id,
      generatedByWorker: "manual-edit",
      generationContext: { editedBy: "user" },
    },
  });
  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, value: { artifactId: next.id } };
}

export async function generatePdfAction(
  applicationId: string,
  artifactId: string,
): Promise<ActionResult<{ signedUrl: string }>> {
  const ownerError = await requireOwner(applicationId);
  if (ownerError) return { ok: false, error: ownerError };

  const artifact = await prisma.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact || artifact.applicationId !== applicationId) {
    return { ok: false, error: "Artifact not found" };
  }

  try {
    let buffer: Buffer;
    if (artifact.type === ArtifactType.TAILORED_RESUME) {
      const parsed = tailoredResumeSchema.safeParse(artifact.contentJson);
      if (!parsed.success) return { ok: false, error: "Resume JSON is malformed" };
      buffer = await renderResumeToPDF(parsed.data);
    } else if (artifact.type === ArtifactType.COVER_LETTER) {
      const parsed = coverLetterSchema.safeParse(artifact.contentJson);
      if (!parsed.success) return { ok: false, error: "Cover letter JSON is malformed" };
      buffer = await renderCoverLetterToPDF(parsed.data);
    } else {
      return { ok: false, error: `PDF render not supported for ${artifact.type}` };
    }

    if (artifact.gcsUri) {
      const signedUrl = await getSignedReadUrl(artifact.gcsUri);
      return { ok: true, value: { signedUrl } };
    }

    const upload = await uploadGeneratedArtifactPdf(applicationId, artifact.type, buffer);
    await prisma.artifact.update({
      where: { id: artifact.id },
      data: { gcsUri: upload.gcsUri },
    });
    return { ok: true, value: { signedUrl: upload.signedReadUrl } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "PDF render failed" };
  }
}
