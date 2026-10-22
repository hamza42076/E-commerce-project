import { loginSchema } from "@/lib/validation";
import { findActiveUserByEmail, toUser } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { payloadFor, signToken, TOKEN_MAX_AGE_SECONDS } from "@/lib/auth/token";
import {
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  callerIp,
  clearAttempts,
  consumeAttempt,
  describeWait,
} from "@/lib/auth/rate-limit";
import { fail, invalid, ok, readJson, unauthorized } from "@/lib/api/response";

/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 * 200 -> { data: { user, token, expiresIn } }
 * 401 -> wrong email or password
 * 429 -> too many attempts
 *
 * There is no logout endpoint: the token is self-contained, so signing out is
 * the client discarding it. Tokens stay valid until `exp` unless the account
 * is deleted or disabled, in which case authenticated requests are rejected.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (body === null) return fail("Send a JSON body.", 400);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { email, password } = parsed.data;

  // The same counters the sign-in form uses, so throttling the form is not
  // something a caller can step around by posting here instead. Consumed
  // before the lookup, so a blocked caller is told nothing else.
  const ip = await callerIp();

  const byIp = await consumeAttempt(LOGIN_IP_LIMIT, ip);
  if (!byIp.allowed) return tooMany(byIp.retryAfterSeconds);

  const byEmail = await consumeAttempt(LOGIN_EMAIL_LIMIT, email);
  if (!byEmail.allowed) return tooMany(byEmail.retryAfterSeconds);

  const record = await findActiveUserByEmail(email);

  // One message for both cases. Unlike the web form, which names the reason so
  // a customer who has not registered yet is told so, an API client has nobody
  // to be kind to and no reason to be handed a list of who banks here.
  const wrong = unauthorized("Email or password is incorrect.");
  if (!record) return wrong;
  if (!(await verifyPassword(password, record.passwordHash))) return wrong;

  await clearAttempts(LOGIN_EMAIL_LIMIT, email);
  await clearAttempts(LOGIN_IP_LIMIT, ip);

  const user = toUser(record);
  return ok({
    user,
    token: signToken(payloadFor(user)),
    expiresIn: TOKEN_MAX_AGE_SECONDS,
  });
}

function tooMany(retryAfterSeconds: number): Response {
  // Built here rather than through fail() so Retry-After goes on at
  // construction — a well-behaved client reads that instead of guessing.
  return Response.json(
    { error: { message: `Too many attempts. Try again in ${describeWait(retryAfterSeconds)}.` } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
