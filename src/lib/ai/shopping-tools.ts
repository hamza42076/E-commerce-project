import "server-only";
import { Type, type FunctionDeclaration } from "@google/genai";
import { z } from "zod";
import { getProductById, getProductsByIds, searchProductsForAssistant } from "@/lib/db/products";
import { variantList } from "@/lib/products/variants";
import { STORE_POLICIES } from "@/lib/store-policy";
import type { AssistantProduct } from "./contracts";
import type { Product } from "@/types";

const searchProductsSchema = z
  .object({
    keywords: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    minPrice: z.number().int().min(0).max(10_000_000).optional(),
    maxPrice: z.number().int().min(0).max(10_000_000).optional(),
    color: z.string().trim().min(1).max(40).optional(),
    inStockOnly: z.boolean().optional(),
    material: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.minPrice === undefined ||
      input.maxPrice === undefined ||
      input.minPrice <= input.maxPrice,
    { message: "Minimum price must not exceed maximum price." },
  );

const productIdSchema = z.object({ productId: z.string().trim().min(1).max(128) }).strict();
const compareProductsSchema = z
  .object({
    productIds: z.array(z.string().trim().min(1).max(128)).min(2).max(3),
  })
  .strict();
const policySchema = z.object({
  topic: z.enum(["shipping", "payment", "returns", "accounts", "cart", "support"]),
}).strict();

const productSearchDeclaration: FunctionDeclaration = {
  name: "searchProducts",
  description:
    "Search the real store catalog using product keywords, category slug, PKR price bounds, color, material, and stock availability. Returns at most six matches. Use for product discovery, budget filtering, and follow-up constraints.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "A few meaningful product, feature, or category keywords.",
      },
      category: { type: Type.STRING, description: "Exact category slug, if known." },
      minPrice: { type: Type.INTEGER, description: "Minimum unit price in PKR." },
      maxPrice: { type: Type.INTEGER, description: "Maximum unit price in PKR." },
      color: { type: Type.STRING, description: "Requested color name." },
      inStockOnly: { type: Type.BOOLEAN, description: "Whether only buyable products are wanted." },
      material: { type: Type.STRING, description: "Material requested, if applicable." },
    },
  },
};

const detailsDeclaration: FunctionDeclaration = {
  name: "getProductDetails",
  description: "Read verified customer-facing details for one catalog product by its exact ID.",
  parameters: {
    type: Type.OBJECT,
    properties: { productId: { type: Type.STRING } },
    required: ["productId"],
  },
};

const variantsDeclaration: FunctionDeclaration = {
  name: "getAvailableVariants",
  description:
    "Read configured colors and current availability for one product. Includes legacy single-stock products.",
  parameters: {
    type: Type.OBJECT,
    properties: { productId: { type: Type.STRING } },
    required: ["productId"],
  },
};

const compareDeclaration: FunctionDeclaration = {
  name: "compareProducts",
  description:
    "Compare two or three exact catalog product IDs using verified price, material, features, colors, and stock.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Two or three product IDs returned by a prior search.",
      },
    },
    required: ["productIds"],
  },
};

const policyDeclaration: FunctionDeclaration = {
  name: "getStorePolicy",
  description:
    "Look up verified SmartShop shipping, payment, returns, account, cart, or customer-support guidance.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: {
        type: Type.STRING,
        enum: ["shipping", "payment", "returns", "accounts", "cart", "support"],
      },
    },
    required: ["topic"],
  },
};

export const SHOPPING_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  productSearchDeclaration,
  detailsDeclaration,
  variantsDeclaration,
  compareDeclaration,
  policyDeclaration,
];

export type AssistantToolResult = {
  output: unknown;
  products: AssistantProduct[];
};

function toAssistantProduct(product: Product): AssistantProduct {
  const variants = variantList(product);
  const stock = variants.reduce((sum, variant) => sum + variant.stock, 0);
  const defaultImage =
    variants.find((variant) => variant.stock > 0)?.image ?? variants[0]?.image ?? "";

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    ...(product.compareAtPrice && product.compareAtPrice > product.price
      ? { compareAtPrice: product.compareAtPrice }
      : {}),
    category: product.category,
    ...(product.material ? { material: product.material } : {}),
    features: product.strapType ? [product.strapType] : [],
    image: defaultImage,
    stock,
    inStock: stock > 0,
    colors: variants.map((variant) => ({
      name: variant.color,
      image: variant.image,
      stock: variant.stock,
      inStock: variant.stock > 0,
    })),
  };
}

function missingProduct(): AssistantToolResult {
  return { output: { found: false }, products: [] };
}

export async function executeShoppingTool(
  name: string,
  rawArgs: unknown,
): Promise<AssistantToolResult> {
  switch (name) {
    case "searchProducts": {
      const args = searchProductsSchema.parse(rawArgs);
      const products = await searchProductsForAssistant(args, 6);
      const summaries = products.map(toAssistantProduct);
      return { output: { products: summaries }, products: summaries };
    }
    case "getProductDetails": {
      const { productId } = productIdSchema.parse(rawArgs);
      const product = await getProductById(productId);
      if (!product) return missingProduct();
      const summary = toAssistantProduct(product);
      return { output: { product: summary }, products: [summary] };
    }
    case "getAvailableVariants": {
      const { productId } = productIdSchema.parse(rawArgs);
      const product = await getProductById(productId);
      if (!product) return missingProduct();
      const summary = toAssistantProduct(product);
      return {
        output: {
          productId: product.id,
          productName: product.name,
          variants: summary.colors,
        },
        products: [summary],
      };
    }
    case "compareProducts": {
      const { productIds } = compareProductsSchema.parse(rawArgs);
      const products = await getProductsByIds([...new Set(productIds)]);
      const summaries = products.map(toAssistantProduct);
      return {
        output: { products: summaries, missingProductIds: productIds.filter(
          (id) => !products.some((product) => product.id === id),
        ) },
        products: summaries,
      };
    }
    case "getStorePolicy": {
      const { topic } = policySchema.parse(rawArgs);
      return { output: { topic, policy: STORE_POLICIES[topic] }, products: [] };
    }
    default:
      throw new Error("Unknown shopping tool.");
  }
}
