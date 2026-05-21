import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  _resetRegistryForTests,
  registerScheduledWorker,
} from "@/lib/workers/registry";
import type { ScheduledWorker } from "@/lib/workers/types";
import { GET } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;
let invocations: string[] = [];

async function reset() {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.followUp.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

const probeWorker: ScheduledWorker = {
  name: "probe-scheduled",
  schedule: "0 0 * * *",
  runtime: "always-on",
  model: "cheap",
  async run() {
    invocations.push("probe-scheduled");
    return { output: null };
  },
};

beforeAll(async () => {
  process.env.CRON_SECRET = "scheduled-test-secret";
  await reset();
  const user = await prisma.user.create({
    data: {
      email: "scheduled-cron@example.com",
      passwordHash: await hashPassword("x"),
    },
  });
  await prisma.candidate.create({ data: { userId: user.id } });
});

beforeEach(() => {
  _resetRegistryForTests();
  invocations = [];
});

afterEach(() => {
  _resetRegistryForTests();
});

afterAll(async () => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
  await reset();
  await prisma.$disconnect();
});

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/scheduled/x", {
    method: "GET",
    headers,
  });
}

function params(workerName: string) {
  return { params: Promise.resolve({ workerName }) };
}

describe("GET /api/cron/scheduled/[workerName]", () => {
  it("401 when Authorization header is missing", async () => {
    registerScheduledWorker(probeWorker);
    const res = await GET(req({}), params("probe-scheduled"));
    expect(res.status).toBe(401);
    expect(invocations).toHaveLength(0);
  });

  it("401 when bearer token does not match CRON_SECRET", async () => {
    registerScheduledWorker(probeWorker);
    const res = await GET(
      req({ authorization: "Bearer wrong" }),
      params("probe-scheduled"),
    );
    expect(res.status).toBe(401);
    expect(invocations).toHaveLength(0);
  });

  it("404 for an unknown worker name", async () => {
    const res = await GET(
      req({ authorization: "Bearer scheduled-test-secret" }),
      params("does-not-exist"),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "unknown_worker" });
  });

  it("200 + invokes worker on a valid registered name", async () => {
    registerScheduledWorker(probeWorker);
    const res = await GET(
      req({ authorization: "Bearer scheduled-test-secret" }),
      params("probe-scheduled"),
    );
    expect(res.status).toBe(200);
    expect(invocations).toEqual(["probe-scheduled"]);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.workerName).toBe("probe-scheduled");
  });

  it("500 when worker throws", async () => {
    registerScheduledWorker({
      name: "throws",
      schedule: "0 0 * * *",
      runtime: "always-on",
      model: "cheap",
      async run() {
        throw new Error("boom");
      },
    });
    const res = await GET(
      req({ authorization: "Bearer scheduled-test-secret" }),
      params("throws"),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("boom");
  });
});
