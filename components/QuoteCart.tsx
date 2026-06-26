"use client";

import {
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { QuoteItem } from "@/lib/quote-types";

type PendingItem = Omit<QuoteItem, "qty">;

type CartContextValue = {
  items: QuoteItem[];
  count: number;
  beginAdd: (item: PendingItem) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "mmachine-quote-cart";

const money = (value: number | null) =>
  value === null ? "POA" : `\u00a3${value.toFixed(2)}`;

const itemLabel = (item: QuoteItem | PendingItem) =>
  item.catalogue === "custom"
    ? item.custom?.projectName || item.description
    : item.catalogue === "metals"
    ? [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ")
    : item.description;

export function useQuoteCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useQuoteCart must be used inside QuoteCartProvider");
  return ctx;
}

export function OrderButton({
  item,
  className = "",
}: {
  item: PendingItem;
  className?: string;
}) {
  const { beginAdd } = useQuoteCart();
  return (
    <button
      type="button"
      onClick={() => beginAdd(item)}
      className={`inline-flex h-8 min-w-[68px] items-center justify-center rounded-md bg-gold px-2.5 text-sm font-semibold leading-none text-cream transition hover:bg-gold-light ${className}`}
    >
      Order
    </button>
  );
}

export default function QuoteCartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [pending, setPending] = useState<PendingItem | null>(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [arrangeOwnDelivery, setArrangeOwnDelivery] = useState(false);
  const [success, setSuccess] = useState<{ quoteId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const showCartUi = !pathname?.startsWith("/dashboard");

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : 0),
        0
      ),
    [items]
  );

  function beginAdd(item: PendingItem) {
    setPending(item);
    setPendingQty(1);
  }

  function confirmPending() {
    if (!pending) return;
    setItems((current) => {
      const existing = current.findIndex((item) => item.key === pending.key);
      if (existing >= 0) {
        return current.map((item, index) =>
          index === existing ? { ...item, qty: item.qty + pendingQty } : item
        );
      }
      return [...current, { ...pending, qty: pendingQty }];
    });
    setPending(null);
    setMessage("");
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setMessage("");
    if (success) setSuccess(null);
  }

  function updateQty(key: string, qty: number) {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, qty: Math.max(1, Math.min(999, qty)) } : item
      )
    );
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;

    setSubmitting(true);
    setMessage("");
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const address = String(form.get("address") ?? "").trim();

    if (!arrangeOwnDelivery && !address) {
      setMessage("Please enter a delivery address, or tick the collection / own delivery option.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone"),
            company: form.get("company"),
            address,
            arrangeOwnDelivery,
            message: form.get("message"),
          },
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quote request failed");
      formEl.reset();
      setItems([]);
      setArrangeOwnDelivery(false);
      setSuccess({ quoteId: data.quoteId });
    } catch (err) {
      setMessage((err as Error).message || "Quote request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CartContext.Provider value={{ items, count, beginAdd }}>
      {children}

      {showCartUi && count > 0 && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-12 items-center gap-2 rounded-full bg-racing px-5 text-sm font-semibold text-cream shadow-lg transition hover:bg-[#155040]"
        >
          Order Now
          <span className="rounded-full bg-gold px-2 py-0.5 text-xs text-cream">
            {count}
          </span>
        </button>
      )}

      {showCartUi && pending && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-racing-dark/55 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-ink-muted">Add to quote</div>
              <h2 className="mt-1 text-lg font-semibold text-racing">{itemLabel(pending)}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {money(pending.unitPriceExVat)} ex VAT
                {pending.unit ? ` / ${pending.unit}` : ""}
              </p>
            </div>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPendingQty((qty) => Math.max(1, qty - 1))}
                className="h-10 w-10 rounded-md border border-racing/20 text-lg text-racing"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={999}
                value={pendingQty}
                onChange={(e) => setPendingQty(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                className="input h-10 w-24 text-center"
              />
              <button
                type="button"
                onClick={() => setPendingQty((qty) => Math.min(999, qty + 1))}
                className="h-10 w-10 rounded-md border border-racing/20 text-lg text-racing"
              >
                +
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} className="btn-secondary py-2">
                Cancel
              </button>
              <button type="button" onClick={confirmPending} className="btn-primary py-2">
                Add to cart
              </button>
            </div>
          </div>
        </div>
      )}

      {showCartUi && drawerOpen && (
        <div className="fixed inset-0 z-[60] bg-racing-dark/40">
          <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-racing/10 p-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-muted">Quote request</div>
                <h2 className="font-display text-2xl text-racing">Cart</h2>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="h-9 w-9 rounded-md text-xl text-racing hover:bg-cream-dark"
                aria-label="Close quote cart"
              >
                x
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {success ? (
                <div className="flex min-h-full items-center justify-center">
                  <div className="w-full rounded-lg border border-racing/10 bg-cream-dark p-6 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-racing text-lg font-semibold text-cream">
                      OK
                    </div>
                    <h3 className="font-display text-2xl text-racing">Thanks for your request</h3>
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-ink-muted">
                      We will be in touch to confirm your order, agree delivery or collection, and arrange payment.
                    </p>
                    <div className="mt-4 rounded-md bg-white p-3 text-sm text-racing">
                      Order reference: <strong>{success.quoteId}</strong>
                    </div>
                    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <button type="button" onClick={closeDrawer} className="btn-primary justify-center">
                        Continue browsing
                      </button>
                      <Link href="/contact" onClick={closeDrawer} className="btn-secondary justify-center">
                        Contact M-Machine
                      </Link>
                    </div>
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-lg bg-cream-dark p-5 text-sm text-ink-muted">
                  Your quote cart is empty.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.key} className="rounded-lg border border-racing/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-racing">{itemLabel(item)}</div>
                          <div className="mt-1 text-xs text-ink-muted">
                            {item.code || item.shape} {item.unit ? `- ${item.unit}` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          className="text-xs text-ink-muted hover:text-racing"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-ink-muted">
                          Qty
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={item.qty}
                            onChange={(e) => updateQty(item.key, Number(e.target.value) || 1)}
                            className="input h-9 w-20 text-center"
                          />
                        </label>
                        <div className="text-right text-sm">
                          <div className="font-semibold text-racing">{money(item.unitPriceExVat)}</div>
                          <div className="text-xs text-ink-muted">each ex VAT</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!success && items.length > 0 && (
              <form onSubmit={submitQuote} className="mt-5 space-y-3 border-t border-racing/10 pt-5">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Name *</label>
                    <input name="name" required className="input" />
                  </div>
                  <div>
                    <label className="label">Company</label>
                    <input name="company" className="input" />
                  </div>
                  <div>
                    <label className="label">Email *</label>
                    <input name="email" type="email" required className="input" />
                  </div>
                  <div>
                    <label className="label">Phone *</label>
                    <input name="phone" required className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Delivery</label>
                  {!arrangeOwnDelivery && (
                    <textarea
                      name="address"
                      rows={4}
                      required
                      className="input resize-none"
                      placeholder="Full delivery address, including postcode"
                    />
                  )}
                  <label className="mt-3 flex items-start gap-3 rounded-lg border border-racing/10 bg-cream-dark p-3 text-sm text-racing">
                    <input
                      type="checkbox"
                      checked={arrangeOwnDelivery}
                      onChange={(e) => setArrangeOwnDelivery(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      I will arrange delivery / collection
                      <span className="block text-xs text-ink-muted">
                        Tick this if you do not need M-Machine to quote carriage.
                      </span>
                    </span>
                  </label>
                </div>
                <div>
                  <label className="label">Message</label>
                  <textarea
                    name="message"
                    rows={3}
                    className="input resize-none"
                    placeholder="Cut lengths, delivery notes, or anything else we should know"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-ink-muted">
                    Guide subtotal ex VAT:{" "}
                    <strong className="text-racing">{"\u00a3"}{subtotal.toFixed(2)}</strong>
                  </div>
                  <button type="submit" disabled={submitting || items.length === 0} className="btn-primary">
                    {submitting ? "Sending..." : "Submit Order"}
                  </button>
                </div>
                {message && (
                  <div className="rounded-lg bg-cream-dark p-3 text-sm text-racing">{message}</div>
                )}
              </form>
              )}
            </div>
          </aside>
        </div>
      )}
    </CartContext.Provider>
  );
}
