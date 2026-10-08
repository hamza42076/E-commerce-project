import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckoutForm } from "./CheckoutForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const session = await getSession();

  // Orders need an account. placeOrderAction enforces the same rule, so this
  // is here to send people somewhere useful rather than to protect anything.
  if (!session) redirect("/login?next=/checkout");

  return (
    <CheckoutForm defaults={{ fullName: session.name, email: session.email }} />
  );
}
