import { z } from "zod";

/**
 * Shared between the react-hook-form resolvers on the client and the server
 * actions, so the browser and the server never disagree about what is valid.
 */

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name is too long"),
    email: z.email("Enter a valid email address").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password is too long")
      .regex(/[a-zA-Z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupValues = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** Pakistani mobile numbers, with or without the country code. */
const phonePattern = /^(?:\+92|0)3\d{9}$/;

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  phone: z
    .string()
    .trim()
    .regex(phonePattern, "Enter a valid number, e.g. 03001234567"),
  address: z.string().trim().min(10, "Enter the full street address").max(200, "Too long"),
  city: z.string().trim().min(2, "Enter your city").max(60, "Too long"),
  notes: z.string().trim().max(300, "Keep notes under 300 characters").optional(),
});

export type CheckoutValues = z.infer<typeof checkoutSchema>;

export const productSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(120, "Too long"),
  description: z
    .string()
    .trim()
    .min(20, "Write at least 20 characters")
    .max(1000, "Keep it under 1000 characters"),
  price: z.coerce
    .number<number>()
    .int("Use whole rupees")
    .positive("Price must be greater than zero")
    .max(10_000_000, "That price looks wrong"),
  compareAtPrice: z.coerce
    .number<number>()
    .int("Use whole rupees")
    .nonnegative("Cannot be negative")
    .max(10_000_000, "That price looks wrong")
    .optional(),
  category: z.string().trim().min(1, "Pick a category"),
  // Either an external URL, or a path produced by the upload action.
  image: z
    .union([
      z.url("Enter a valid URL"),
      z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/, "Enter a valid URL"),
      z.literal(""),
    ])
    .optional(),
  stock: z.coerce
    .number<number>()
    .int("Use a whole number")
    .nonnegative("Cannot be negative")
    .max(100_000, "That looks wrong"),
  featured: z.boolean().optional(),
});

export type ProductValues = z.infer<typeof productSchema>;

/** Slug used for the product URL, derived from its name. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
