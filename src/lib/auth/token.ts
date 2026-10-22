import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User, UserRole } from "@/types";

/**
 * Signed, self-contained tokens: base64url(payload).base64url(hmac).
 *
 * Both ways of signing in use this. The web UI puts the token in an httpOnly
 * cookie (see session.ts); the JSON API hands it to the client as a bearer
 * token (see lib/api/guard.ts). One signing routine, so there is only one
 * place where this can be got wrong.
 *
 * There is no server-side session store, so a token stays valid until it
 * expires unless its account is deleted or disabled. Authorization reloads the
 * current account role, so demotion takes effect without waiting for expiry.
 * Signing out clears the cookie; a leaked bearer token cannot otherwise be
 * revoked before `exp`, which is why the lifetime is a week and not a year.
 */

export const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // one week

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  /** Expiry, seconds since epoch. */
  exp: number;
};

function secret(): string {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set (at least 16 characters) in production.");
  }
  // Development only: keeps sign-in working before .env.local exists. Tokens
  // signed with this are invalidated the moment a real secret is configured.
  return "dev-only-insecure-secret-change-me";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function payloadFor(user: User): SessionPayload {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE_SECONDS,
  };
}

export function signToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the payload only if the signature checks out and it has not expired. */
export function verifyToken(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
