import "server-only";

import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";

export type SessionData = {
  userId?: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function getSessionOptions(): SessionOptions {
  const password = process.env.AUTH_SECRET;
  if (!password || password.length < 32) {
    throw new Error("AUTH_SECRET must be set to a string of at least 32 characters");
  }
  return {
    password,
    cookieName: "career_os_session",
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function setSession(userId: string): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
