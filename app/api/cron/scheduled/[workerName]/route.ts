import { NextResponse } from "next/server";
import { getScheduledWorker } from "@/lib/workers/registry";
import { runScheduledWorker } from "@/lib/workers/run-scheduled";
import "@/lib/workers";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workerName: string }> },
) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return unauthorized();

  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth !== expected) return unauthorized();

  const { workerName } = await params;
  if (!getScheduledWorker(workerName)) {
    return NextResponse.json({ error: "unknown_worker" }, { status: 404 });
  }

  const result = await runScheduledWorker(workerName);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
