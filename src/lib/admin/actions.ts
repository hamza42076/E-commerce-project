"use server";

import { revalidatePath } from "next/cache";
import { productSchema, slugify } from "@/lib/validation";
import { createProduct, deleteProduct } from "@/lib/db/products";
import { updateOrderStatus } from "@/lib/db/orders";
import { getSession } from "@/lib/auth/session";
import type { OrderStatus } from "@/types";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const ORDER_STATUSES: OrderStatus[] = ["pending", "shipped", "delivered", "cancelled"];

/**
 * Every action here re-checks the session role. The admin layout also guards the
 * routes, but a server action is its own HTTP endpoint and has to stand alone.
 */
async function requireAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "admin";
}

export async function createProductAction(values: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) {
    return { ok: false, message: "You do not have permission to do that." };
  }

  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Check the form and try again." };
  }

  const { name, description, price, compareAtPrice, category, image, stock, featured } =
    parsed.data;

  if (compareAtPrice !== undefined && compareAtPrice > 0 && compareAtPrice <= price) {
    return { ok: false, message: "Compare-at price must be higher than the price." };
  }

  const product = await createProduct({
    slug: slugify(name),
    name,
    description,
    price,
    compareAtPrice: compareAtPrice && compareAtPrice > 0 ? compareAtPrice : undefined,
    category,
    image: image ?? "",
    stock,
    featured: featured ?? false,
  });

  if (!product) {
    return { ok: false, message: "A product with that name already exists." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true, message: `"${product.name}" added.` };
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

  const updated = await updateOrderStatus(id, status as OrderStatus);
  if (!updated) return { ok: false, message: "That order no longer exists." };

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true, message: `Order marked ${status}.` };
}
