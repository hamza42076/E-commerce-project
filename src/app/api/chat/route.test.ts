import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";

const { callerIp, consumeAttempt, runShoppingAssistant } = vi.hoisted(() => ({
  callerIp: vi.fn(),
  consumeAttempt: vi.fn(),
  runShoppingAssistant: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({ callerIp, consumeAttempt }));
vi.mock("@/lib/ai/shopping-assistant", () => ({ runShoppingAssistant }));

import { POST } from "./route";

function request(body: string, headers: HeadersInit = {}): Request {
  return new Request("https://smartshop.test/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    callerIp.mockResolvedValue("192.0.2.1");
    consumeAttempt.mockResolvedValue({ allowed: true });
    runShoppingAssistant.mockResolvedValue({ message: "Hello", products: [] });
  });

  it("rejects malformed, oversized, and non-user-final requests", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ messages: [{ role: "assistant", text: "Hi" }] })))).status)
      .toBe(400);
    expect(
      (await POST(request("{}", { "Content-Length": "10001" }))).status,
    ).toBe(413);
    expect(runShoppingAssistant).not.toHaveBeenCalled();
  });

  it("returns a configuration error without calling Gemini when the key is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const response = await POST(request(JSON.stringify({ messages: [{ role: "user", text: "Hi" }] })));

    expect(response.status).toBe(503);
    expect(runShoppingAssistant).not.toHaveBeenCalled();
  });

  it("enforces the chat rate limit", async () => {
    consumeAttempt.mockResolvedValue({ allowed: false, retryAfterSeconds: 90 });

    const response = await POST(request(JSON.stringify({ messages: [{ role: "user", text: "Hi" }] })));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
    expect(runShoppingAssistant).not.toHaveBeenCalled();
  });

  it("passes validated bounded messages and returns the assistant response", async () => {
    const response = await POST(
      request(JSON.stringify({ messages: [{ role: "user", text: "Show me bags" }] })),
    );

    expect(response.status).toBe(200);
    expect(runShoppingAssistant).toHaveBeenCalledWith([{ role: "user", text: "Show me bags" }]);
    await expect(response.json()).resolves.toEqual({ message: "Hello", products: [] });
  });

  it("preserves bounded product references from assistant history", async () => {
    const messages = [
      {
        role: "assistant",
        text: "Here are two matching products.",
        products: [{ id: "p-001", name: "Everyday Tote" }],
      },
      { role: "user", text: "Show me the second one in black." },
    ];

    const response = await POST(request(JSON.stringify({ messages })));

    expect(response.status).toBe(200);
    expect(runShoppingAssistant).toHaveBeenCalledWith(messages);
  });

  it("returns a safe error when the provider fails", async () => {
    runShoppingAssistant.mockRejectedValue(new Error("private provider detail"));

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: "user", text: "Show me bags" }] })),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { message: "The assistant could not reply right now. Please try again." },
    });
  });

  it("reports actionable safe guidance for Gemini API errors without exposing provider text", async () => {
    runShoppingAssistant.mockRejectedValue(
      new ApiError({ status: 404, message: "private provider detail with sensitive data" }),
    );
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: "user", text: "Show me bags" }] })),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { message: "The configured Gemini model was not found. Check GEMINI_MODEL." },
    });
    expect(errorLog).toHaveBeenCalledWith("[chat] Gemini API request failed (HTTP 404)");
    expect(errorLog).not.toHaveBeenCalledWith(
      expect.stringContaining("private provider detail"),
    );
    errorLog.mockRestore();
  });

  it.each([
    [401, "Gemini authentication failed. Verify GEMINI_API_KEY in the server environment."],
    [403, "Gemini denied access. Check that this API key has Gemini API access enabled."],
    [429, "Gemini usage limits were reached. Check the API quota and try again later."],
  ])("maps Gemini HTTP %i to safe setup guidance", async (status, message) => {
    runShoppingAssistant.mockRejectedValue(new ApiError({ status, message: "redacted" }));

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: "user", text: "Show me bags" }] })),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: { message } });
  });

  it("maps serialized Gemini SDK errors by status without exposing provider details", async () => {
    runShoppingAssistant.mockRejectedValue({
      name: "ApiError",
      status: 503,
      message: "private Google response body",
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: "user", text: "Show me bags" }] })),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Gemini is temporarily unavailable. Please try again shortly." },
    });
    expect(errorLog).toHaveBeenCalledWith("[chat] Gemini API request failed (HTTP 503)");
    errorLog.mockRestore();
  });

  it("returns an actionable timeout message for assistant deadlines", async () => {
    runShoppingAssistant.mockRejectedValue(new Error("Shopping assistant request timed out."));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: "user", text: "Show me bags" }] })),
    );

    await expect(response.json()).resolves.toEqual({
      error: { message: "The assistant took too long to respond. Please try again." },
    });
    expect(errorLog).toHaveBeenCalledWith("[chat] Assistant request failed (ASSISTANT_TIMEOUT)");
    errorLog.mockRestore();
  });
});
