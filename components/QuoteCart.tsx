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
import {
  calculateMetalOrderItem,
  formatMetalDimensionForUnit,
  getMetalOrderConfig,
  metalDimensionUnitLabel,
  METAL_DIMENSION_DISCLAIMER,
  normaliseMetalDimensionUnit,
} from "@/lib/metal-pricing";
import type { MetalDimensionUnit } from "@/lib/metal-pricing";
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
const VAT_MULTIPLIER = 1.2;

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

function DimensionUnitToggle({
  value,
  onChange,
}: {
  value: MetalDimensionUnit;
  onChange: (unit: MetalDimensionUnit) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-md border border-racing/15 bg-white p-0.5 text-[11px] font-semibold uppercase tracking-wide">
      {(["metric", "imperial"] as const).map((unit) => (
        <button
          key={unit}
          type="button"
          onClick={() => onChange(unit)}
          aria-pressed={value === unit}
          className={`rounded px-2 py-1 transition ${
            value === unit ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"
          }`}
        >
          {unit}
        </button>
      ))}
    </div>
  );
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
  const [pendingLengthMm, setPendingLengthMm] = useState("");
  const [pendingWidthMm, setPendingWidthMm] = useState("");
  const [pendingDimensionUnit, setPendingDimensionUnit] = useState<MetalDimensionUnit>("metric");
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
  const pendingMetalConfig = useMemo(
    () => (pending?.catalogue === "metals" ? getMetalOrderConfig(pending) : null),
    [pending]
  );
  const pendingMetalCalculates =
    pendingMetalConfig?.mode === "length" ||
    pendingMetalConfig?.mode === "sheet" ||
    pendingMetalConfig?.mode === "fixed";
  const pendingMetalCalculation = useMemo(() => {
    if (!pending || pending.catalogue !== "metals" || !pendingMetalConfig || !pendingMetalCalculates) {
      return null;
    }
    return calculateMetalOrderItem(
      pending,
      {
        inputUnit: pendingDimensionUnit,
        inputLength: pendingLengthMm,
        inputWidth: pendingWidthMm,
      },
      pendingQty
    );
  }, [pending, pendingDimensionUnit, pendingLengthMm, pendingMetalConfig, pendingMetalCalculates, pendingQty, pendingWidthMm]);
  const pendingNeedsDimensions = pendingMetalConfig?.mode === "length" || pendingMetalConfig?.mode === "sheet";
  const pendingCanAdd =
    !pending ||
    pending.catalogue !== "metals" ||
    pendingMetalConfig?.mode === "manual" ||
    pendingMetalConfig?.mode === "catalogue" ||
    Boolean(pendingMetalCalculation?.ok);
  const pendingPreviewUnitPrice =
    pendingMetalCalculation?.ok ? pendingMetalCalculation.unitPriceExVat : pending?.unitPriceExVat ?? null;
  const pendingPreviewUnit =
    pendingMetalCalculation?.ok ? pendingMetalCalculation.unit : pending?.unit;
  const pendingCatalogueUnitPrice = pending?.unitPriceExVat ?? null;
  const pendingCatalogueUnit = pending?.unit;
  const pendingPreviewLineExVat =
    typeof pendingPreviewUnitPrice === "number" ? pendingPreviewUnitPrice * pendingQty : null;
  const pendingPreviewLineIncVat =
    typeof pendingPreviewLineExVat === "number" ? pendingPreviewLineExVat * VAT_MULTIPLIER : null;
  const subtotalIncVat = subtotal * VAT_MULTIPLIER;
  const pendingDimensionUnitText = metalDimensionUnitLabel(pendingDimensionUnit);
  const pendingDimensionStep = pendingDimensionUnit === "imperial" ? "0.001" : "0.1";
  const pendingLengthMaxInput =
    pendingMetalConfig?.mode === "length" && typeof pendingMetalConfig.maxLengthMm === "number"
      ? pendingDimensionUnit === "imperial"
        ? pendingMetalConfig.maxLengthMm / 25.4
        : pendingMetalConfig.maxLengthMm
      : undefined;
  const pendingLengthPlaceholder =
    pendingMetalConfig?.mode === "length" && pendingMetalConfig.defaultInputUnit === "imperial"
      ? pendingDimensionUnit === "imperial"
        ? "e.g. 9"
        : "e.g. 250"
      : pendingDimensionUnit === "imperial"
        ? "e.g. 30"
        : "e.g. 750";

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
    const metalConfig = item.catalogue === "metals" ? getMetalOrderConfig(item) : null;
    const defaultDimensionUnit = metalConfig?.mode === "length" ? metalConfig.defaultInputUnit : undefined;
    setPending(item);
    setPendingQty(1);
    setPendingLengthMm("");
    setPendingWidthMm("");
    setPendingDimensionUnit(defaultDimensionUnit ?? "metric");
    setMessage("");
  }

  function confirmPending() {
    if (!pending) return;
    let itemToAdd = pending;
    if (pending.catalogue === "metals" && pendingMetalCalculates) {
      const calculation = calculateMetalOrderItem(
        pending,
        {
          inputUnit: pendingDimensionUnit,
          inputLength: pendingLengthMm,
          inputWidth: pendingWidthMm,
        },
        pendingQty
      );
      if (!calculation.ok) {
        setMessage(calculation.error);
        return;
      }
      itemToAdd = {
        ...pending,
        key: `${pending.key}-${calculation.keySuffix}`,
        unit: calculation.unit,
        unitPriceExVat: calculation.unitPriceExVat,
        unitPriceIncVat: calculation.unitPriceIncVat,
        metalDimensions: calculation.metalDimensions,
      };
    }
    setItems((current) => {
      const existing = current.findIndex((item) => item.key === itemToAdd.key);
      if (existing >= 0) {
        return current.map((item, index) =>
          index === existing ? { ...item, qty: item.qty + pendingQty } : item
        );
      }
      return [...current, { ...itemToAdd, qty: pendingQty }];
    });
    setPending(null);
    setMessage("");
  }

  function changePendingDimensionUnit(nextUnit: MetalDimensionUnit) {
    const normalised = normaliseMetalDimensionUnit(nextUnit);
    if (normalised === pendingDimensionUnit) return;

    const convert = (value: string) => {
      if (!value) return "";
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return value;
      const mm = pendingDimensionUnit === "imperial" ? numeric * 25.4 : numeric;
      const converted = normalised === "imperial" ? mm / 25.4 : mm;
      return Number(converted.toFixed(normalised === "imperial" ? 4 : 2)).toString();
    };

    setPendingLengthMm((value) => convert(value));
    setPendingWidthMm((value) => convert(value));
    setPendingDimensionUnit(normalised);
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-racing-dark/55 px-4">
          <div
            ref={pendingDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-to-order-title"
            className="w-full max-w-[420px] rounded-lg bg-white p-4 text-[14px] leading-snug shadow-xl"
          >
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-muted">Add to quote</div>
              <h2 id="add-to-order-title" className="mt-1 text-base font-semibold leading-tight text-racing">{itemLabel(pending)}</h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                {money(pendingCatalogueUnitPrice)}
                {pendingCatalogueUnit ? ` / ${pendingCatalogueUnit}` : ""}
              </p>
            </div>
            {pending.catalogue === "metals" && (
              <div className="mb-3 rounded-lg border border-racing/10 bg-cream-dark p-2.5 text-[13px] leading-snug">
                <p className="mb-2 text-[11px] leading-4 text-ink-muted">{METAL_DIMENSION_DISCLAIMER}</p>
                {pendingMetalConfig?.mode === "length" && (
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <label className="label !mb-0 !text-[12px]" htmlFor="metal-length">Required length ({pendingDimensionUnitText})</label>
                      <DimensionUnitToggle value={pendingDimensionUnit} onChange={changePendingDimensionUnit} />
                    </div>
                    <input
                      id="metal-length"
                      type="number"
                      min={1}
                      max={pendingLengthMaxInput}
                      step={pendingDimensionStep}
                      value={pendingLengthMm}
                      onChange={(event) => setPendingLengthMm(event.target.value)}
                      className="input bg-white !px-3 !py-2 !text-[14px]"
                      placeholder={pendingLengthPlaceholder}
                    />
                    {typeof pendingMetalConfig.maxLengthMm === "number" && (
                      <div className="mt-1 text-xs text-ink-muted">
                        Maximum single length {formatMetalDimensionForUnit(pendingMetalConfig.maxLengthMm, pendingDimensionUnit)}
                      </div>
                    )}
                  </div>
                )}
                {pendingMetalConfig?.mode === "sheet" && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 sm:col-span-2">
                      <div className="label !mb-0 !text-[12px]">Required dimensions</div>
                      <DimensionUnitToggle value={pendingDimensionUnit} onChange={changePendingDimensionUnit} />
                    </div>
                    <div>
                      <label className="label !mb-1 !text-[12px]" htmlFor="metal-length">Length ({pendingDimensionUnitText})</label>
                      <input
                        id="metal-length"
                        type="number"
                        min={1}
                        step={pendingDimensionStep}
                        value={pendingLengthMm}
                        onChange={(event) => setPendingLengthMm(event.target.value)}
                        className="input bg-white !px-3 !py-2 !text-[14px]"
                        placeholder={pendingDimensionUnit === "imperial" ? "e.g. 34.8" : "e.g. 884"}
                      />
                    </div>
                    <div>
                      <label className="label !mb-1 !text-[12px]" htmlFor="metal-width">Width ({pendingDimensionUnitText})</label>
                      <input
                        id="metal-width"
                        type="number"
                        min={1}
                        step={pendingDimensionStep}
                        value={pendingWidthMm}
                        onChange={(event) => setPendingWidthMm(event.target.value)}
                        className="input bg-white !px-3 !py-2 !text-[14px]"
                        placeholder={pendingDimensionUnit === "imperial" ? "e.g. 1.2" : "e.g. 30"}
                      />
                    </div>
                    {typeof pendingMetalConfig.maxLengthMm === "number" && typeof pendingMetalConfig.maxWidthMm === "number" && (
                      <div className="text-[11px] text-ink-muted sm:col-span-2">
                        Maximum sheet size {formatMetalDimensionForUnit(pendingMetalConfig.maxLengthMm, pendingDimensionUnit)} x {formatMetalDimensionForUnit(pendingMetalConfig.maxWidthMm, pendingDimensionUnit)}
                      </div>
                    )}
                  </div>
                )}
                {pendingMetalConfig?.mode === "fixed" && (
                  <div className="rounded-md bg-white px-3 py-1.5 text-racing">
                    {pendingMetalCalculation?.ok
                      ? pendingMetalCalculation.metalDimensions.display
                      : "Sold in complete stock lengths."}
                  </div>
                )}
                {pendingMetalConfig?.mode === "catalogue" && (
                  <div className="rounded-md bg-white px-3 py-1.5 text-racing">
                    {pendingMetalConfig.unitLabel ? `Sold as ${pendingMetalConfig.unitLabel}` : "Sold as a catalogue unit."}
                  </div>
                )}
                {pendingMetalConfig?.mode === "manual" && (
                  <div className="rounded-md bg-white px-3 py-1.5 text-ink-muted">
                    {pendingMetalConfig.reason}
                  </div>
                )}
                {pendingNeedsDimensions && pendingMetalCalculation && (
                  pendingMetalCalculation.ok ? (
                    <div className="mt-2.5 rounded-md bg-white px-3 py-1.5 text-racing">
                      {pendingMetalCalculation.metalDimensions.display}:{" "}
                      <strong>
                        {money(pendingMetalCalculation.unitPriceExVat)}
                        {typeof pendingMetalCalculation.unitPriceExVat === "number" ? " ex VAT each" : ""}
                      </strong>
                    </div>
                  ) : (
                    <div role="alert" className="mt-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
                      {pendingMetalCalculation.error}
                    </div>
                  )
                )}
              </div>
            )}
            <div className="mb-4">
              <div className="label !mb-1.5 !text-[12px]">QTY</div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingQty((qty) => Math.max(1, qty - 1))}
                  className="h-9 w-9 rounded-md border border-racing/20 text-base text-racing"
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
                  className="input h-9 w-20 text-center !px-2 !py-1.5 !text-[14px]"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  onClick={() => setPendingQty((qty) => Math.min(999, qty + 1))}
                  className="h-9 w-9 rounded-md border border-racing/20 text-base text-racing"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-md border border-racing/10 bg-cream-dark px-3 py-1.5 text-[13px]">
                <span className="font-semibold text-ink-muted">Total Incl VAT</span>
                <strong className="text-racing">{money(pendingPreviewLineIncVat)}</strong>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  setMessage("");
                }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button type="button" onClick={confirmPending} disabled={!pendingCanAdd} className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                Add to cart
              </button>
            </div>
            {message && pending.catalogue === "metals" && (
              <div role="alert" className="mt-2.5 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">{message}</div>
            )}
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
                          {item.metalDimensions?.display && (
                            <div className="mt-1 text-xs font-semibold text-racing">
                              {item.metalDimensions.display}
                            </div>
                          )}
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
                    <div>
                      {hasPoaItems ? "Known subtotal ex VAT" : "Guide subtotal ex VAT"}:{" "}
                      <strong className="text-racing">{"\u00a3"}{subtotal.toFixed(2)}</strong>
                    </div>
                    <div className="mt-0.5 text-xs">
                      {hasPoaItems ? "Known subtotal incl VAT" : "Guide subtotal incl VAT"}:{" "}
                      <strong className="text-racing">{"\u00a3"}{subtotalIncVat.toFixed(2)}</strong>
                    </div>
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
