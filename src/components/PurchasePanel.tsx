"use client";

import { useState } from "react";
import { QuantityStepper } from "./QuantityStepper";
import { AddToCartButton } from "./AddToCartButton";
import type { Product } from "@/types";

export function PurchasePanel({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);

  if (product.stock < 1) {
    return <AddToCartButton product={product} className="w-full" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <QuantityStepper
        value={quantity}
        max={product.stock}
        onChange={(next) => setQuantity(Math.max(1, Math.min(next, product.stock)))}
      />
      <AddToCartButton
        product={product}
        quantity={quantity}
        revealCart
        className="flex-1 py-3"
      />
    </div>
  );
}
