import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactState, ArtifactType, EventType } from "@prisma/client";

const {
  mockArtifactFindUniqueOrThrow,
  mockArtifactUpdate,
  mockArtifactCreate,
  mockEmitEvent,
} = vi.hoisted(() => ({
  mockArtifactFindUniqueOrThrow: vi.fn(),
  mockArtifactUpdate: vi.fn(),
  mockArtifactCreate: vi.fn(),
  mockEmitEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    artifact: {
      findUniqueOrThrow: mockArtifactFindUniqueOrThrow,
      update: mockArtifactUpdate,
      create: mockArtifactCreate,
    },
  },
}));

vi.mock("@/lib/events", () => ({
  emitEvent: mockEmitEvent,
}));

import { approveArtifact, editArtifact, rejectArtifact, requireReview } from "./transitions";
import { eventForApproval, eventForRejection } from "./approval-events";

beforeEach(() => {
  mockArtifactFindUniqueOrThrow.mockReset();
  mockArtifactUpdate.mockReset();
  mockArtifactCreate.mockReset();
  mockEmitEvent.mockReset();
});

function makeArtifact(over: Partial<{
  id: string;
  state: ArtifactState;
  type: ArtifactType;
  applicationId: string;
  candidateId: string;
  versionNumber: number;
  contentJson: unknown;
  contentText: string | null;
}> = {}) {
  return {
    id: over.id ?? "art-1",
    applicationId: over.applicationId ?? "app-1",
    type: over.type ?? ArtifactType.TAILORED_RESUME,
    state: over.state ?? ArtifactState.PENDING_REVIEW,
    contentJson: over.contentJson ?? { foo: "bar" },
    contentText: over.contentText ?? "resume body",
    gcsUri: null,
    versionNumber: over.versionNumber ?? 1,
    parentVersionId: null,
    generatedByWorker: "manual-upload",
    generationContext: {},
    embedding: null,
    generatedAt: new Date(),
    approvedAt: null,
    archivedAt: null,
    application: { candidateId: over.candidateId ?? "cand-1" },
  };
}

describe("approval-events mapping", () => {
  it("maps TAILORED_RESUME -> RESUME_APPROVED / RESUME_REJECTED", () => {
    expect(eventForApproval(ArtifactType.TAILORED_RESUME)).toBe(EventType.RESUME_APPROVED);
    expect(eventForRejection(ArtifactType.TAILORED_RESUME)).toBe(EventType.RESUME_REJECTED);
  });

  it("maps COVER_LETTER approval but no rejection event", () => {
    expect(eventForApproval(ArtifactType.COVER_LETTER)).toBe(EventType.COVER_LETTER_APPROVED);
    expect(eventForRejection(ArtifactType.COVER_LETTER)).toBeNull();
  });

  it("maps outbound types (RECRUITER_REPLY, THANK_YOU_EMAIL, LINKEDIN_REWRITE, NEGOTIATION_DRAFT) to APPROVAL_GRANTED / APPROVAL_REJECTED", () => {
    for (const t of [
      ArtifactType.RECRUITER_REPLY,
      ArtifactType.THANK_YOU_EMAIL,
      ArtifactType.LINKEDIN_REWRITE,
      ArtifactType.NEGOTIATION_DRAFT,
    ]) {
      expect(eventForApproval(t)).toBe(EventType.APPROVAL_GRANTED);
      expect(eventForRejection(t)).toBe(EventType.APPROVAL_REJECTED);
    }
  });

  it("returns null for informational types (EVALUATION, COMPANY_RESEARCH, INTERVIEW_PREP, STAR_LIBRARY)", () => {
    for (const t of [
      ArtifactType.EVALUATION,
      ArtifactType.COMPANY_RESEARCH,
      ArtifactType.INTERVIEW_PREP,
      ArtifactType.STAR_LIBRARY,
    ]) {
      expect(eventForApproval(t)).toBeNull();
      expect(eventForRejection(t)).toBeNull();
    }
  });
});

describe("requireReview", () => {
  it("moves DRAFT -> PENDING_REVIEW", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({ state: ArtifactState.DRAFT }),
    );
    mockArtifactUpdate.mockResolvedValue(makeArtifact({ state: ArtifactState.PENDING_REVIEW }));

    await requireReview({ artifactId: "art-1", actor: "user" });

    expect(mockArtifactUpdate).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { state: ArtifactState.PENDING_REVIEW },
    });
  });

  it("rejects from non-DRAFT states", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({ state: ArtifactState.APPROVED }),
    );
    await expect(requireReview({ artifactId: "art-1", actor: "user" })).rejects.toThrow(
      /expected DRAFT/,
    );
    expect(mockArtifactUpdate).not.toHaveBeenCalled();
  });
});

describe("approveArtifact", () => {
  it("moves PENDING_REVIEW -> APPROVED, sets approvedAt, emits RESUME_APPROVED for TAILORED_RESUME", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({
        id: "art-1",
        type: ArtifactType.TAILORED_RESUME,
        state: ArtifactState.PENDING_REVIEW,
        applicationId: "app-1",
        candidateId: "cand-1",
        versionNumber: 1,
      }),
    );
    mockArtifactUpdate.mockResolvedValue(makeArtifact({ state: ArtifactState.APPROVED }));
    mockEmitEvent.mockResolvedValue({});

    await approveArtifact({ artifactId: "art-1", actor: "user" });

    expect(mockArtifactUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "art-1" },
        data: expect.objectContaining({
          state: ArtifactState.APPROVED,
          approvedAt: expect.any(Date),
        }),
      }),
    );
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventType.RESUME_APPROVED,
        candidateId: "cand-1",
        applicationId: "app-1",
        emittedBy: "user",
      }),
    );
  });

  it("emits APPROVAL_GRANTED for RECRUITER_REPLY approval", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({
        type: ArtifactType.RECRUITER_REPLY,
        state: ArtifactState.PENDING_REVIEW,
      }),
    );
    mockArtifactUpdate.mockResolvedValue(makeArtifact({ state: ArtifactState.APPROVED }));
    mockEmitEvent.mockResolvedValue({});

    await approveArtifact({ artifactId: "art-1", actor: "user" });

    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventType.APPROVAL_GRANTED }),
    );
  });

  it("does NOT emit an event for informational types (EVALUATION)", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({
        type: ArtifactType.EVALUATION,
        state: ArtifactState.PENDING_REVIEW,
      }),
    );
    mockArtifactUpdate.mockResolvedValue(makeArtifact({ state: ArtifactState.APPROVED }));

    await approveArtifact({ artifactId: "art-1", actor: "user" });

    expect(mockEmitEvent).not.toHaveBeenCalled();
  });

  it("refuses to approve an already-APPROVED artifact", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({ state: ArtifactState.APPROVED }),
    );
    await expect(approveArtifact({ artifactId: "art-1", actor: "user" })).rejects.toThrow(
      /cannot approve/,
    );
  });
});

describe("rejectArtifact", () => {
  it("moves PENDING_REVIEW -> REJECTED and emits RESUME_REJECTED for TAILORED_RESUME", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({ type: ArtifactType.TAILORED_RESUME, state: ArtifactState.PENDING_REVIEW }),
    );
    mockArtifactUpdate.mockResolvedValue(makeArtifact({ state: ArtifactState.REJECTED }));
    mockEmitEvent.mockResolvedValue({});

    await rejectArtifact({ artifactId: "art-1", actor: "user", reason: "tone off" });

    expect(mockArtifactUpdate).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { state: ArtifactState.REJECTED },
    });
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventType.RESUME_REJECTED,
        payload: expect.objectContaining({ reason: "tone off" }),
      }),
    );
  });

  it("rejects COVER_LETTER without emitting (no rejection event mapped)", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({ type: ArtifactType.COVER_LETTER, state: ArtifactState.PENDING_REVIEW }),
    );
    mockArtifactUpdate.mockResolvedValue(makeArtifact({ state: ArtifactState.REJECTED }));

    await rejectArtifact({ artifactId: "art-1", actor: "user" });
    expect(mockEmitEvent).not.toHaveBeenCalled();
  });
});

describe("editArtifact", () => {
  it("creates a new DRAFT version with parentVersionId and bumped versionNumber, emits ARTIFACT_EDITED", async () => {
    mockArtifactFindUniqueOrThrow.mockResolvedValue(
      makeArtifact({
        id: "art-1",
        versionNumber: 1,
        type: ArtifactType.TAILORED_RESUME,
        state: ArtifactState.PENDING_REVIEW,
      }),
    );
    mockArtifactCreate.mockResolvedValue(
      makeArtifact({
        id: "art-2",
        versionNumber: 2,
        state: ArtifactState.DRAFT,
        contentText: "edited",
      }),
    );
    mockEmitEvent.mockResolvedValue({});

    const next = await editArtifact({
      artifactId: "art-1",
      actor: "user",
      contentText: "edited",
    });
    expect(next.versionNumber).toBe(2);

    expect(mockArtifactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentVersionId: "art-1",
          versionNumber: 2,
          state: ArtifactState.DRAFT,
          generatedByWorker: "manual-edit",
          contentText: "edited",
        }),
      }),
    );
    expect(mockEmitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: EventType.ARTIFACT_EDITED }),
    );
  });
});
