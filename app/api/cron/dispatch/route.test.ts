import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

async function reset() {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
  await prisma.application.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.user.deleteMany({});
}

beforeAll(async () => {
  process.env.CRON_SECRET = "unit-test-secret";
  await reset();
});

beforeEach(async () => {
  await prisma.eventConsumption.deleteMany({});
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Event" CASCADE');
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
  return new Request("http://localhost/api/cron/dispatch", { method: "GET", headers });
}

describe("GET /api/cron/dispatch", () => {
  it("401 when Authorization header is missing", async () => {
    const res = await GET(req({}));
    expect(res.status).toBe(401);
  });

  it("401 when bearer token does not match CRON_SECRET", async () => {
    const res = await GET(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("200 with { processed, errors } JSON when authorized", async () => {
    const res = await GET(req({ authorization: "Bearer unit-test-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("processed");
    expect(body).toHaveProperty("errors");
    expect(typeof body.processed).toBe("number");
    expect(typeof body.errors).toBe("number");
  });

  it("401 when CRON_SECRET is unset", async () => {
    const prior = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const res = await GET(req({ authorization: "Bearer anything" }));
      expect(res.status).toBe(401);
    } finally {
      process.env.CRON_SECRET = prior;
    }
  });
});
