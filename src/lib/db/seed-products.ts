import type { Category, Product, ProductVariant } from "@/types";

/**
 * The shop's catalogue, loaded by `npm run seed`.
 *
 * One category, one product. Everything that only makes sense with a choice —
 * the homepage category section, the shop's category pills — reads the database
 * and hides itself until there is more than one, so adding the second category
 * or product needs no code change.
 */
export const seedCategories: Category[] = [{ slug: "ladies-bags", name: "Ladies Bags" }];

/**
 * All five colours currently point at the same photograph, because that is the
 * only one supplied and it shows the whole range together. Selecting a colour
 * therefore will not visibly change the picture until a per-colour shot is
 * uploaded for each one from Admin -> Products -> Edit. Everything else about
 * the colour — the swatch, the stock, the cart line, the order — already works
 * per colour.
 *
 * It lives in /public/products rather than /public/uploads because uploads are
 * gitignored: they exist only on the machine that received them, so a deploy
 * would have nothing to serve. Anything that is part of the shop itself has to
 * be committed.
 */
const RANGE_PHOTO =
  "https://res.cloudinary.com/dqr5v3cpa/image/upload/f_auto,q_auto/v1791562953/smartshop/he3rxym5hrfrjohlcaho.png";

function variant(color: string, colorCode: string, stock: number): ProductVariant {
  return { color, colorCode, image: RANGE_PHOTO, images: [], stock };
}

const ADDED_AT = "2026-10-08T00:00:00.000Z";

export const seedProducts: Product[] = [
  {
    id: "p-001",
    slug: "sant-laurent-branded-hand-bags-for-girls",
    sku: "SS-BAG-001",
    name: "SANT LAURENT BRANDED HAND BAGS FOR GIRLS",
    description:
      "Elegant and stylish women's handbag featuring a premium-look design, soft material, spacious interior, and a convenient long shoulder strap. Lightweight and easy to carry, making it suitable for casual outings, shopping, and everyday use.",
    price: 4000,
    // No compareAtPrice on purpose. A struck-through price is a claim that the
    // bag genuinely sold at that figure; inventing one to manufacture a
    // discount is the same problem as inventing reviews. Set it from the admin
    // panel if there is a real previous price.
    category: "ladies-bags",
    material: "Soft quilted material",
    strapType: "Long detachable shoulder strap",
    badge: "New",
    featured: true,
    // Hex codes read off the supplied photograph. Five per colour is a
    // deliberately modest opening figure: listing more than is actually in hand
    // means taking orders that cannot be filled, which costs more than a
    // sold-out badge does. Raise it from the admin panel once the real count is
    // known.
    variants: [
      variant("Beige", "#c2ad99", 5),
      variant("Pink", "#f2b8c6", 5),
      variant("White", "#f3f1ee", 5),
      variant("Black", "#1f1f1f", 5),
      variant("Grey", "#b9bdc2", 5),
    ],
    // Mirrors of the variants, kept in step by the repository on every write.
    image: RANGE_PHOTO,
    stock: 25,
    // No invented reviews: the Rating component draws nothing while these are 0.
    rating: 0,
    reviewCount: 0,
    createdAt: ADDED_AT,
    updatedAt: ADDED_AT,
  },
];
