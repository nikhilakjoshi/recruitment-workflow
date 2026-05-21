// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArtifactState, ArtifactType, type Artifact } from "@prisma/client";

vi.mock("@/app/(authed)/applications/[id]/_actions", () => ({
  regenerateEvaluationAction: vi.fn().mockResolvedValue({ ok: true, value: { requested: true } }),
}));

vi.mock("@/lib/ui/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

import { EvaluationPanel } from "./evaluation-panel";

afterEach(() => cleanup());

const APPLICATION_ID = "app_1";

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "art_1",
    applicationId: APPLICATION_ID,
    type: ArtifactType.EVALUATION,
    state: ArtifactState.APPROVED,
    contentJson: {
      score: 82,
      fit: "STRONG",
      confidence: "HIGH",
      strengths: ["Distributed systems experience matches the JD seniority bar"],
      gaps: ["Kafka mentioned in JD but not on CV"],
      rationale:
        "Strong overlap on backend + distributed systems. Minor gaps on tooling. Candidate's FAANG tenure aligns with the role's scope.",
    } as never,
    contentText: null,
    gcsUri: null,
    versionNumber: 1,
    parentVersionId: null,
    generatedByWorker: "match-scorer",
    generationContext: {} as never,
    generatedAt: new Date(),
    approvedAt: new Date(),
    archivedAt: null,
    ...overrides,
  };
}

describe("EvaluationPanel", () => {
  it("shows the generating empty state when no artifact is present", () => {
    render(<EvaluationPanel applicationId={APPLICATION_ID} artifact={null} />);
    expect(screen.getByText(/Evaluation generating/i)).toBeDefined();
  });

  it("renders score, fit label, confidence, strengths, and gaps", () => {
    render(<EvaluationPanel applicationId={APPLICATION_ID} artifact={makeArtifact()} />);
    expect(screen.getByText("82")).toBeDefined();
    expect(screen.getByText(/STRONG fit/)).toBeDefined();
    expect(screen.getByText(/Confidence: HIGH/)).toBeDefined();
    expect(screen.getByText(/Distributed systems experience/)).toBeDefined();
    expect(screen.getByText(/Kafka mentioned/)).toBeDefined();
  });

  it("overwrites the LLM-returned fit with the deterministic threshold", () => {
    // Score 35 with LLM claiming STRONG — UI must show WEAK
    const artifact = makeArtifact({
      contentJson: {
        score: 35,
        fit: "STRONG",
        confidence: "LOW",
        strengths: ["One strength to satisfy the schema"],
        gaps: [],
        rationale:
          "A long enough rationale to satisfy the zod schema's 50-character minimum requirement.",
      } as never,
    });
    render(<EvaluationPanel applicationId={APPLICATION_ID} artifact={artifact} />);
    expect(screen.getByText(/WEAK fit/)).toBeDefined();
  });

  it("renders a malformed-artifact banner when contentJson does not match the schema", () => {
    const artifact = makeArtifact({
      contentJson: { score: 42 } as never, // missing required fields
    });
    render(<EvaluationPanel applicationId={APPLICATION_ID} artifact={artifact} />);
    expect(screen.getByText(/malformed/i)).toBeDefined();
  });

  it("renders a Regenerate button", () => {
    render(<EvaluationPanel applicationId={APPLICATION_ID} artifact={makeArtifact()} />);
    expect(screen.getByRole("button", { name: /Regenerate/i })).toBeDefined();
  });
});
