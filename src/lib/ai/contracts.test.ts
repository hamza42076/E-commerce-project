import { describe, expect, it } from "vitest";
import { buildChatRequestMessages, chatRequestSchema } from "./contracts";

describe("bounded chat conversation history", () => {
  it("trims older turns so the latest question fits the server character limit", () => {
    const history = Array.from({ length: 11 }, (_, index) => ({
      role: index % 2 === 0 ? "assistant" as const : "user" as const,
      text: `${index}: ${"x".repeat(590)}`,
    }));
    const messages = buildChatRequestMessages(history, "What about black?");

    expect(messages.at(-1)).toEqual({ role: "user", text: "What about black?" });
    expect(messages.length).toBeLessThanOrEqual(12);
    expect(messages.reduce((sum, message) => sum + message.text.length, 0)).toBeLessThanOrEqual(5000);
    expect(chatRequestSchema.safeParse({ messages }).success).toBe(true);
  });

  it("preserves assistant product references in retained turns", () => {
    const messages = buildChatRequestMessages(
      [
        {
          role: "assistant",
          text: "Here are some choices.",
          products: [{ id: "p-001", name: "Everyday Tote" }],
        },
      ],
      "Show me the second one in black.",
    );

    expect(messages[0]).toMatchObject({
      role: "assistant",
      products: [{ id: "p-001", name: "Everyday Tote" }],
    });
    expect(chatRequestSchema.safeParse({ messages }).success).toBe(true);
  });

  it("allows bounded assistant replies longer than the customer input limit in follow-up history", () => {
    const assistantReply = "x".repeat(1200);
    const messages = buildChatRequestMessages(
      [{ role: "assistant", text: assistantReply }],
      "Can you explain that?",
    );

    expect(messages[0]).toEqual({ role: "assistant", text: assistantReply });
    expect(chatRequestSchema.safeParse({ messages }).success).toBe(true);
  });

  it("continues to enforce the shorter customer message limit", () => {
    expect(() =>
      buildChatRequestMessages([], "x".repeat(601)),
    ).toThrow();
  });
});
