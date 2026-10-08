import { getCategories } from "@/lib/db/products";
import { ok } from "@/lib/api/response";

/**
 * GET /api/categories
 *
 * Public. 200 -> { data: { categories } }
 */
export async function GET(): Promise<Response> {
  const categories = await getCategories();
  return ok({ categories });
}
