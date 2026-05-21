import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { uploadMasterCV } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024;
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

  if (file.type !== "application/pdf") {
    return jsonError("File must be application/pdf", 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonError(`File exceeds ${MAX_BYTES} bytes`, 400);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfMagic(buffer)) {
    return jsonError("File is not a valid PDF (magic bytes mismatch)", 400);
  }

  const rebuiltFile = new File([buffer], file.name, { type: "application/pdf" });
  const result = await uploadMasterCV(session.userId, rebuiltFile);

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId },
    select: { id: true },
  });

  await prisma.masterCV.upsert({
    where: { candidateId: candidate.id },
    create: {
      candidateId: candidate.id,
      rawText: "",
      structuredJson: {},
      gcsUri: result.gcsUri,
    },
    update: {
      gcsUri: result.gcsUri,
    },
  });

  return NextResponse.json(result);
}
