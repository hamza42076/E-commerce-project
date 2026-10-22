import "server-only";
import { verifyToken, type SessionPayload } from "@/lib/auth/token";
import { findUserById } from "@/lib/db/users";

/**
 * The API authenticates with `Authorization: Bearer <token>` and deliberately
 * ignores the session cookie.
 *
 * Why not the cookie: a cookie is sent by the browser automatically, so a
 * cookie-authenticated POST endpoint can be triggered from any other site —
 * that is CSRF. Server Actions are protected against this by the framework;
 * plain route handlers are not. A bearer token has to be attached on purpose,
 * so there is nothing for another site to abuse, and it is what a mobile app
 * would carry anyway.
 */

export async function getBearerUser(request: Request): Promise<SessionPayload | null> {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;

  const payload = verifyToken(token.trim());
  if (!payload) return null;

  const user = await findUserById(payload.userId);
  if (!user) return null;

  return { ...payload, email: user.email, name: user.name, role: user.role };
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return (await getBearerUser(request))?.role === "admin";
}
