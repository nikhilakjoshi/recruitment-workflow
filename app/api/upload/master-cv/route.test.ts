import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUploadMasterCV,
  mockGetSession,
  mockCandidateFindUniqueOrThrow,
  mockMasterCVUpsert,
} = vi.hoisted(() => ({
  mockUploadMasterCV: vi.fn(),
  mockGetSession: vi.fn(),
  mockCandidateFindUniqueOrThrow: vi.fn(),
  mockMasterCVUpsert: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  uploadMasterCV: mockUploadMasterCV,
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    candidate: { findUniqueOrThrow: mockCandidateFindUniqueOrThrow },
    masterCV: { upsert: mockMasterCVUpsert },
  },
}));

import { POST } from "./route";

const PDF_MAGIC_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"

function makeMultipartRequest(file: File): Request {
  const fd = new FormData();
  fd.append("file", file);
  return new Request("http://localhost/api/upload/master-cv", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  mockUploadMasterCV.mockReset();
  mockGetSession.mockReset();
  mockCandidateFindUniqueOrThrow.mockReset();
  mockMasterCVUpsert.mockReset();
});

describe("POST /api/upload/master-cv", () => {
  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValue({ userId: undefined });

    const file = new File([PDF_MAGIC_BYTES], "cv.pdf", { type: "application/pdf" });
    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(401);
    expect(mockUploadMasterCV).not.toHaveBeenCalled();
  });

  it("returns 400 when content-type is not multipart/form-data", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });

    const res = await POST(
      new Request("http://localhost/api/upload/master-cv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ foo: "bar" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(mockUploadMasterCV).not.toHaveBeenCalled();
  });

  it("returns 400 when the File's MIME type is not application/pdf", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });

    const file = new File([PDF_MAGIC_BYTES], "cv.txt", { type: "text/plain" });
    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(400);
    expect(mockUploadMasterCV).not.toHaveBeenCalled();
  });

  it("returns 400 when the file exceeds 10MB", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });

    const elevenMb = new Uint8Array(11 * 1024 * 1024);
    elevenMb.set(PDF_MAGIC_BYTES, 0);
    const file = new File([elevenMb], "cv.pdf", { type: "application/pdf" });

    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(400);
    expect(mockUploadMasterCV).not.toHaveBeenCalled();
  });

  it("returns 400 when the file claims PDF MIME but lacks the magic bytes", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });

    const notPdf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG header
    const file = new File([notPdf], "cv.pdf", { type: "application/pdf" });

    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/magic bytes/i);
    expect(mockUploadMasterCV).not.toHaveBeenCalled();
  });

  it("returns 200 + uploads + upserts MasterCV on a valid 1KB PDF", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    mockCandidateFindUniqueOrThrow.mockResolvedValue({ id: "cand-1" });
    mockMasterCVUpsert.mockResolvedValue({});
    mockUploadMasterCV.mockResolvedValue({
      gcsUri: "gs://test-bucket/master-cv/user-1-2026-05-21T00:00:00.000Z.pdf",
      signedReadUrl: "https://signed.example.com/abc",
      filename: "user-1-2026-05-21T00:00:00.000Z.pdf",
      sizeBytes: 1024,
    });

    const body = new Uint8Array(1024);
    body.set(PDF_MAGIC_BYTES, 0);
    const file = new File([body], "cv.pdf", { type: "application/pdf" });

    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(200);
    const payload = (await res.json()) as { gcsUri: string; signedReadUrl: string };
    expect(payload.gcsUri).toMatch(/^gs:\/\/test-bucket\/master-cv\/user-1-/);
    expect(payload.signedReadUrl).toBe("https://signed.example.com/abc");

    expect(mockUploadMasterCV).toHaveBeenCalledWith("user-1", expect.any(File));
    expect(mockCandidateFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
    expect(mockMasterCVUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateId: "cand-1" },
        create: expect.objectContaining({
          candidateId: "cand-1",
          rawText: "",
          gcsUri: payload.gcsUri,
        }),
        update: { gcsUri: payload.gcsUri },
      }),
    );
  });
});
