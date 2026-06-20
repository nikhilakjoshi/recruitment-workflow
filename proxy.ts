import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, readAuthSecret } from "@/lib/auth/session-config";
import { isSameOrigin } from "@/lib/auth/middleware-helpers";

const PUBLIC_PATHS = new Set<string>(["/signin", "/walkthrough"]);
const PUBLIC_PREFIXES = ["/api/auth/", "/api/cron/", "/_next/", "/favicon"];
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(req: NextRequest) {
  if (MUTATING_METHODS.has(req.method) && !isSameOrigin(req)) {
    return new NextResponse("Cross-origin request blocked", { status: 403 });
  }

  const forwardedHeaders = new Headers(req.headers);
  forwardedHeaders.set("x-pathname", req.nextUrl.pathname);

  if (isPublic(req.nextUrl.pathname)) {
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  let password: string;
  try {
    password = readAuthSecret();
  } catch {
    return new NextResponse("AUTH_SECRET not configured", { status: 500 });
  }

  const res = NextResponse.next({ request: { headers: forwardedHeaders } });
  const session = await getIronSession<SessionData>(req, res, {
    password,
    cookieName: SESSION_COOKIE_NAME,
  });

  if (!session.userId) {
    const signinUrl = new URL("/signin", req.nextUrl);
    return NextResponse.redirect(signinUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
