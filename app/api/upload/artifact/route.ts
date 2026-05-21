import { NextResponse } from "next/server";
import { ArtifactState } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { uploadArtifact } from "@/lib/storage";
import {
  ALLOWED_MIME_TYPES,
  MAX_BYTES,
  artifactUploadFieldsSchema,
  isAllowedMime,
} from "@/lib/schemas/artifact-upload";

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (bytes[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return jsonError("Unauthorized", 401);
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError("Expected multipart/form-data", 400);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Invalid multipart body", 400);
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return jsonError("Missing 'file' field", 400);
  }

  const fieldsParse = artifactUploadFieldsSchema.safeParse({
    applicationId: form.get("applicationId"),
    type: form.get("type"),
  });
  if (!fieldsParse.success) {
    return jsonError(fieldsParse.error.issues[0]?.message ?? "Invalid fields", 400);
  }
  const { applicationId, type: artifactType } = fieldsParse.data;

  if (!isAllowedMime(file.type)) {
    return jsonError(
      `File must be one of: ${ALLOWED_MIME_TYPES.join(", ")}`,
      400,
    );
  }
  if (file.size > MAX_BYTES) {
    return jsonError(`File exceeds ${MAX_BYTES} bytes`, 400);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf" && !hasPdfMagic(buffer)) {
    return jsonError("File is not a valid PDF (magic bytes mismatch)", 400);
  }

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId },
    select: { id: true },
  });

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, candidateId: true },
  });
  if (!application || application.candidateId !== candidate.id) {
    return jsonError("Application not found", 404);
  }

  const rebuiltFile = new File([buffer], file.name, { type: file.type });
  const uploadResult = await uploadArtifact(
    applicationId,
    artifactType,
    rebuiltFile,
    file.type,
  );

  const latest = await prisma.artifact.findFirst({
    where: { applicationId, type: artifactType },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  const contentText =
    file.type === "application/pdf" ? null : new TextDecoder().decode(buffer);

  const artifact = await prisma.artifact.create({
    data: {
      applicationId,
      type: artifactType,
      state: ArtifactState.DRAFT,
      contentJson: {},
      contentText,
      gcsUri: uploadResult.gcsUri,
      versionNumber: nextVersion,
      generatedByWorker: "manual-upload",
      generationContext: {
        uploadedBy: session.userId,
        mime: file.type,
        sizeBytes: uploadResult.sizeBytes,
        filename: uploadResult.filename,
      },
    },
  });

  return NextResponse.json(
    {
      id: artifact.id,
      applicationId: artifact.applicationId,
      type: artifact.type,
      state: artifact.state,
      versionNumber: artifact.versionNumber,
      gcsUri: artifact.gcsUri,
      signedReadUrl: uploadResult.signedReadUrl,
    },
    { status: 201 },
  );
}
