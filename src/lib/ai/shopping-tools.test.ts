import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchProductsForAssistant } from "@/lib/db/products";
import { executeShoppingTool } from "./shopping-tools";

beforeEach(() => {
  vi.stubEnv("MONGODB_URI", "");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shopping assistant catalog tools", () => {
  it("filters by keyword, maximum price, and color and caps results at six", async () => {
    const products = await searchProductsForAssistant({
      keywords: ["bag"],
      maxPrice: 4000,
      color: "Black",
      inStockOnly: true,
    });

    expect(products.length).toBeGreaterThan(0);
    expect(products.length).toBeLessThanOrEqual(6);
    expect(products.every((product) => product.price <= 4000)).toBe(true);
    expect(
      products.every((product) =>
        product.variants.some((variant) => variant.color.toLowerCase().includes("black")),
      ),
    ).toBe(true);
  });

  it("returns verified variant colors and current availability", async () => {
    const result = await executeShoppingTool("getAvailableVariants", { productId: "p-001" });
    const output = result.output as {
      variants: Array<{ name: string; stock: number; inStock: boolean }>;
    };

    expect(output.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Black", stock: 5, inStock: true }),
      ]),
    );
  });

  it("compares only existing products and marks missing IDs", async () => {
    const result = await executeShoppingTool("compareProducts", {
      productIds: ["p-001", "does-not-exist"],
    });

    expect(result.products).toHaveLength(1);
    expect(result.output).toMatchObject({ missingProductIds: ["does-not-exist"] });
  });

  it("looks up verified store policy facts", async () => {
    const result = await executeShoppingTool("getStorePolicy", { topic: "shipping" });

    expect(result.output).toMatchObject({
      topic: "shipping",
      policy: {
        freeDeliveryThreshold: 5000,
        deliveryFee: 250,
        deliveryWindow: "2-4 working days",
      },
    });
  });

  it("rejects malformed tool arguments and unknown tools", async () => {
    await expect(
      executeShoppingTool("searchProducts", { minPrice: 5000, maxPrice: 1000 }),
    ).rejects.toThrow();
    await expect(executeShoppingTool("rawMongoQuery", {})).rejects.toThrow(
      "Unknown shopping tool.",
    );
  });
});
