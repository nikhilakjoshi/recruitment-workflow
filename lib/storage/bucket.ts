import "server-only";

import { Storage, type Bucket } from "@google-cloud/storage";

let cachedBucket: Bucket | null = null;

function buildStorage(): Storage {
  const projectId = process.env.GCS_PROJECT_ID;

  // Prefer inline JSON (Vercel/serverless — no persistent filesystem).
  // Fall back to file path (local dev) for convenience.
  const keyJson = process.env.GCS_KEY_JSON;
  if (keyJson && keyJson.trim().length > 0) {
    let credentials: { client_email: string; private_key: string };
    try {
      credentials = JSON.parse(keyJson);
    } catch (err) {
      throw new Error(
        `GCS_KEY_JSON is set but is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        "GCS_KEY_JSON is missing required fields (client_email, private_key)",
      );
    }
    return new Storage({ projectId, credentials });
  }

  const keyFile = process.env.GCS_KEY_FILE;
  if (keyFile && keyFile.trim().length > 0) {
    return new Storage({ projectId, keyFilename: keyFile });
  }

  throw new Error(
    "GCS credentials missing. Set GCS_KEY_JSON (inline JSON, recommended for prod) or GCS_KEY_FILE (path to JSON file, local dev only).",
  );
}

export function getBucket(): Bucket {
  if (cachedBucket) return cachedBucket;

  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    throw new Error("GCS_BUCKET env var is not set");
  }

  cachedBucket = buildStorage().bucket(bucketName);
  return cachedBucket;
}
