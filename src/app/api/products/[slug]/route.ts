import { deleteProduct, getProductBySlug, getRelatedProducts } from "@/lib/db/products";
import { getBearerUser } from "@/lib/api/guard";
import { forbidden, notFound, ok, unauthorized } from "@/lib/api/response";

type Context = { params: Promise<{ slug: string }> };

/**
 * GET /api/products/[slug]
 *
 * Public. 200 -> { data: { product, related } }
 */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const { slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product) return notFound("No product with that slug.");

  const related = await getRelatedProducts(product);
  return ok({ product, related });
}

/**
 * DELETE /api/products/[slug]
 *
 * Admin only. Takes the slug rather than the internal id so the URL matches
 * the one used to read the product.
 * 200 -> { data: { deleted: true } }
 */
export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const payload = getBearerUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "admin") return forbidden();

  const { slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product) return notFound("No product with that slug.");

  const removed = await deleteProduct(product.id);
  if (!removed) return notFound("That product no longer exists.");

  return ok({ deleted: true, slug });
}
