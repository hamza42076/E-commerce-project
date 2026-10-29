"use server";

import { revalidatePath } from "next/cache";
import { productSchema, slugify, type ProductValues } from "@/lib/validation";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  type ProductInput,
} from "@/lib/db/products";
import { changeOrderStatus, collectCodPayment } from "@/lib/orders/update-status";
import { ORDER_STATUSES } from "@/lib/orders/status";
import { getSession } from "@/lib/auth/session";
import type { OrderStatus } from "@/types";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Every action here re-checks the session role. The admin layout also guards the
 * routes, but a server action is its own HTTP endpoint and has to stand alone.
 */
async function requireAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "admin";
}

/**
 * Turns validated form values into the repository's input shape. Field names
 * carry straight through — the form, the schema, this, the document and the
 * storefront all call them the same thing.
 */
function toProductInput(values: ProductValues): ProductInput {
  return {
    name: values.name,
    description: values.description,
    category: values.category,
    sku: values.sku,
    price: values.price,
    // 0 and "no discount" are the same thing; store neither.
    compareAtPrice:
      values.compareAtPrice && values.compareAtPrice > 0 ? values.compareAtPrice : undefined,
    material: values.material?.trim() || undefined,
    strapType: values.strapType?.trim() || undefined,
    badge: values.badge ? values.badge : null,
    // An empty field means no video, stored as absent rather than as "".
    video: values.video?.trim() || undefined,
    featured: values.featured ?? false,
    variants: values.variants.map((variant) => {
      // The main image belongs at the front of the gallery, once.
      const gallery = [variant.image, ...variant.images].filter(Boolean);
      return {
        color: variant.color,
        colorCode: variant.colorCode,
        image: variant.image,
        images: [...new Set(gallery)],
        stock: variant.stock,
      };
    }),
  };
}

/** Pages that show product data and need rebuilding after a write. */
function revalidateProductPages(slug?: string): void {
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
}

export async function createProductAction(values: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) {
    return { ok: false, message: "You do not have permission to do that." };
  }

  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Please check the product information." };
  }

  const result = await createProduct(toProductInput(parsed.data), slugify(parsed.data.name));

  if (!result.ok) {
    return { ok: false, message: "This SKU is already in use." };
  }

  revalidateProductPages(result.product.slug);
  return { ok: true, message: `"${result.product.name}" added.` };
}

export async function updateProductAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  if (!(await requireAdmin())) {
    return { ok: false, message: "You do not have permission to do that." };
  }

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, message: "That product no longer exists." };
  }

  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Please check the product information." };
  }

  const result = await updateProduct(id, toProductInput(parsed.data), slugify(parsed.data.name));

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "sku-taken"
          ? "This SKU is already in use."
          : "That product no longer exists.",
    };
  }

  revalidateProductPages(result.product.slug);
  return { ok: true, message: `"${result.product.name}" saved.` };
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) {
    return { ok: false, message: "You do not have permission to do that." };
  }

  const removed = await deleteProduct(id);
  if (!removed) return { ok: false, message: "That product no longer exists." };

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true, message: "Product deleted." };
}

export async function updateOrderStatusAction(
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) {
    return { ok: false, message: "You do not have permission to do that." };
  }

  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    return { ok: false, message: "Unknown status." };
  }

  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in again." };

  const result = await changeOrderStatus(id, status as OrderStatus, session.userId);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  return {
    ok: true,
    message: result.emailQueued
      ? `Order marked ${status}. A status email was queued; delivery requires working SMTP settings.`
      : `Order was already ${status}.`,
  };
}

export async function collectCodPaymentAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) {
    return { ok: false, message: "You do not have permission to do that." };
  }
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, message: "That order no longer exists." };
  }

  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in again." };

  const result = await collectCodPayment(id, session.userId);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not-found"
          ? "That order no longer exists."
            : result.reason === "failed"
              ? "Could not record this payment. Please try again."
              : "COD can only be marked collected after the order is delivered.",
    };
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return {
    ok: true,
    message: result.alreadyPaid ? "COD payment was already recorded." : "COD payment recorded.",
  };
}
