import { describe, expect, it } from "vitest";
import { ApplicationState, type Application } from "@prisma/client";
import { computeRoleFamilyConversion } from "./role-family";

type FamilyApp = Pick<Application, "state" | "targetRoleSnapshot">;

function app(state: ApplicationState, targetRoles?: string[]): FamilyApp {
  return {
    state,
    targetRoleSnapshot: targetRoles ? { targetRoles } : null,
  } as FamilyApp;
}

describe("computeRoleFamilyConversion", () => {
  it("returns an empty list for no applications", () => {
    expect(computeRoleFamilyConversion([])).toEqual([]);
  });

  it("groups by first targetRoles entry and computes conversion %", () => {
    const rows = computeRoleFamilyConversion([
      app(ApplicationState.NEGOTIATING, ["Staff Engineer"]),
      app(ApplicationState.SUBMITTED, ["Staff Engineer"]),
      app(ApplicationState.SUBMITTED, ["Engineering Manager"]),
    ]);
    const staff = rows.find((r) => r.roleFamily === "Staff Engineer")!;
    expect(staff.total).toBe(2);
    expect(staff.offered).toBe(1);
    expect(staff.conversionPct).toBe(50);
    const em = rows.find((r) => r.roleFamily === "Engineering Manager")!;
    expect(em.offered).toBe(0);
    expect(em.conversionPct).toBe(0);
  });

  it("falls back to '(unspecified)' when snapshot has no targetRoles", () => {
    const rows = computeRoleFamilyConversion([
      app(ApplicationState.SUBMITTED),
      app(ApplicationState.ACCEPTED),
    ]);
    expect(rows[0].roleFamily).toBe("(unspecified)");
    expect(rows[0].total).toBe(2);
    expect(rows[0].offered).toBe(1);
  });

  it("sorts rows by total DESC", () => {
    const rows = computeRoleFamilyConversion([
      app(ApplicationState.SUBMITTED, ["B"]),
      app(ApplicationState.SUBMITTED, ["A"]),
      app(ApplicationState.SUBMITTED, ["A"]),
      app(ApplicationState.SUBMITTED, ["A"]),
    ]);
    expect(rows[0].roleFamily).toBe("A");
    expect(rows[0].total).toBe(3);
    expect(rows[1].roleFamily).toBe("B");
  });

  it("counts NEGOTIATING and ACCEPTED as 'offered'", () => {
    const rows = computeRoleFamilyConversion([
      app(ApplicationState.NEGOTIATING, ["X"]),
      app(ApplicationState.ACCEPTED, ["X"]),
      app(ApplicationState.SUBMITTED, ["X"]),
    ]);
    expect(rows[0].offered).toBe(2);
    expect(rows[0].total).toBe(3);
    expect(rows[0].conversionPct).toBe(67);
  });
});
