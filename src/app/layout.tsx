import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreHydrator } from "@/components/StoreHydrator";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { Toaster } from "@/components/Toaster";
import { getAllProducts } from "@/lib/db/products";
import { getSession } from "@/lib/auth/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SmartShop — Online Store",
    template: "%s · SmartShop",
  },
  description:
    "Ladies bags — totes, crossbodies, satchels and clutches. A small, carefully picked catalogue delivered across Pakistan.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Fetched here so the cart can turn stored product ids into full products.
  const [catalogue, session] = await Promise.all([getAllProducts(), getSession()]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* No providers: state lives in zustand stores, which components
            import directly. This only pushes in what the server knows. */}
        <StoreHydrator
          catalogue={catalogue}
          user={
            session
              ? { name: session.name, email: session.email, role: session.role }
              : null
          }
        />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartDrawer />
        <Toaster />
      </body>
    </html>
  );
}
