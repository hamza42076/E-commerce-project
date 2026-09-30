/** Delivery rules, shared by the cart page and the cart drawer. */
export const FREE_DELIVERY_THRESHOLD = 5000;
export const DELIVERY_FEE = 250;

export function deliveryFeeFor(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
}
