"use client";

import {
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
const MINI_VEHICLE_MODELS = ["Saloon", "Van", "Traveller", "Pickup"];

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
      aria-label={`Order ${itemLabel(item)}`}
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
  const pendingDialogRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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
  const hasPoaItems = items.some((item) => typeof item.unitPriceExVat !== "number");
  const needsVehicleDetails = items.some((item) => item.catalogue === "mini");

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : 0),
        0
      ),
    [items]
  );

  useEffect(() => {
    if (!pending && !drawerOpen) return;

    const dialog = pending ? pendingDialogRef.current : drawerRef.current;
    if (!dialog) return;

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    window.setTimeout(() => focusable()[0]?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (pending) setPending(null);
        else closeDrawer();
        return;
      }

      if (event.key !== "Tab") return;
      const controls = focusable();
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [drawerOpen, pending]);

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
    const ownDeliveryInput = formEl.elements.namedItem("arrangeOwnDelivery");
    const ownDeliverySelected = ownDeliveryInput instanceof HTMLInputElement
      ? ownDeliveryInput.checked
      : arrangeOwnDelivery;
    const address = ownDeliverySelected ? "" : String(form.get("address") ?? "").trim();
    const vehicleYear = String(form.get("vehicleYear") ?? "").trim();
    const vehicleModel = String(form.get("vehicleModel") ?? "").trim();

    if (needsVehicleDetails && (!vehicleYear || !vehicleModel)) {
      setMessage("Please enter the vehicle year and model for Mini panel orders.");
      setSubmitting(false);
      return;
    }

    if (!ownDeliverySelected && !address) {
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
            vehicleYear: needsVehicleDetails ? vehicleYear : "",
            vehicleModel: needsVehicleDetails ? vehicleModel : "",
            address,
            arrangeOwnDelivery: ownDeliverySelected,
            deliveryMode: ownDeliverySelected ? "collection" : "delivery",
            message: form.get("message"),
          },
          items,
          website: form.get("website"),
        }),
      });
      const data = await res.json() as { error?: string; quoteId?: string };
      if (!res.ok) throw new Error(data.error || "Quote request failed");
      formEl.reset();
      setItems([]);
      setArrangeOwnDelivery(false);
      if (!data.quoteId) throw new Error("The order was saved without a reference. Please contact M-Machine.");
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
          aria-label={`Open order with ${count} ${count === 1 ? "item" : "items"}`}
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
          <div
            ref={pendingDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-to-order-title"
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          >
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-ink-muted">Add to quote</div>
              <h2 id="add-to-order-title" className="mt-1 text-lg font-semibold text-racing">{itemLabel(pending)}</h2>
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
                aria-label="Reduce quantity"
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
                aria-label="Quantity"
              />
              <button
                type="button"
                onClick={() => setPendingQty((qty) => Math.min(999, qty + 1))}
                className="h-10 w-10 rounded-md border border-racing/20 text-lg text-racing"
                aria-label="Increase quantity"
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
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-cart-title"
            className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-racing/10 p-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-muted">Quote request</div>
                <h2 id="quote-cart-title" className="font-display text-2xl text-racing">Your order</h2>
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
                <div className="flex min-h-full items-center justify-center" aria-live="polite">
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
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="order-website">Website</label>
                  <input id="order-website" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                </div>
                {needsVehicleDetails && (
                  <section className="rounded-lg border border-racing/10 bg-cream-dark p-3">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-racing">
                      Vehicle Details
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="order-vehicle-year">Vehicle Year *</label>
                        <input
                          id="order-vehicle-year"
                          name="vehicleYear"
                          required
                          className="input bg-white"
                          inputMode="numeric"
                          placeholder="e.g. 1967"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="order-vehicle-model">Model *</label>
                        <select id="order-vehicle-model" name="vehicleModel" required defaultValue="" className="input bg-white">
                          <option value="" disabled>Select model</option>
                          {MINI_VEHICLE_MODELS.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>
                )}
                <h3 className="pt-1 text-xs font-semibold uppercase tracking-[2px] text-racing">
                  Your Details
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="order-name">Name *</label>
                    <input id="order-name" name="name" required autoComplete="name" className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="order-company">Company</label>
                    <input id="order-company" name="company" autoComplete="organization" className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="order-email">Email *</label>
                    <input id="order-email" name="email" type="email" required autoComplete="email" className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="order-phone">Phone *</label>
                    <input id="order-phone" name="phone" type="tel" required autoComplete="tel" className="input" />
                  </div>
                </div>
                <div>
                  {!arrangeOwnDelivery && (
                    <>
                    <label className="label" htmlFor="order-address">Delivery address</label>
                    <textarea
                      id="order-address"
                      name="address"
                      rows={4}
                      required
                      className="input resize-none"
                      autoComplete="street-address"
                      placeholder="Full delivery address, including postcode"
                    />
                    </>
                  )}
                  <label className="mt-3 flex items-start gap-3 rounded-lg border border-racing/10 bg-cream-dark p-3 text-sm text-racing">
                    <input
                      name="arrangeOwnDelivery"
                      value="true"
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
                  <label className="label" htmlFor="order-message">Message</label>
                  <textarea
                    id="order-message"
                    name="message"
                    rows={3}
                    className="input resize-none"
                    placeholder="Cut lengths, delivery notes, or anything else we should know"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-ink-muted">
                    {hasPoaItems ? "Known subtotal ex VAT" : "Guide subtotal ex VAT"}:{" "}
                    <strong className="text-racing">{"\u00a3"}{subtotal.toFixed(2)}</strong>
                    {hasPoaItems && (
                      <span className="mt-1 block text-xs">POA items will be confirmed before invoicing.</span>
                    )}
                  </div>
                  <button type="submit" disabled={submitting || items.length === 0} className="btn-primary">
                    {submitting ? "Sending..." : "Submit Order"}
                  </button>
                </div>
                {message && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</div>
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
