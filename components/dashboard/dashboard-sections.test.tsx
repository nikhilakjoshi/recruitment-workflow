// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  ApplicationState,
  ArtifactState,
  ArtifactType,
  InsightType,
  OpportunitySource,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

vi.mock("@/app/(authed)/_actions", () => ({
  acknowledgeFollowUpAction: vi.fn().mockResolvedValue({ ok: true, value: {} }),
}));
vi.mock("@/lib/ui/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

import { ActiveApplicationsSection } from "./active-applications";
import { PendingApprovalsSection } from "./pending-approvals";
import { OpportunityDigestSection } from "./opportunity-digest";
import { FollowUpAlertsSection } from "./follow-up-alerts";
import { StrategicInsightsSection } from "./strategic-insights";

let candidateId: string;

async function reset() {
  await prisma.eventConsumption.deleteMany({});
  await prisma.insight.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.artifact.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  await reset();
  const user = await prisma.user.create({
    data: { email: "dashboard@example.com", passwordHash: await hashPassword("x") },
  });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  candidateId = candidate.id;
});

afterEach(() => cleanup());

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

async function makeOpp(overrides: Partial<{ title: string; company: string; rankScore: number; rankReason: string }>) {
  return prisma.opportunity.create({
    data: {
      title: overrides.title ?? "Role",
      company: overrides.company ?? "Co",
      jdText: "x",
      sourcePlatform: OpportunitySource.MANUAL,
      rankScore: overrides.rankScore ?? null,
      rankReason: overrides.rankReason ?? null,
    },
  });
}

describe("ActiveApplicationsSection", () => {
  it("excludes terminal-state applications", async () => {
    const active = await makeOpp({ title: "Active role", company: "AcmeA" });
    const archived = await makeOpp({ title: "Archived role", company: "AcmeZ" });
    await prisma.application.create({
      data: {
        candidateId,
        opportunityId: active.id,
        state: ApplicationState.SHORTLISTED,
        targetRoleSnapshot: {},
      },
    });
    await prisma.application.create({
      data: {
        candidateId,
        opportunityId: archived.id,
        state: ApplicationState.ARCHIVED,
        targetRoleSnapshot: {},
      },
    });

    render(await ActiveApplicationsSection({ candidateId }));
    expect(screen.getByText("Active role")).toBeTruthy();
    expect(screen.queryByText("Archived role")).toBeNull();
  });
});

describe("PendingApprovalsSection", () => {
  it("lists artifacts in PENDING_REVIEW grouped by application", async () => {
    const opp = await makeOpp({ title: "PR role", company: "PrCo" });
    const app = await prisma.application.create({
      data: {
        candidateId,
        opportunityId: opp.id,
        state: ApplicationState.TAILORING,
        targetRoleSnapshot: {},
      },
    });
    await prisma.artifact.create({
      data: {
        applicationId: app.id,
        type: ArtifactType.TAILORED_RESUME,
        state: ArtifactState.PENDING_REVIEW,
        contentJson: {},
        versionNumber: 1,
        generatedByWorker: "tailored-resume-builder",
        generationContext: {},
      },
    });
    await prisma.artifact.create({
      data: {
        applicationId: app.id,
        type: ArtifactType.EVALUATION,
        state: ArtifactState.APPROVED,
        contentJson: {},
        versionNumber: 1,
        generatedByWorker: "match-scorer",
        generationContext: {},
      },
    });

    render(await PendingApprovalsSection({ candidateId }));
    expect(screen.getByText("PR role")).toBeTruthy();
    expect(screen.getByText("TAILORED_RESUME")).toBeTruthy();
    expect(screen.queryByText("EVALUATION")).toBeNull();
  });
});

describe("OpportunityDigestSection", () => {
  it("sorts by rankScore desc and excludes unranked", async () => {
    await makeOpp({ title: "Top pick", company: "A", rankScore: 95, rankReason: "Great fit" });
    await makeOpp({ title: "Middle", company: "B", rankScore: 60, rankReason: "Okay" });
    await makeOpp({ title: "Unranked", company: "C" });

    const { container } = render(await OpportunityDigestSection());
    const items = container.querySelectorAll("li");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain("Top pick");
    expect(items[1].textContent).toContain("Middle");
    expect(container.textContent).not.toContain("Unranked");
  });
});

describe("FollowUpAlertsSection", () => {
  it("lists only unacknowledged follow-ups for the candidate", async () => {
    const opp1 = await makeOpp({ title: "Stale", company: "S" });
    const app1 = await prisma.application.create({
      data: {
        candidateId,
        opportunityId: opp1.id,
        state: ApplicationState.SUBMITTED,
        targetRoleSnapshot: {},
      },
    });
    await prisma.followUp.create({
      data: { applicationId: app1.id, reason: "stale 14d", suggestedAction: "Follow up" },
    });

    const opp2 = await makeOpp({ title: "Acked", company: "K" });
    const app2 = await prisma.application.create({
      data: {
        candidateId,
        opportunityId: opp2.id,
        state: ApplicationState.SUBMITTED,
        targetRoleSnapshot: {},
      },
    });
    await prisma.followUp.create({
      data: {
        applicationId: app2.id,
        reason: "old",
        suggestedAction: "Follow up",
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    });

    render(await FollowUpAlertsSection({ candidateId }));
    expect(screen.getByText("Stale")).toBeTruthy();
    expect(screen.queryByText("Acked")).toBeNull();
    expect(screen.getByText(/Acknowledge/)).toBeTruthy();
  });
});

describe("StrategicInsightsSection", () => {
  it("renders the latest WEEKLY_DIGEST narrative + highlights", async () => {
    await prisma.insight.create({
      data: {
        candidateId,
        type: InsightType.WEEKLY_DIGEST,
        contentJson: {
          paragraph: "You shipped two applications this week.",
          highlights: ["Bullet A", "Bullet B"],
          weekStart: "2026-05-14T00:00:00.000Z",
          weekEnd: "2026-05-21T00:00:00.000Z",
        },
        confidence: 1,
      },
    });

    render(await StrategicInsightsSection({ candidateId }));
    expect(screen.getByText(/shipped two/)).toBeTruthy();
    expect(screen.getByText("Bullet A")).toBeTruthy();
    expect(screen.getByText("Bullet B")).toBeTruthy();
  });

  it("shows empty state when no digest exists", async () => {
    await prisma.insight.deleteMany({ where: { candidateId } });
    render(await StrategicInsightsSection({ candidateId }));
    expect(screen.getByText(/Sundays at 9am/i)).toBeTruthy();
  });
});
