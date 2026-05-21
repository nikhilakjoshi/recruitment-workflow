import type { ArtifactType } from "@prisma/client";
import { getBucket } from "./storage/bucket";
import {
  type AllowedMimeType,
  extensionFor,
} from "./schemas/artifact-upload";

export type UploadResult = {
  gcsUri: string;
  signedReadUrl: string;
  filename: string;
  sizeBytes: number;
};

const SIGNED_URL_DEFAULT_TTL_SECONDS = 60 * 60;

function buildGcsUri(bucketName: string, objectKey: string): string {
  return `gs://${bucketName}/${objectKey}`;
}

function parseGcsUri(gcsUri: string): { bucket: string; key: string } {
  if (!gcsUri.startsWith("gs://")) {
    throw new Error(`Invalid gs:// URI: ${gcsUri}`);
  }
  const without = gcsUri.slice("gs://".length);
  const slash = without.indexOf("/");
  if (slash < 1 || slash === without.length - 1) {
    throw new Error(`Invalid gs:// URI: ${gcsUri}`);
  }
  return { bucket: without.slice(0, slash), key: without.slice(slash + 1) };
}

export async function uploadMasterCV(
  userId: string,
  file: File
): Promise<UploadResult> {
  const bucket = getBucket();
  const timestamp = new Date().toISOString();
  const objectKey = `master-cv/${userId}-${timestamp}.pdf`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await bucket.file(objectKey).save(buffer, {
    contentType: "application/pdf",
    resumable: false,
  });

  const gcsUri = buildGcsUri(bucket.name, objectKey);
  const signedReadUrl = await getSignedReadUrl(gcsUri);

  return {
    gcsUri,
    signedReadUrl,
    filename: objectKey.slice("master-cv/".length),
    sizeBytes: buffer.byteLength,
  };
}

export async function uploadGeneratedArtifactPdf(
  applicationId: string,
  artifactType: ArtifactType,
  buffer: Buffer,
): Promise<UploadResult> {
  const bucket = getBucket();
  const timestamp = new Date().toISOString();
  const typeKey = artifactType.toLowerCase();
  const objectKey = `artifacts/${applicationId}/${typeKey}-${timestamp}.pdf`;

  await bucket.file(objectKey).save(buffer, {
    contentType: "application/pdf",
    resumable: false,
  });

  const gcsUri = buildGcsUri(bucket.name, objectKey);
  const signedReadUrl = await getSignedReadUrl(gcsUri);

  return {
    gcsUri,
    signedReadUrl,
    filename: objectKey.slice(`artifacts/${applicationId}/`.length),
    sizeBytes: buffer.byteLength,
  };
}

export async function uploadArtifact(
  applicationId: string,
  artifactType: ArtifactType,
  file: File,
  mime: AllowedMimeType,
): Promise<UploadResult> {
  const bucket = getBucket();
  const timestamp = new Date().toISOString();
  const ext = extensionFor(mime);
  const typeKey = artifactType.toLowerCase();
  const objectKey = `artifacts/${applicationId}/${typeKey}-${timestamp}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await bucket.file(objectKey).save(buffer, {
    contentType: mime,
    resumable: false,
  });

  const gcsUri = buildGcsUri(bucket.name, objectKey);
  const signedReadUrl = await getSignedReadUrl(gcsUri);

  return {
    gcsUri,
    signedReadUrl,
    filename: objectKey.slice(`artifacts/${applicationId}/`.length),
    sizeBytes: buffer.byteLength,
  };
}

export async function getSignedReadUrl(
  gcsUri: string,
  opts?: { ttlSeconds?: number }
): Promise<string> {
  const { bucket: bucketName, key } = parseGcsUri(gcsUri);
  const bucket = getBucket();
  if (bucket.name !== bucketName) {
    throw new Error(
      `gs:// URI bucket "${bucketName}" does not match configured bucket "${bucket.name}"`
    );
  }
  const ttlSeconds = opts?.ttlSeconds ?? SIGNED_URL_DEFAULT_TTL_SECONDS;
  const [url] = await bucket.file(key).getSignedUrl({
    action: "read",
    expires: Date.now() + ttlSeconds * 1000,
    version: "v4",
  });
  return url;
}
