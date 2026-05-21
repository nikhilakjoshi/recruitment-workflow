import { ArtifactType } from "@prisma/client";
import { z } from "zod";

export const ARTIFACT_TYPES = Object.values(ArtifactType) as [ArtifactType, ...ArtifactType[]];

export const artifactUploadFieldsSchema = z.object({
  applicationId: z.string().min(1, "applicationId is required"),
  type: z.enum(ARTIFACT_TYPES),
});

export type ArtifactUploadFields = z.infer<typeof artifactUploadFieldsSchema>;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_BYTES = 10 * 1024 * 1024;

export function isAllowedMime(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function extensionFor(mime: AllowedMimeType): "pdf" | "txt" | "md" {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "text/plain":
      return "txt";
    case "text/markdown":
      return "md";
  }
}
