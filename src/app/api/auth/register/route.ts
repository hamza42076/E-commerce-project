import { signupSchema } from "@/lib/validation";
import { createUser } from "@/lib/db/users";
import { payloadFor, signToken, TOKEN_MAX_AGE_SECONDS } from "@/lib/auth/token";
import { created, fail, invalid, readJson } from "@/lib/api/response";

/**
 * POST /api/auth/register
 *
 * Body: { name, email, password, confirmPassword }
 * 201 -> { data: { user, token, expiresIn } }
 * 409 -> email already registered
 * 422 -> validation errors, per field
 *
 * Validated with the same zod schema the signup form uses, and the password is
 * hashed by the same createUser the web flow calls.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (body === null) return fail("Send a JSON body.", 400);

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const { name, email, password } = parsed.data;

  const user = await createUser({ name, email, password });
  if (!user) return fail("An account with that email already exists.", 409);

  return created({
    user,
    token: signToken(payloadFor(user)),
    expiresIn: TOKEN_MAX_AGE_SECONDS,
  });
}
