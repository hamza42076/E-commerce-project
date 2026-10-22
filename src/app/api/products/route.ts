import { createProduct, getProducts } from "@/lib/db/products";
import { productSchema, slugify } from "@/lib/validation";
import { getBearerUser } from "@/lib/api/guard";
import {
  created,
  fail,
  forbidden,
  invalid,
  ok,
  readJson,
  unauthorized,
} from "@/lib/api/response";
import type { ProductQuery } from "@/types";

const SORTS = new Set(["featured", "price-asc", "price-desc", "rating"]);

/**
 * GET /api/products?q=&category=&sort=
 *
 * Public. 200 -> { data: { products, count } }
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const sort = params.get("sort");

  const query: ProductQuery = {
    search: params.get("q") ?? undefined,
    category: params.get("category") ?? undefined,
    sort: SORTS.has(sort ?? "") ? (sort as ProductQuery["sort"]) : "featured",
  };

  const products = await getProducts(query);
  return ok({ products, count: products.length });
}

/**
 * POST /api/products
 *
 * Admin only. Body is the same shape the admin form submits.
 * 201 -> { data: { product } }
 * 409 -> a product with that name (and so that slug) already exists
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await getBearerUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "admin") return forbidden();

  const body = await readJson(request);
  if (body === null) return fail("Send a JSON body.", 400);

  // Same schema the admin form uses, including the compare-at-price rule and
  // the duplicate-colour rule, so the two routes cannot accept different things.
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error);

  const values = parsed.data;

  const result = await createProduct(
    {
      name: values.name,
      description: values.description,
      category: values.category,
      sku: values.sku,
      price: values.price,
      compareAtPrice:
        values.compareAtPrice && values.compareAtPrice > 0 ? values.compareAtPrice : undefined,
      material: values.material?.trim() || undefined,
      strapType: values.strapType?.trim() || undefined,
      badge: values.badge ? values.badge : null,
      featured: values.featured ?? false,
      variants: values.variants.map((variant) => ({
        ...variant,
        images: [...new Set([variant.image, ...variant.images].filter(Boolean))],
      })),
    },
    slugify(values.name),
  );

  if (!result.ok) return fail("This SKU is already in use.", 409);

  return created({ product: result.product });
}
