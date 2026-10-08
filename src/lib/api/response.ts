import type { ZodError } from "zod";

/**
 * One response shape for the whole API, so a client never has to guess:
 *   success -> { "data": ... }
 *   failure -> { "error": { "message": "...", "fields"?: { ... } } }
 */

export function ok(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}

export function created(data: unknown): Response {
  return ok(data, 201);
}

export function fail(message: string, status: number): Response {
  return Response.json({ error: { message } }, { status });
}

export function unauthorized(message = "Authentication required."): Response {
  return Response.json(
    { error: { message } },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
  );
}

export function forbidden(message = "You do not have permission to do that."): Response {
  return fail(message, 403);
}

export function notFound(message = "Not found."): Response {
  return fail(message, 404);
}

/** 422 with per-field messages, taken from the same zod schemas the forms use. */
export function invalid(error: ZodError): Response {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return Response.json(
    {
      error: {
        message: error.issues[0]?.message ?? "The request body is not valid.",
        fields,
      },
    },
    { status: 422 },
  );
}

/** Parses a JSON body, returning null when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
