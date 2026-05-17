import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: process.env.GCS_KEY_FILE,
});

const bucketName = process.env.GCS_BUCKET ?? "";

export const bucket = storage.bucket(bucketName);

export type UploadResult = {
  gcsUri: string;
  publicUrl: string;
  name: string;
};
