import { loginSchema } from "@/lib/validation";
import { findUserByEmail, toUser } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { payloadFor, signToken, TOKEN_MAX_AGE_SECONDS } from "@/lib/auth/token";
import { fail, invalid, ok, readJson, unauthorized } from "@/lib/api/response";

/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 * 200 -> { data: { user, token, expiresIn } }
 * 401 -> wrong email or password
 *
 * There is no logout endpoint: the token is self-contained, so signing out is
 * the client discarding it. Tokens stay valid until `exp`.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (body === null) return fail("Send a JSON body.", 400);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const record = await findUserByEmail(parsed.data.email);

  // One message for both cases, so the endpoint cannot be used to find out
  // which email addresses have accounts.
  const wrong = unauthorized("Email or password is incorrect.");
  if (!record) return wrong;
  if (!(await verifyPassword(parsed.data.password, record.passwordHash))) return wrong;

  const user = toUser(record);
  return ok({
    user,
    token: signToken(payloadFor(user)),
    expiresIn: TOKEN_MAX_AGE_SECONDS,
  });
}
