import { ApiError } from "@google/genai";
import { callerIp, consumeAttempt, type Limit } from "@/lib/auth/rate-limit";
import { runShoppingAssistant } from "@/lib/ai/shopping-assistant";
import { chatRequestSchema } from "@/lib/ai/contracts";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 10_000;
const CHAT_LIMIT: Limit = { name: "shopping-chat", max: 12, windowSeconds: 10 * 60 };

function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json(
    { error: { message } },
    {
      status,
      headers: { "Cache-Control": "no-store", ...headers },
    },
  );
}

function geminiErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Gemini rejected the request. Check GEMINI_MODEL and the assistant request configuration.";
    case 401:
      return "Gemini authentication failed. Verify GEMINI_API_KEY in the server environment.";
    case 403:
      return "Gemini denied access. Check that this API key has Gemini API access enabled.";
    case 404:
      return "The configured Gemini model was not found. Check GEMINI_MODEL.";
    case 429:
      return "Gemini usage limits were reached. Check the API quota and try again later.";
    default:
      return status >= 500
        ? "Gemini is temporarily unavailable. Please try again shortly."
        : "The assistant could not reply right now. Please try again.";
  }
}

function geminiHttpStatus(error: unknown): number | null {
  if (error instanceof ApiError) return error.status;
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ApiError" &&
    "status" in error &&
    typeof error.status === "number" &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status;
  }
  return null;
}

function assistantFailure(error: unknown): { category: string; message: string } {
  if (error instanceof Error) {
    if (error.name === "ZodError") {
      return {
        category: "INVALID_TOOL_ARGUMENTS",
        message: "The assistant had trouble processing that request. Please try asking in a different way.",
      };
    }
    if (error.message === "Shopping assistant request timed out.") {
      return {
        category: "ASSISTANT_TIMEOUT",
        message: "The assistant took too long to respond. Please try again.",
      };
    }
    if (error.message === "Gemini returned an empty response.") {
      return {
        category: "EMPTY_PROVIDER_RESPONSE",
        message: "The assistant did not receive a usable reply. Please try again.",
      };
    }
    if (
      error.message === "Shopping assistant iteration limit reached." ||
      error.message === "Shopping assistant tool-call limit reached."
    ) {
      return {
        category: "TOOL_LIMIT_REACHED",
        message: "The assistant could not complete that request. Please try a simpler question.",
      };
    }
    if (error.name === "TypeError") {
      return {
        category: "NETWORK_ERROR",
        message: "The assistant could not connect to Gemini. Check the server's internet connection and try again.",
      };
    }
    return { category: error.name || "Error", message: "The assistant could not reply right now. Please try again." };
  }
  return {
    category: "UNKNOWN_ERROR",
    message: "The assistant could not reply right now. Please try again.",
  };
}

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError("Message is too large. Please shorten it and try again.", 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonError("Could not read the message. Please try again.", 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonError("Message is too large. Please shorten it and try again.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("Send a valid JSON message.", 400);
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Please send a valid message and try again.", 400);
  }

  try {
    const ip = await callerIp();
    const limit = await consumeAttempt(CHAT_LIMIT, ip);
    if (!limit.allowed) {
      return jsonError("Too many chat requests. Please wait before trying again.", 429, {
        "Retry-After": String(limit.retryAfterSeconds),
      });
    }

    if (!process.env.GEMINI_API_KEY?.trim()) {
      return jsonError(
        "The AI assistant is not configured yet. Add GEMINI_API_KEY to the server environment.",
        503,
      );
    }

    const result = await runShoppingAssistant(parsed.data.messages);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "GEMINI_NOT_CONFIGURED") {
      return jsonError(
        "The AI assistant is not configured yet. Add GEMINI_API_KEY to the server environment.",
        503,
      );
    }

    const geminiStatus = geminiHttpStatus(error);
    if (geminiStatus !== null) {
      console.error(`[chat] Gemini API request failed (HTTP ${geminiStatus})`);
      return jsonError(geminiErrorMessage(geminiStatus), 502);
    }

    const failure = assistantFailure(error);
    console.error(`[chat] Assistant request failed (${failure.category})`);
    return jsonError(failure.message, 502);
  }
}
