import "server-only";
import { cookies } from "next/headers";
import type { User } from "@/types";
import {
  payloadFor,
  signToken,
  verifyToken,
  TOKEN_MAX_AGE_SECONDS,
  type SessionPayload,
} from "./token";

/**
 * The web session: the same signed token as the API uses, kept in an httpOnly
 * cookie. Signing out is just clearing the cookie — there is no server-side
 * store to invalidate.
 */

const COOKIE_NAME = "smartshop_session";

export type { SessionPayload };

export async function createSession(user: User): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, signToken(payloadFor(user)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** The signed-in user, or null. Safe to call from any server component. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "admin";
}
