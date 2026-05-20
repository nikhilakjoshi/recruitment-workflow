import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { prisma } from "@/lib/db";

beforeAll(async () => {
  // Start each test run from a known state. The DB is dev-only and shared with
  // dev. We clean only the rows the seed touches.
  await prisma.event.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("prisma seed", () => {
  it("creates exactly one User + Candidate, idempotently", async () => {
    execSync("pnpm exec prisma db seed", { stdio: "ignore" });
    execSync("pnpm exec prisma db seed", { stdio: "ignore" });

    const [users, candidates] = await Promise.all([
      prisma.user.count(),
      prisma.candidate.count(),
    ]);
    expect(users).toBe(1);
    expect(candidates).toBe(1);
  });

  it("rejects a second Candidate row at the DB level (single-tenant)", async () => {
    const user = await prisma.user.create({
      data: { email: `second-${Date.now()}@example.com`, passwordHash: "x" },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Candidate" ("id", "userId", "createdAt", "updatedAt") VALUES ($1, $2, now(), now())`,
        `cand_test_${Date.now()}`,
        user.id,
      ),
    ).rejects.toThrow();
  });
});
