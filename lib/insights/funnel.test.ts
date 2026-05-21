import { describe, expect, it } from "vitest";
import { ApplicationState, type Application } from "@prisma/client";
import { computeFunnel, FUNNEL_STAGES } from "./funnel";

type FunnelApp = Pick<Application, "state" | "shortlistedAt" | "submittedAt">;

function appsByState(states: ApplicationState[]): FunnelApp[] {
  return states.map((s) => ({
    state: s,
    shortlistedAt: null,
    submittedAt: null,
  }));
}

describe("computeFunnel", () => {
  it("returns rows in the canonical stage order", () => {
    const rows = computeFunnel([]);
    expect(rows.map((r) => r.stage)).toEqual([...FUNNEL_STAGES]);
  });

  it("counts an INTERVIEWING application toward every earlier stage but not OFFERED", () => {
    const rows = computeFunnel(appsByState([ApplicationState.INTERVIEWING]));
    const byStage = Object.fromEntries(rows.map((r) => [r.stage, r.count]));
    expect(byStage.DISCOVERED).toBe(1);
    expect(byStage.SHORTLISTED).toBe(1);
    expect(byStage.SUBMITTED).toBe(1);
    expect(byStage.INTERVIEWING).toBe(1);
    expect(byStage.OFFERED).toBe(0);
  });

  it("aggregates a mixed-state pipeline into correct stage counts", () => {
    const rows = computeFunnel(
      appsByState([
        ApplicationState.DISCOVERED,
        ApplicationState.SHORTLISTED,
        ApplicationState.SUBMITTED,
        ApplicationState.SUBMITTED,
        ApplicationState.INTERVIEWING,
        ApplicationState.NEGOTIATING,
        ApplicationState.ACCEPTED,
        ApplicationState.REJECTED,
      ]),
    );
    const byStage = Object.fromEntries(rows.map((r) => [r.stage, r.count]));
    expect(byStage.DISCOVERED).toBe(8);
    expect(byStage.SHORTLISTED).toBe(6);
    expect(byStage.SUBMITTED).toBe(5);
    expect(byStage.INTERVIEWING).toBe(3);
    expect(byStage.OFFERED).toBe(2);
  });

  it("computes conversionFromPrev as percentage rounded to integer", () => {
    const rows = computeFunnel(
      appsByState([
        ApplicationState.DISCOVERED,
        ApplicationState.DISCOVERED,
        ApplicationState.SHORTLISTED,
      ]),
    );
    const byStage = Object.fromEntries(rows.map((r) => [r.stage, r]));
    expect(byStage.DISCOVERED.conversionFromPrev).toBeNull();
    // SHORTLISTED count = 1, DISCOVERED count = 3, conversion = 33%
    expect(byStage.SHORTLISTED.conversionFromPrev).toBe(33);
  });

  it("returns null conversion when previous stage count is undefined for the first stage only", () => {
    const rows = computeFunnel(appsByState([ApplicationState.SHORTLISTED]));
    expect(rows[0].conversionFromPrev).toBeNull();
  });
});
