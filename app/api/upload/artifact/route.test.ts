import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactState, ArtifactType } from "@prisma/client";

const {
  mockUploadArtifact,
  mockGetSession,
  mockCandidateFindUniqueOrThrow,
  mockApplicationFindUnique,
  mockArtifactCreate,
  mockArtifactFindFirst,
} = vi.hoisted(() => ({
  mockUploadArtifact: vi.fn(),
  mockGetSession: vi.fn(),
  mockCandidateFindUniqueOrThrow: vi.fn(),
  mockApplicationFindUnique: vi.fn(),
  mockArtifactCreate: vi.fn(),
  mockArtifactFindFirst: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  uploadArtifact: mockUploadArtifact,
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    candidate: { findUniqueOrThrow: mockCandidateFindUniqueOrThrow },
    application: { findUnique: mockApplicationFindUnique },
    artifact: { create: mockArtifactCreate, findFirst: mockArtifactFindFirst },
  },
}));

import { POST } from "./route";

const PDF_MAGIC_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

function makeRequest(parts: {
  file?: File | null;
  applicationId?: string | null;
  type?: string | null;
  contentType?: string;
  body?: BodyInit;
}): Request {
  if (parts.contentType && parts.body !== undefined) {
    return new Request("http://localhost/api/upload/artifact", {
      method: "POST",
      headers: { "content-type": parts.contentType },
      body: parts.body,
    });
  }
  const fd = new FormData();
  if (parts.file) fd.append("file", parts.file);
  if (parts.applicationId != null) fd.append("applicationId", parts.applicationId);
  if (parts.type != null) fd.append("type", parts.type);
  return new Request("http://localhost/api/upload/artifact", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  mockUploadArtifact.mockReset();
  mockGetSession.mockReset();
  mockCandidateFindUniqueOrThrow.mockReset();
  mockApplicationFindUnique.mockReset();
  mockArtifactCreate.mockReset();
  mockArtifactFindFirst.mockReset();
});

describe("POST /api/upload/artifact", () => {
  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValue({ userId: undefined });
    const file = new File([PDF_MAGIC_BYTES], "r.pdf", { type: "application/pdf" });
    const res = await POST(
      makeRequest({ file, applicationId: "app-1", type: ArtifactType.TAILORED_RESUME }),
    );
    expect(res.status).toBe(401);
    expect(mockUploadArtifact).not.toHaveBeenCalled();
  });

  it("returns 400 when content-type is not multipart/form-data", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const res = await POST(
      makeRequest({ contentType: "application/json", body: "{}" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when applicationId is missing", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const file = new File([PDF_MAGIC_BYTES], "r.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest({ file, type: ArtifactType.TAILORED_RESUME }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is not a valid ArtifactType", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const file = new File([PDF_MAGIC_BYTES], "r.pdf", { type: "application/pdf" });
    const res = await POST(
      makeRequest({ file, applicationId: "app-1", type: "NOT_AN_ARTIFACT_TYPE" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when MIME type is not in the allow-list", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const file = new File([new Uint8Array([0xff, 0xd8])], "r.jpg", { type: "image/jpeg" });
    const res = await POST(
      makeRequest({ file, applicationId: "app-1", type: ArtifactType.TAILORED_RESUME }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when file exceeds 10MB", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const big = new Uint8Array(11 * 1024 * 1024);
    big.set(PDF_MAGIC_BYTES, 0);
    const file = new File([big], "r.pdf", { type: "application/pdf" });
    const res = await POST(
      makeRequest({ file, applicationId: "app-1", type: ArtifactType.TAILORED_RESUME }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when PDF MIME but missing magic bytes", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "r.pdf", {
      type: "application/pdf",
    });
    const res = await POST(
      makeRequest({ file, applicationId: "app-1", type: ArtifactType.TAILORED_RESUME }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/magic bytes/i);
  });

  it("returns 404 when the application does not belong to the candidate", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    mockCandidateFindUniqueOrThrow.mockResolvedValue({ id: "cand-1" });
    mockApplicationFindUnique.mockResolvedValue({ id: "app-1", candidateId: "cand-2" });
    const file = new File([PDF_MAGIC_BYTES], "r.pdf", { type: "application/pdf" });
    const res = await POST(
      makeRequest({ file, applicationId: "app-1", type: ArtifactType.TAILORED_RESUME }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 201 + uploads + inserts DRAFT artifact with monotonic versionNumber for a valid PDF", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    mockCandidateFindUniqueOrThrow.mockResolvedValue({ id: "cand-1" });
    mockApplicationFindUnique.mockResolvedValue({ id: "app-1", candidateId: "cand-1" });
    mockArtifactFindFirst.mockResolvedValue({ versionNumber: 2 });
    mockUploadArtifact.mockResolvedValue({
      gcsUri: "gs://test/artifacts/app-1/tailored_resume-2026.pdf",
      signedReadUrl: "https://signed.example.com/a",
      filename: "tailored_resume-2026.pdf",
      sizeBytes: 1024,
    });
    mockArtifactCreate.mockImplementation(async (args) => ({
      id: "art-1",
      ...args.data,
    }));

    const body = new Uint8Array(1024);
    body.set(PDF_MAGIC_BYTES, 0);
    const file = new File([body], "r.pdf", { type: "application/pdf" });

    const res = await POST(
      makeRequest({ file, applicationId: "app-1", type: ArtifactType.TAILORED_RESUME }),
    );

    expect(res.status).toBe(201);
    const payload = (await res.json()) as { id: string; state: string; versionNumber: number };
    expect(payload.state).toBe(ArtifactState.DRAFT);
    expect(payload.versionNumber).toBe(3);

    expect(mockUploadArtifact).toHaveBeenCalledWith(
      "app-1",
      ArtifactType.TAILORED_RESUME,
      expect.any(File),
      "application/pdf",
    );
    expect(mockArtifactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationId: "app-1",
          type: ArtifactType.TAILORED_RESUME,
          state: ArtifactState.DRAFT,
          versionNumber: 3,
          generatedByWorker: "manual-upload",
          gcsUri: "gs://test/artifacts/app-1/tailored_resume-2026.pdf",
        }),
      }),
    );
  });

  it("uses versionNumber=1 when no prior versions exist", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    mockCandidateFindUniqueOrThrow.mockResolvedValue({ id: "cand-1" });
    mockApplicationFindUnique.mockResolvedValue({ id: "app-1", candidateId: "cand-1" });
    mockArtifactFindFirst.mockResolvedValue(null);
    mockUploadArtifact.mockResolvedValue({
      gcsUri: "gs://test/artifacts/app-1/cover_letter-2026.txt",
      signedReadUrl: "https://signed.example.com/b",
      filename: "cover_letter-2026.txt",
      sizeBytes: 12,
    });
    mockArtifactCreate.mockImplementation(async (args) => ({
      id: "art-2",
      ...args.data,
    }));

    const text = new TextEncoder().encode("Dear hiring");
    const file = new File([text], "cover.txt", { type: "text/plain" });

    const res = await POST(
      makeRequest({ file, applicationId: "app-1", type: ArtifactType.COVER_LETTER }),
    );
    expect(res.status).toBe(201);
    const payload = (await res.json()) as { versionNumber: number };
    expect(payload.versionNumber).toBe(1);

    expect(mockArtifactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 1,
          contentText: "Dear hiring",
        }),
      }),
    );
  });
});
