import { getBearerUser } from "@/lib/api/guard";
import { findUserById } from "@/lib/db/users";
import { notFound, ok, unauthorized } from "@/lib/api/response";

/**
 * GET /api/auth/me
 *
 * Header: Authorization: Bearer <token>
 * 200 -> { data: { user } }
 * 401 -> missing, malformed, tampered or expired token
 *
 * Re-reads the account rather than trusting the token's copy, so a role change
 * or a deleted account takes effect immediately instead of at token expiry.
 */
export async function GET(request: Request): Promise<Response> {
  const payload = await getBearerUser(request);
  if (!payload) return unauthorized();

  const user = await findUserById(payload.userId);
  if (!user) return notFound("That account no longer exists.");

  return ok({ user });
}
