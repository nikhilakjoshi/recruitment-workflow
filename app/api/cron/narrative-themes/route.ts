import { NextResponse } from "next/server";
import { runNarrativeThemeExtractor } from "@/lib/workers/narrative-theme-extractor";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return unauthorized();
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return unauthorized();

  const results = await runNarrativeThemeExtractor();
  return NextResponse.json({ results });
}
