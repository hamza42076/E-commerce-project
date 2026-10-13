import { z } from "zod";

/**
 * Shared between the react-hook-form resolvers on the client and the server
 * actions, so the browser and the server never disagree about what is valid.
 */

/**
 * What makes a password acceptable, as data.
 *
 * The signup form ticks these off live as they are typed, and the schema below
 * is built from the same list, so the checklist cannot end up promising
 * something the server then rejects.
 */
export const PASSWORD_RULES = [
  {
    label: "At least 8 characters",
    message: "Password must be at least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    label: "One letter",
    message: "Include at least one letter",
    test: (value: string) => /[a-zA-Z]/.test(value),
  },
  {
    label: "One number",
    message: "Include at least one number",
    test: (value: string) => /[0-9]/.test(value),
  },
] as const;

/**
 * A new password. 72 characters is the cap because bcrypt-style limits are a
 * common surprise and there is no reason to let someone set a password that
 * some later change might silently truncate.
 */
const newPassword = z
  .string()
  .max(72, "Password is too long")
  .superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) {
        ctx.addIssue({ code: "custom", message: rule.message });
      }
    }
  });

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name is too long"),
    email: z.email("Enter a valid email address").trim().toLowerCase(),
    password: newPassword,
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

/** Asking for a reset link. */
export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

/** Setting a new password from a link. Same rules as signing up. */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This link is incomplete"),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

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

/**
 * An image reference: an external URL, or a path to a file this site serves.
 *
 * Two local folders are allowed, and they are different things:
 *   /uploads/…   written at runtime by the upload action. Gitignored, so it
 *                exists only on the machine that received it.
 *   /products/…  committed to the repository, so it ships with a deploy.
 *
 * Both are matched by an explicit pattern rather than "any path", so a value
 * like `/../../etc/passwd` or a `javascript:` URL cannot get through.
 */
const imageRef = z.union([
  z.url("Enter a valid image URL"),
  z.string().regex(/^\/(uploads|products)\/[A-Za-z0-9._-]+$/, "Enter a valid image URL"),
  z.literal(""),
]);

/**
 * A product video. Same two shapes as an image — a hosted URL, or a file this
 * site serves — and empty for the usual case of a product without one.
 *
 * Matched by an explicit pattern rather than "any path" for the same reason as
 * `imageRef`: this value ends up in a `src` attribute, so `javascript:` and
 * `../..` must not be able to get through.
 */
const videoRef = z.union([
  z.url("Enter a valid video URL"),
  z.string().regex(/^\/uploads\/[A-Za-z0-9._-]+$/, "Enter a valid video URL"),
  z.literal(""),
]);

/** Badges the shop can put on a product. Empty string means none. */
export const PRODUCT_BADGES = ["New", "Bestseller", "Trending", "Premium", "Sale"] as const;

export const variantSchema = z.object({
  color: z
    .string()
    .trim()
    .min(1, "Give the colour a name")
    .max(40, "Colour name is too long"),
  colorCode: z.union([
    z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #D8C3A5"),
    z.literal(""),
  ]),
  image: imageRef,
  images: z.array(imageRef).max(8, "Up to 8 extra images per colour"),
  stock: z.coerce
    .number<number>()
    .int("Use a whole number")
    .nonnegative("Stock cannot be negative")
    .max(100_000, "That looks wrong"),
});

export type VariantValues = z.infer<typeof variantSchema>;

export const productSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(140, "Name is too long"),
    description: z
      .string()
      .trim()
      .min(20, "Write at least 20 characters")
      .max(2000, "Keep it under 2000 characters"),
    category: z.string().trim().min(1, "Pick a category"),
    sku: z
      .string()
      .trim()
      .min(3, "SKU must be at least 3 characters")
      .max(40, "SKU is too long")
      .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, "Letters, numbers, spaces, - and _ only"),
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
    material: z.string().trim().max(120, "Too long").optional(),
    strapType: z.string().trim().max(120, "Too long").optional(),
    badge: z.union([z.enum(PRODUCT_BADGES), z.literal("")]).optional(),
    video: videoRef.optional(),
    featured: z.boolean().optional(),
    variants: z
      .array(variantSchema)
      .min(1, "Add at least one colour")
      .max(20, "Up to 20 colours per product"),
  })
  // Cross-field rules live here rather than in the action, so the form and the
  // server enforce exactly the same thing.
  .superRefine((value, ctx) => {
    if (
      value.compareAtPrice !== undefined &&
      value.compareAtPrice > 0 &&
      value.compareAtPrice <= value.price
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "Compare-at price must be higher than the price.",
      });
    }

    // Two variants of the same colour would make the swatches ambiguous and the
    // cart line identity non-unique.
    const seen = new Map<string, number>();
    value.variants.forEach((variant, index) => {
      const key = variant.color.trim().toLowerCase();
      const first = seen.get(key);
      if (first === undefined) {
        seen.set(key, index);
        return;
      }
      ctx.addIssue({
        code: "custom",
        path: ["variants", index, "color"],
        message: `"${variant.color}" is already listed`,
      });
    });
  });

/**
 * What the server works with after parsing: numbers are numbers.
 */
export type ProductValues = z.output<typeof productSchema>;

/**
 * What the form holds. Number inputs hand back strings, and `z.coerce` turns
 * them into numbers at parse time, so the form's type is the schema's *input*
 * type rather than its output.
 */
export type ProductFormValues = z.input<typeof productSchema>;

/** Slug used for the product URL, derived from its name. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
