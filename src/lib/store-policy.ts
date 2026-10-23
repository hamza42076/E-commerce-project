import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from "@/lib/shipping";

export const STORE_POLICIES = {
  shipping: {
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    deliveryFee: DELIVERY_FEE,
    deliveryWindow: "2-4 working days",
    rule: "Free delivery applies when the order subtotal is at least Rs 5,000.",
  },
  payment: {
    method: "Cash on Delivery (COD)",
  },
  returns: {
    window: "7 days",
    condition: "unopened items",
    wording: "7-day returns for unopened items.",
  },
  accounts: {
    shopping: "An account is required to add items to the cart and place an order.",
    orders: "Customers can view their own order status from My orders after signing in.",
  },
  cart: {
    behavior: "The cart stores product, selected color, and quantity. Checkout rechecks price and stock.",
  },
  support: {
    contact:
      "No public support email or phone number is listed on the storefront. Customers with an order email can reply to that email for help.",
  },
} as const;

export type StorePolicyTopic = keyof typeof STORE_POLICIES;
