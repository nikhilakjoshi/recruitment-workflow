import "server-only";

import { Storage, type Bucket } from "@google-cloud/storage";

let cachedBucket: Bucket | null = null;

export function getBucket(): Bucket {
  if (cachedBucket) return cachedBucket;

  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    throw new Error("GCS_BUCKET env var is not set");
  }

  const storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: process.env.GCS_KEY_FILE,
  });

  cachedBucket = storage.bucket(bucketName);
  return cachedBucket;
}
