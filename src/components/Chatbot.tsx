"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { discountPercent, formatPrice } from "@/lib/format";
import { useAuthUser } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useUIStore } from "@/stores/ui";
import {
  buildChatRequestMessages,
  chatResponseSchema,
  type AssistantProduct,
  type ChatMessage as RequestChatMessage,
} from "@/lib/ai/contracts";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  products?: AssistantProduct[];
  actionHref?: string;
  actionLabel?: string;
  retryText?: string;
};

const QUICK_QUESTIONS = [
  "Show me handbags under PKR 3,000",
  "Mujhe black bag chahiye",
  "Delivery charges kitne hain?",
  "Return policy kya hai?",
];

function ShoppingProductCard({ product }: { product: AssistantProduct }) {
  const router = useRouter();
  const user = useAuthUser();
  const addItem = useCartStore((state) => state.addItem);
  const showToast = useUIStore((state) => state.showToast);
  const openCart = useUIStore((state) => state.openCart);
  const firstAvailable = product.colors.find((color) => color.inStock) ?? product.colors[0];
  const [color, setColor] = useState(firstAvailable?.name ?? "");
  const selected = product.colors.find((entry) => entry.name === color) ?? firstAvailable;
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? discountPercent(product.price, product.compareAtPrice)
      : null;

  function addSelectedProduct() {
    if (!selected?.inStock) return;
    if (!user) {
      const back = window.location.pathname + window.location.search;
      showToast("Sign in to add items", "You will return here after signing in");
      router.push(`/login?next=${encodeURIComponent(back)}`);
      return;
    }

    const cartColor = selected.name;
    const stockBefore = useCartStore
      .getState()
      .lines.find((line) => line.productId === product.id && line.color === cartColor)?.quantity ?? 0;
    addItem(product.id, cartColor);
    const stockAfter = useCartStore
      .getState()
      .lines.find((line) => line.productId === product.id && line.color === cartColor)?.quantity ?? 0;
    if (stockAfter === stockBefore) {
      showToast("Stock changed", "Please refresh the page and try again.");
      return;
    }
    showToast("Added to cart", `${product.name}${cartColor ? ` · ${cartColor}` : ""}`);
    openCart();
  }

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface-raised">
      <div className="flex gap-3 p-3">
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${product.name}`}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-sunken"
        >
          {selected?.image || product.image ? (
            <Image
              src={selected?.image || product.image}
              alt={product.name}
              fill
              sizes="80px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-muted">
              SmartShop
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/products/${product.slug}`}
            className="line-clamp-2 text-sm font-semibold hover:text-brand-700"
          >
            {product.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{formatPrice(product.price)}</span>
            {discount !== null && product.compareAtPrice && (
              <>
                <span className="text-xs text-muted line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
                <span className="text-xs font-medium text-accent-700">{discount}% off</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            {selected?.inStock ? `In stock${selected.stock ? ` · ${selected.stock} available` : ""}` : "Out of stock"}
          </p>
        </div>
      </div>

      <p className="line-clamp-2 px-3 text-xs leading-relaxed text-muted">{product.description}</p>

      <div className="flex flex-wrap items-center gap-2 p-3 pt-2">
        {product.colors.length > 1 && (
          <label className="min-w-0 flex-1">
            <span className="sr-only">Choose a color for {product.name}</span>
            <select
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-2 py-2 text-xs"
            >
              {product.colors.map((variant, index) => (
                <option key={`${variant.name}-${index}`} value={variant.name}>
                  {variant.name || "Default"} — {variant.inStock ? "In stock" : "Sold out"}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={addSelectedProduct}
          disabled={!selected?.inStock}
          className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted"
        >
          {selected?.inStock ? "Add to cart" : "Sold out"}
        </button>
        <Link
          href={`/products/${product.slug}`}
          className="rounded-lg border border-line px-3 py-2 text-xs font-medium transition hover:border-brand-400"
        >
          View product
        </Link>
      </div>
      {product.colors.length > 0 && (
        <p className="px-3 pb-3 text-[11px] text-muted">
          Colors: {product.colors.map((variant) => variant.name || "Default").join(", ")}
        </p>
      )}
    </li>
  );
}

export function Chatbot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      text: "Hi! I’m the SmartShop AI Assistant. Tell me what you’re looking for, or ask about delivery, payment, and returns.",
    },
  ]);
  const nextId = useRef(1);
  const messagesContainer = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const container = messagesContainer.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function submitMessage(value: string, retry = false) {
    const text = value.trim();
    if (!text || pending) return;

    const base = retry ? messages.slice(0, -1) : messages;
    const current = retry
      ? base
      : [
          ...base,
          { id: nextId.current++, role: "user" as const, text },
        ];
    if (!retry) setMessages(current);
    setInput("");
    setPending(true);

    const history = retry ? current.slice(0, -1) : base;
    const requestHistory: RequestChatMessage[] = history.map((message) => ({
      role: message.role,
      text: message.text,
      ...(message.role === "assistant" && message.products
        ? { products: message.products.map(({ id, name }) => ({ id, name })) }
        : {}),
    }));
    const requestMessages = buildChatRequestMessages(requestHistory, text);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
      });
      const json: unknown = await response.json();
      if (!response.ok) {
        const providerError =
          typeof json === "object" &&
          json !== null &&
          "error" in json &&
          typeof json.error === "object" &&
          json.error !== null &&
          "message" in json.error &&
          typeof json.error.message === "string"
            ? json.error.message
            : "The assistant could not reply right now.";
        throw new Error(providerError);
      }

      const parsed = chatResponseSchema.safeParse(json);
      if (!parsed.success) throw new Error("The assistant returned an invalid response.");
      setMessages((existing) => [
        ...existing,
        {
          id: nextId.current++,
          role: "assistant",
          text: parsed.data.message,
          products: parsed.data.products,
          ...( /\b(order|orders|tracking|track|status|parcel)\b/i.test(text)
            ? { actionHref: "/account/orders", actionLabel: "Go to My orders" }
            : {}),
        },
      ]);
    } catch (error) {
      setMessages((existing) => [
        ...existing,
        {
          id: nextId.current++,
          role: "assistant",
          text: error instanceof Error ? error.message : "The assistant could not reply right now.",
          retryText: text,
        },
      ]);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(input);
  }

  if (pathname === "/checkout") return null;

  return (
    <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-50 flex flex-col items-end gap-3 sm:right-6">
      {open && (
        <section
          aria-label="SmartShop AI Assistant chat"
          className="pointer-events-auto flex h-[min(34rem,calc(100dvh-9rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-2xl shadow-black/15"
        >
          <header className="flex items-center justify-between border-b border-line bg-brand-700 px-4 py-3 text-white">
            <div>
              <h2 className="font-semibold">SmartShop AI Assistant</h2>
              <p className="text-xs text-white/75">Product help, in English and Urdu</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-lg p-2 text-white/90 transition hover:bg-white/15 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div
            ref={messagesContainer}
            aria-live="polite"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  role={message.retryText ? "alert" : undefined}
                  className={`max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    message.role === "user"
                      ? "rounded-br-md bg-brand-600 text-white"
                      : "rounded-bl-md bg-surface-sunken text-ink"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.retryText && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void submitMessage(message.retryText!, true)}
                      className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:border-brand-400 disabled:opacity-50"
                    >
                      Try again
                    </button>
                  )}
                  {message.actionHref && message.actionLabel && (
                    <Link
                      href={message.actionHref}
                      onClick={() => setOpen(false)}
                      className="mt-2 inline-flex font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
                    >
                      {message.actionLabel}
                    </Link>
                  )}
                  {message.products && message.products.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {message.products.map((product) => (
                        <ShoppingProductCard key={product.id} product={product} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start" role="status" aria-label="Assistant is thinking">
                <div className="rounded-2xl rounded-bl-md bg-surface-sunken px-4 py-3 text-sm text-muted">
                  <span className="animate-pulse">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 border-t border-line px-3 py-3">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={pending}
                  onClick={() => void submitMessage(question)}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-line p-3">
            <label className="sr-only" htmlFor="smartshop-chat-message">
              Message the SmartShop AI Assistant
            </label>
            <textarea
              ref={inputRef}
              id="smartshop-chat-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage(input);
                }
              }}
              placeholder="Ask about a product..."
              maxLength={600}
              rows={1}
              className="max-h-24 min-h-10 min-w-0 flex-1 resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition placeholder:text-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M4 12 20 4l-5 16-3-7-8-1Zm8 1 8-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
          <p className="px-3 pb-2 text-center text-[10px] text-muted">
            Chat messages are processed by Google’s AI service.
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close chat" : "Open SmartShop AI Assistant"}
        aria-expanded={open}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-brand-700 px-4 py-3 font-medium text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.5-3A7.5 7.5 0 1 1 20 11.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M8.5 11.5h7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
        <span className="text-sm">{open ? "Close chat" : "Chat with us"}</span>
      </button>
    </div>
  );
}
