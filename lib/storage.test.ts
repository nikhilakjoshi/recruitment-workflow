import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
const getSignedUrlMock = vi.fn();
const fileMock = vi.fn((key: string) => {
  void key;
  return { save: saveMock, getSignedUrl: getSignedUrlMock };
});

vi.mock("./storage/bucket", () => ({
  getBucket: vi.fn(() => ({ name: "test-bucket", file: fileMock })),
}));

import { ArtifactType } from "@prisma/client";
import { getSignedReadUrl, uploadArtifact, uploadMasterCV } from "./storage";

describe("uploadMasterCV", () => {
  beforeEach(() => {
    saveMock.mockReset().mockResolvedValue(undefined);
    getSignedUrlMock
      .mockReset()
      .mockResolvedValue(["https://signed.example.com/master-cv/u1.pdf"]);
    fileMock.mockClear();
  });

  it("uploads to master-cv/<userId>-<ISO>.pdf and returns gs:// URI + signed URL", async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "cv.pdf", {
      type: "application/pdf",
    });

    const result = await uploadMasterCV("user-123", file);

    expect(fileMock).toHaveBeenCalledTimes(2);
    const savedKey = String(fileMock.mock.calls[0][0]);
    expect(savedKey).toMatch(/^master-cv\/user-123-\d{4}-\d{2}-\d{2}T.*\.pdf$/);
    expect(saveMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/pdf", resumable: false })
    );
    expect(result.gcsUri).toBe(`gs://test-bucket/${savedKey}`);
    expect(result.signedReadUrl).toBe("https://signed.example.com/master-cv/u1.pdf");
    expect(result.filename).toBe(savedKey.slice("master-cv/".length));
    expect(result.sizeBytes).toBe(4);
  });
});

describe("uploadArtifact", () => {
  beforeEach(() => {
    saveMock.mockReset().mockResolvedValue(undefined);
    getSignedUrlMock
      .mockReset()
      .mockResolvedValue(["https://signed.example.com/artifact"]);
    fileMock.mockClear();
  });

  it("writes to artifacts/<applicationId>/<type>-<ISO>.pdf for PDFs", async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "resume.pdf", {
      type: "application/pdf",
    });
    const result = await uploadArtifact("app-1", ArtifactType.TAILORED_RESUME, file, "application/pdf");

    const savedKey = String(fileMock.mock.calls[0][0]);
    expect(savedKey).toMatch(/^artifacts\/app-1\/tailored_resume-\d{4}-\d{2}-\d{2}T.*\.pdf$/);
    expect(saveMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/pdf", resumable: false }),
    );
    expect(result.gcsUri).toBe(`gs://test-bucket/${savedKey}`);
  });

  it("uses .txt extension for text/plain and .md for text/markdown", async () => {
    const txt = new File([new TextEncoder().encode("hi")], "x.txt", { type: "text/plain" });
    await uploadArtifact("app-1", ArtifactType.COVER_LETTER, txt, "text/plain");
    expect(String(fileMock.mock.calls[0][0])).toMatch(
      /^artifacts\/app-1\/cover_letter-.*\.txt$/,
    );

    fileMock.mockClear();
    const md = new File([new TextEncoder().encode("# hi")], "x.md", { type: "text/markdown" });
    await uploadArtifact("app-1", ArtifactType.RECRUITER_REPLY, md, "text/markdown");
    expect(String(fileMock.mock.calls[0][0])).toMatch(
      /^artifacts\/app-1\/recruiter_reply-.*\.md$/,
    );
  });
});

describe("getSignedReadUrl", () => {
  beforeEach(() => {
    saveMock.mockReset();
    getSignedUrlMock
      .mockReset()
      .mockResolvedValue(["https://signed.example.com/abc"]);
    fileMock.mockClear();
  });

  it("calls bucket.file(key).getSignedUrl with read action and a future expiry", async () => {
    const url = await getSignedReadUrl("gs://test-bucket/master-cv/u1.pdf", {
      ttlSeconds: 30,
    });

    expect(fileMock).toHaveBeenCalledWith("master-cv/u1.pdf");
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "read",
        version: "v4",
        expires: expect.any(Number),
      })
    );
    const expires = (getSignedUrlMock.mock.calls[0][0] as { expires: number }).expires;
    expect(expires).toBeGreaterThan(Date.now());
    expect(url).toBe("https://signed.example.com/abc");
  });

  it("rejects gs:// URI for a different bucket", async () => {
    await expect(
      getSignedReadUrl("gs://other-bucket/master-cv/u1.pdf")
    ).rejects.toThrow(/does not match/);
  });

  it("rejects malformed gs:// URI", async () => {
    await expect(getSignedReadUrl("https://example.com/foo")).rejects.toThrow(
      /Invalid gs:\/\/ URI/
    );
  });
});
