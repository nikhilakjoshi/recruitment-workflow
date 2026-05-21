// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArtifactState, ArtifactType, type Artifact } from "@prisma/client";

afterEach(cleanup);

import { PrepTab } from "./prep-tab";

const VALID_PREP = {
  interviewType: "TECHNICAL_SCREEN",
  expectedQuestions: [
    {
      category: "TECHNICAL",
      question: "Walk me through your most recent system design",
      why: "Direct probe of the headline experience.",
    },
    {
      category: "BEHAVIORAL",
      question: "Tell me about a time you led a difficult migration.",
      why: "Standard behavioral probe.",
    },
    {
      category: "LEADERSHIP",
      question: "How do you grow engineers below you?",
      why: "Staff rubric.",
    },
    {
      category: "CASE",
      question: "How would you design a rate limiter?",
      why: "Distributed systems case.",
    },
    {
      category: "CULTURE_FIT",
      question: "How do you weigh speed vs. quality?",
      why: "Culture probe.",
    },
  ],
  starStories: [
    {
      label: "Owning Postgres reliability",
      situation: "Latency regressions during peak.",
      task: "Restore stability.",
      action: "Introduced plan baselines.",
      result: "Cut p99 latency 40%.",
      relevantTo: ["Postgres"],
    },
    {
      label: "Migration leadership",
      situation: "Legacy monolith blocking deploys.",
      task: "Lead migration.",
      action: "Strangler fig.",
      result: "70% faster deploys.",
      relevantTo: ["leadership"],
    },
    {
      label: "Cost cleanup",
      situation: "Cluster spend ballooning.",
      task: "Reduce waste.",
      action: "Tuned HPA.",
      result: "$200k saved.",
      relevantTo: [],
    },
  ],
  questionsToAsk: [
    "What does success look like in 90 days?",
    "How do reliability boundaries work here?",
    "What's the most painful operational issue right now?",
  ],
};

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "prep-1",
    applicationId: "app-1",
    type: ArtifactType.INTERVIEW_PREP,
    state: ArtifactState.APPROVED,
    contentJson: VALID_PREP as unknown as Artifact["contentJson"],
    contentText: null,
    gcsUri: null,
    versionNumber: 1,
    parentVersionId: null,
    generatedByWorker: "interview-prep-assistant",
    generationContext: {},
    embedding: null,
    generatedAt: new Date(),
    approvedAt: new Date(),
    archivedAt: null,
    ...overrides,
  } as Artifact;
}

describe("PrepTab", () => {
  it("renders the 'generating' state when prep is missing", () => {
    render(
      <PrepTab applicationId="app-1" prep={null} companyResearch={null} />,
    );
    expect(screen.getByText(/generating/i)).toBeTruthy();
  });

  it("renders each question, STAR story label, and the questions-to-ask list", () => {
    render(
      <PrepTab applicationId="app-1" prep={makeArtifact()} companyResearch={null} />,
    );
    expect(
      screen.getByText(/walk me through your most recent system design/i),
    ).toBeTruthy();
    expect(screen.getByText(/Owning Postgres reliability/)).toBeTruthy();
    expect(screen.getByText(/Migration leadership/)).toBeTruthy();
    expect(screen.getByText(/Cost cleanup/)).toBeTruthy();
    expect(screen.getByText(/success look like in 90 days/i)).toBeTruthy();
  });

  it("surfaces a malformed-data banner when contentJson does not match the schema", () => {
    const bad = makeArtifact({
      contentJson: { junk: true } as unknown as Artifact["contentJson"],
    });
    render(<PrepTab applicationId="app-1" prep={bad} companyResearch={null} />);
    expect(screen.getByText(/malformed/i)).toBeTruthy();
  });

  it("renders a link to the company research artifact when one is supplied", () => {
    const research = makeArtifact({
      id: "cr-1",
      type: ArtifactType.COMPANY_RESEARCH,
      versionNumber: 2,
      contentJson: {} as unknown as Artifact["contentJson"],
    });
    render(
      <PrepTab applicationId="app-1" prep={makeArtifact()} companyResearch={research} />,
    );
    expect(screen.getByText(/Open Company Research \(v2\)/)).toBeTruthy();
  });
});
