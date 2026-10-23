import { z } from "zod";

export const assistantProductSchema = z.object({
  id: z.string().min(1).max(128),
  slug: z.string().min(1).max(180),
  name: z.string().min(1).max(140),
  description: z.string().max(2000),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().positive().optional(),
  category: z.string().max(80),
  material: z.string().max(120).optional(),
  features: z.array(z.string().max(120)).max(10),
  image: z.string().max(2048),
  stock: z.number().int().nonnegative(),
  inStock: z.boolean(),
  colors: z
    .array(
      z.object({
        name: z.string().max(40),
        image: z.string().max(2048),
        stock: z.number().int().nonnegative(),
        inStock: z.boolean(),
      }),
    )
    .max(20),
});

export type AssistantProduct = z.infer<typeof assistantProductSchema>;

export const chatResponseSchema = z.object({
  message: z.string().min(1).max(4000),
  products: z.array(assistantProductSchema).max(6),
});

const chatProductReferenceSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(140),
  })
  .strict();

export const chatMessageSchema = z.discriminatedUnion("role", [
  z
    .object({
      role: z.literal("user"),
      text: z.string().trim().min(1).max(600),
    })
    .strict(),
  z
    .object({
      role: z.literal("assistant"),
      text: z.string().trim().min(1).max(4000),
      products: z.array(chatProductReferenceSchema).max(6).optional(),
    })
    .strict(),
]);

export type ChatMessage = z.infer<typeof chatMessageSchema>;

const MAX_CHAT_HISTORY_CHARS = 5000;
const MAX_CHAT_HISTORY_MESSAGES = 12;

export function buildChatRequestMessages(
  history: ChatMessage[],
  latestText: string,
): ChatMessage[] {
  const latest = chatMessageSchema.parse({ role: "user", text: latestText });
  const selected: ChatMessage[] = [];
  let totalCharacters = latest.text.length;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (selected.length >= MAX_CHAT_HISTORY_MESSAGES - 1) break;
    const candidate = chatMessageSchema.parse(history[index]);
    if (totalCharacters + candidate.text.length > MAX_CHAT_HISTORY_CHARS) break;
    totalCharacters += candidate.text.length;
    selected.unshift(candidate);
  }

  return [...selected, latest];
}

export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(12),
  })
  .strict()
  .superRefine((body, context) => {
    if (body.messages.at(-1)?.role !== "user") {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: "The latest message must be from the user.",
      });
    }
    const total = body.messages.reduce((sum, message) => sum + message.text.length, 0);
    if (total > 5000) {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: "Conversation is too long.",
      });
    }
  });
