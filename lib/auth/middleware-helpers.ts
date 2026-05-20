import type { NextRequest } from "next/server";

export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) return false;

  const candidate = origin ?? referer;
  if (!candidate) return false;

  try {
    const url = new URL(candidate);
    return url.host === host;
  } catch {
    return false;
  }
}
