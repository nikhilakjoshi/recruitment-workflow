import { NextResponse } from "next/server";
import { dispatchOnce } from "@/lib/workers/dispatch";
import "@/lib/workers/registered";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return unauthorized();

  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth !== expected) return unauthorized();

  const summary = await dispatchOnce();
  return NextResponse.json(summary);
}
