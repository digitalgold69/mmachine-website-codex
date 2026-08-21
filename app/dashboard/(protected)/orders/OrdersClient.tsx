"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ACCOUNTING_BUCKET_LABELS,
  ACCOUNTING_BUCKETS,
  quoteIncludesVat,
  quoteRefunds,
  quoteTotals,
  refundNetExVat,
  remainingRefundByBucket,
  websiteInvoiceDisplay,
} from "@/lib/order-accounting";
import { quoteCustomerWillArrangeDelivery, quoteDeliveryAddress } from "@/lib/quote-delivery";
import type { PaymentSettings } from "@/lib/payment-settings";
import type {
  QuoteAccountingBucket,
  QuoteItem,
  QuotePaymentMethod,
  QuoteRequest,
  QuoteStatus,
} from "@/lib/quote-types";

const GBP = "\u00a3";
const PAGE_SIZE = 8;
const TZ = "Europe/London";

type TimeFilter = "all" | "today" | "7d" | "month" | "year";
type AddLineCatalogue = "mini" | "metals";
type OrderRequestFilter = "all" | "mini" | "metals" | "custom" | "featured";

type PaymentSettingsDraft = PaymentSettings;

type CatalogueSearchProduct = {
  id: string;
  code: string;
  name?: string;
  section?: string;
  fits?: string;
  category?: string;
  form?: string;
  metal?: string;
  spec?: string;
  size?: string;
  unit?: string;
  stockSize?: string;
  sourceSheet?: string;
  description?: string;
  priceExVat: number | null;
  priceIncVat: number | null;
};

type ProductsResponse = {
  products?: CatalogueSearchProduct[];
  count?: number;
  error?: string;
};

type QuoteRequestsUpdatedEvent = CustomEvent<{
  quotes?: QuoteRequest[];
}>;

type ManualLineDraft = {
  qty: string;
  item: string;
  unit: string;
  priceExVat: string;
};

type RefundDraft = {
  open: boolean;
  reason: string;
  amounts: Record<QuoteAccountingBucket, string>;
};

const STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "invoice_sent", label: "Invoice sent" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
];

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

const ORDER_REQUEST_FILTERS: { value: OrderRequestFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mini", label: "Mini panels" },
  { value: "metals", label: "Metals" },
  { value: "custom", label: "Custom Engineering" },
  { value: "featured", label: "Featured Work" },
];

const PAYMENT_METHOD_OPTIONS: { value: QuotePaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "bacs", label: "BACS" },
  { value: "cash", label: "Cash" },
];

const BLANK_MANUAL_LINE: ManualLineDraft = {
  qty: "1",
  item: "",
  unit: "each",
  priceExVat: "",
};

function blankRefundDraft(): RefundDraft {
  return {
    open: false,
    reason: "",
    amounts: ACCOUNTING_BUCKETS.reduce((amounts, bucket) => {
      amounts[bucket] = "";
      return amounts;
    }, {} as Record<QuoteAccountingBucket, string>),
  };
}

const STATUS_STYLES: Record<QuoteStatus, string> = {
  new: "bg-gold/15 text-gold",
  reviewing: "bg-blue-50 text-blue-800",
  invoice_sent: "bg-racing/10 text-racing",
  paid: "bg-green-50 text-green-800",
  closed: "bg-stone-100 text-stone-700",
};

const money = (value: number | null | undefined) =>
  typeof value === "number" ? `${GBP}${value.toFixed(2)}` : "POA";

const invoiceMoney = (value: number | null | undefined) =>
  typeof value === "number" ? `${GBP}${value.toFixed(2)}` : "Add price";

const lineExVat = (item: QuoteItem) =>
  typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : null;

const totals = (quote: QuoteRequest) => {
  const hasPoaItems = quote.items.some((item) => typeof item.unitPriceExVat !== "number");
  const quoteTotal = quoteTotals(quote);
  return {
    goods: quoteTotal.goodsExVat,
    carriage: quoteTotal.carriageExVat,
    extra: quoteTotal.extraChargesExVat,
    refunds: quoteTotal.refundsExVat,
    subtotalEx: quoteTotal.subtotalExVat,
    totalEx: quoteTotal.totalExVat,
    vat: quoteTotal.vat,
    totalInc: quoteTotal.totalIncVat,
    includeVat: quoteTotal.includeVat,
    hasPoaItems,
  };
};

const itemName = (item: QuoteItem) =>
  item.catalogue === "custom"
    ? item.custom?.projectName || item.description || "Custom fabrication request"
    : item.catalogue === "featured"
    ? item.description || "Featured Work item"
    : item.catalogue === "metals"
    ? [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ")
    : item.description;

function firstCustomItem(quote: QuoteRequest) {
  return quote.items.find((item) => item.catalogue === "custom" && item.custom);
}

function customJobRows(quote: QuoteRequest) {
  const custom = firstCustomItem(quote)?.custom;
  if (!custom) return [];

  return [
    { label: "Material", value: custom.material },
    { label: "Thickness/spec", value: custom.thickness },
    { label: "Services", value: custom.services?.length ? custom.services.join(", ") : "" },
    { label: "Quantity", value: [custom.quantity, custom.units].filter(Boolean).join(" ") },
    { label: "Finish", value: custom.finish },
    { label: "Tolerance", value: custom.tolerance },
    { label: "Needed by", value: custom.deadline },
    { label: "Budget", value: custom.budget },
  ].filter((row) => row.value);
}

function compactText(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function firstText(...values: Array<string | null | undefined>) {
  return values.map(compactText).find(Boolean) || "";
}

function customBrief(quote: QuoteRequest) {
  const item = firstCustomItem(quote);
  return firstText(quote.customer.message, item?.custom?.projectName, item?.description);
}

function invoiceItemTitle(item: QuoteItem) {
  if (item.catalogue === "custom") return "Custom Job";
  if (item.catalogue === "metals") {
    return [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ") || item.description || "Metal";
  }
  return item.description || itemName(item);
}

function invoiceLineSubtitle(item: QuoteItem) {
  if (item.catalogue === "custom") return "Custom fabrication quote";
  if (item.catalogue === "metals") {
    return item.code || [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" / ") || "Metal";
  }
  if (item.catalogue === "featured") return item.code || "Featured Work";
  return item.code || "Mini panel";
}

function invoiceLineDimension(item: QuoteItem) {
  return item.catalogue === "metals" ? item.metalDimensions?.display || "" : "";
}

function totalsReadyText(value: number | null | undefined, hasPoaItems: boolean) {
  return hasPoaItems ? "Add prices" : money(value);
}

function priceLabel(quote: QuoteRequest) {
  return quoteIncludesVat(quote) ? "Price ex VAT" : "Price";
}

function baseTotalLabel(quote: QuoteRequest, label: string) {
  return quoteIncludesVat(quote) ? `${label} ex VAT` : label;
}

function cardTotalSubLabel(quote: QuoteRequest) {
  return quoteIncludesVat(quote) ? "ex VAT" : "VAT not applied";
}

function refundCardText(quote: QuoteRequest, quoteTotal: ReturnType<typeof totals>) {
  if (quoteTotal.refunds <= 0 || quoteTotal.hasPoaItems) return "";
  const fullRefund = quoteTotal.subtotalEx > 0 && quoteTotal.refunds >= quoteTotal.subtotalEx - 0.005;
  const suffix = quoteIncludesVat(quote) ? " ex VAT" : "";
  return `${fullRefund ? "Fully refunded" : "Refunded"} ${money(quoteTotal.refunds)}${suffix}`;
}

function quoteDisplayRef(quote: QuoteRequest) {
  return quote.websiteInvoiceNumber ? websiteInvoiceDisplay(quote) : "Invoice pending";
}

function paymentMethodLabel(value: QuotePaymentMethod | null | undefined) {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label || "Card";
}

function paymentSettingsRows(settings: PaymentSettings) {
  return [
    { label: "Account type", value: settings.accountType },
    { label: "Account name", value: settings.accountName },
    { label: "Sort code", value: settings.sortCode },
    { label: "Account number", value: settings.accountNumber },
  ].filter((row) => compactText(row.value));
}

function safePaymentLink(value: string | null | undefined) {
  const trimmed = compactText(value);
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function defaultAddLineCatalogue(quote: QuoteRequest): AddLineCatalogue {
  return quote.items.some((item) => item.catalogue === "metals") ? "metals" : "mini";
}

function isOwnerAddedLine(item: QuoteItem) {
  return item.key.startsWith("owner-") || item.key.startsWith("manual-");
}

function isManualLine(item: QuoteItem) {
  return item.key.startsWith("manual-");
}

function isCatalogueProductLine(item: QuoteItem, catalogue: AddLineCatalogue, product: CatalogueSearchProduct) {
  return item.catalogue === catalogue && (
    item.productId === product.id ||
    (Boolean(product.code) && item.code === product.code)
  );
}

function lineKey(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampQty(value: string | number) {
  const parsed = Math.floor(Number(String(value).replace(/[^\d]/g, "")) || 1);
  return Math.max(1, Math.min(999, parsed));
}

function priceFromInput(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function incVatFromExVat(value: number | null) {
  return typeof value === "number" ? Number((value * 1.2).toFixed(2)) : null;
}

function catalogueResultTitle(product: CatalogueSearchProduct, catalogue: AddLineCatalogue) {
  if (catalogue === "metals") {
    return [product.form, product.metal, product.spec, product.size].filter(Boolean).join(" - ") || product.name || product.description || "Metal";
  }
  return product.name || product.description || product.code || "Mini panel";
}

function catalogueResultSubtitle(product: CatalogueSearchProduct, catalogue: AddLineCatalogue) {
  if (catalogue === "metals") {
    return [product.code, product.unit, product.stockSize, product.sourceSheet].filter(Boolean).join(" / ");
  }
  return [product.code, product.fits, product.section ? `Section ${product.section}` : ""].filter(Boolean).join(" / ");
}

function quoteItemFromCatalogueProduct(product: CatalogueSearchProduct, catalogue: AddLineCatalogue): QuoteItem {
  const unitPriceExVat = typeof product.priceExVat === "number" ? product.priceExVat : null;
  const unitPriceIncVat = typeof product.priceIncVat === "number" ? product.priceIncVat : incVatFromExVat(unitPriceExVat);

  if (catalogue === "metals") {
    return {
      key: lineKey(`owner-metals-${product.id}`),
      catalogue: "metals",
      productId: product.id,
      code: product.code,
      description: catalogueResultTitle(product, "metals"),
      shape: product.form,
      metal: product.metal,
      spec: product.spec,
      size: product.size,
      stockSize: product.stockSize,
      unit: product.unit || "each",
      qty: 1,
      unitPriceExVat,
      unitPriceIncVat,
    };
  }

  return {
    key: lineKey(`owner-mini-${product.id}`),
    catalogue: "mini",
    productId: product.id,
    code: product.code,
    description: catalogueResultTitle(product, "mini"),
    unit: "each",
    qty: 1,
    unitPriceExVat,
    unitPriceIncVat,
  };
}

type QuoteKind = "mini" | "metals" | "custom" | "featured" | "mixed";

const KIND_STYLES: Record<QuoteKind, string> = {
  mini: "bg-racing/10 text-racing",
  metals: "bg-cream-dark text-racing",
  custom: "bg-green-50 text-green-800",
  featured: "bg-sky-50 text-sky-800",
  mixed: "bg-stone-100 text-stone-700",
};

const KIND_LABELS: Record<QuoteKind, string> = {
  mini: "Mini panels",
  metals: "Metals",
  custom: "Custom fab",
  featured: "Featured Work",
  mixed: "Mixed order",
};

function quoteKind(quote: QuoteRequest): QuoteKind {
  const kinds = new Set(quote.items.map((item) => item.catalogue));
  if (kinds.size > 1) return "mixed";
  if (kinds.has("custom")) return "custom";
  if (kinds.has("featured")) return "featured";
  if (kinds.has("metals")) return "metals";
  return "mini";
}

function quoteMatchesOrderRequestFilter(quote: QuoteRequest, filter: OrderRequestFilter) {
  if (filter === "all") return true;
  return quote.items.some((item) => item.catalogue === filter);
}

function customFiles(quote: QuoteRequest) {
  return quote.items.flatMap((item) => item.custom?.files || []);
}

function orderItemQuantity(quote: QuoteRequest) {
  return quote.items.reduce((sum, item) => sum + item.qty, 0);
}

function hasMiniItems(quote: QuoteRequest) {
  return quote.items.some((item) => item.catalogue === "mini");
}

function vehicleDetailRows(quote: QuoteRequest) {
  return [
    { label: "Vehicle year", value: compactText(quote.customer.vehicleYear) },
    { label: "Model", value: compactText(quote.customer.vehicleModel) },
  ];
}

function fileHref(key: string) {
  return `/api/quote-files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function cloneQuote(quote: QuoteRequest): QuoteRequest {
  return JSON.parse(JSON.stringify(quote));
}

function mergeQuoteUpdates(current: QuoteRequest[], incoming: QuoteRequest[]) {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((quote) => [quote.id, quote]));
  for (const quote of incoming) {
    byId.set(quote.id, quote);
  }
  return [...byId.values()];
}

function statusLabel(status: QuoteStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ukDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function historyDate(quote: QuoteRequest) {
  return isPaidQuote(quote) ? quote.paidAt || quote.updatedAt : quote.submittedAt;
}

function historyMonthKey(quote: QuoteRequest) {
  return ukDateKey(historyDate(quote)).slice(0, 7);
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function isPaidQuote(quote: QuoteRequest) {
  return quote.status === "paid" || Boolean(quote.paidAt);
}

function isPendingPaymentQuote(quote: QuoteRequest) {
  return !isPaidQuote(quote) && (quote.status === "invoice_sent" || Boolean(quote.invoiceSentAt || quote.customerEmailSentAt));
}

function isOpenRequestQuote(quote: QuoteRequest) {
  return !isPaidQuote(quote) && !isPendingPaymentQuote(quote) && quote.status !== "closed";
}

function StatusPill({ status }: { status: QuoteStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${STATUS_STYLES[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

function OrderTypePill({ quote }: { quote: QuoteRequest }) {
  const kind = quoteKind(quote);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${KIND_STYLES[kind]}`}>
      {KIND_LABELS[kind]}
    </span>
  );
}

function OrderCardSection({
  title,
  quotes,
  empty,
  selectedId,
  savingAction,
  isSaving,
  onSelect,
  onMarkPaid,
  onDelete,
  dateForQuote,
  dateLabel,
  showDelete = true,
}: {
  title: string;
  quotes: QuoteRequest[];
  empty: string;
  selectedId: string;
  savingAction: string;
  isSaving: boolean;
  onSelect: (id: string) => void;
  onMarkPaid: (quote: QuoteRequest) => void;
  onDelete: (quote: QuoteRequest) => void;
  dateForQuote: (quote: QuoteRequest) => string | null | undefined;
  dateLabel: string;
  showDelete?: boolean;
}) {
  return (
    <section className="rounded-xl border border-racing/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-racing">{title}</h2>
        <span className="rounded-full bg-cream-dark px-3 py-1 text-xs font-semibold text-racing">
          {quotes.length}
        </span>
      </div>
      {quotes.length === 0 ? (
        <div className="rounded-lg bg-cream-dark p-4 text-sm text-ink-muted">{empty}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quotes.map((quote) => (
            <OrderCard
              key={quote.id}
              quote={quote}
              selectedId={selectedId}
              savingAction={savingAction}
              isSaving={isSaving}
              onSelect={onSelect}
              onMarkPaid={onMarkPaid}
              onDelete={onDelete}
              dateLabel={dateLabel}
              dateValue={dateForQuote(quote)}
              showMarkPaid={!isPaidQuote(quote)}
              showDelete={showDelete && !isPaidQuote(quote)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderCard({
  quote,
  selectedId,
  savingAction,
  isSaving,
  onSelect,
  onMarkPaid,
  onDelete,
  dateLabel,
  dateValue,
  showMarkPaid,
  showDelete,
}: {
  quote: QuoteRequest;
  selectedId: string;
  savingAction: string;
  isSaving: boolean;
  onSelect: (id: string) => void;
  onMarkPaid: (quote: QuoteRequest) => void;
  onDelete: (quote: QuoteRequest) => void;
  dateLabel: string;
  dateValue: string | null | undefined;
  showMarkPaid: boolean;
  showDelete: boolean;
}) {
  const quoteTotals = totals(quote);
  const cardSaving = savingAction.startsWith(`${quote.id}:`);
  const [cardPaymentMethod, setCardPaymentMethod] = useState<QuotePaymentMethod>(quote.paymentMethod || "card");
  const itemQuantity = orderItemQuantity(quote);
  const displayRef = quoteDisplayRef(quote);
  const refundText = refundCardText(quote, quoteTotals);
  const sentDateText = !quote.paidAt && quote.invoiceSentAt ? formatDateTime(dateValue || quote.invoiceSentAt) : "";
  const bodyDateText = sentDateText ? "" : `${dateLabel}: ${formatDateTime(dateValue)}`;
  const footerStatusText = quote.paidAt ? `Paid ${formatDateTime(quote.paidAt)}` : "";
  const customerLines = [
    quote.customer.name,
    quote.customer.company,
    quote.customer.email,
    quote.customer.phone,
  ].filter(Boolean);

  useEffect(() => {
    setCardPaymentMethod(quote.paymentMethod || "card");
  }, [quote.id, quote.paymentMethod]);

  return (
    <article
      className={`flex h-full flex-col rounded-lg border p-3.5 transition ${
        selectedId === quote.id
          ? "border-gold bg-cream-dark shadow-sm"
          : "border-racing/10 bg-white hover:border-gold/60"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(quote.id)}
        className="flex flex-1 flex-col text-left"
        aria-current={selectedId === quote.id ? "true" : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <OrderTypePill quote={quote} />
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusPill status={quote.status} />
            {sentDateText && (
              <span className="text-right text-[11px] font-medium leading-4 text-ink-muted">
                {sentDateText}
              </span>
            )}
          </div>
        </div>
        <div title={displayRef} className="mt-2 max-w-full truncate text-lg font-semibold leading-6 text-racing">
          {displayRef}
        </div>
        <div className="mt-1 space-y-0.5">
          {customerLines.map((line, index) => (
            <div key={`${index}-${line}`} className="break-words text-sm font-medium leading-5 text-ink [overflow-wrap:anywhere]">
              {line}
            </div>
          ))}
        </div>
        {bodyDateText && <div className="mt-2 text-xs text-ink-muted">{bodyDateText}</div>}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="text-xs text-ink-muted">
            {itemQuantity} {itemQuantity === 1 ? "item" : "items"}
          </div>
          <div className="text-right">
            <div className="font-semibold text-racing">
              {quoteTotals.hasPoaItems ? "POA" : money(quoteTotals.totalEx)}
            </div>
            <div className="text-xs text-ink-muted">{cardTotalSubLabel(quote)}</div>
            {refundText && (
              <div className="mt-1 text-[11px] font-semibold leading-4 text-red-700">
                {refundText}
              </div>
            )}
          </div>
        </div>
      </button>
      {(footerStatusText || showDelete || showMarkPaid) && (
        <div className="mt-3 border-t border-racing/10 pt-2.5">
          {showDelete || showMarkPaid ? (
            <div
              className={
                showMarkPaid
                  ? "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
                  : "flex items-center justify-end"
              }
            >
            {showDelete && (
              <button
                type="button"
                onClick={() => onDelete(quote)}
                disabled={isSaving}
                aria-label={`Delete order ${displayRef}`}
                className="rounded-lg px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Delete
              </button>
            )}
            {showMarkPaid && !showDelete && <span aria-hidden="true" />}
            {showMarkPaid && (
              <select
                value={cardPaymentMethod}
                onChange={(event) => setCardPaymentMethod(event.target.value as QuotePaymentMethod)}
                disabled={isSaving}
                aria-label={`Payment method for ${displayRef}`}
                className="input min-h-0 h-9 px-2 py-1 text-xs font-semibold text-racing disabled:cursor-not-allowed disabled:opacity-70"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
            {showMarkPaid && (
              <button
                type="button"
                onClick={() => onMarkPaid({ ...quote, paymentMethod: cardPaymentMethod })}
                disabled={isSaving}
                aria-label={`Mark order ${displayRef} as paid`}
                className="shrink-0 rounded-lg border border-racing px-3 py-2 text-xs font-semibold text-racing hover:bg-racing hover:text-cream disabled:cursor-not-allowed disabled:opacity-70"
              >
                {cardSaving && savingAction.endsWith(":paid") ? "Saving..." : "Mark Paid"}
              </button>
            )}
            </div>
          ) : (
            <div className="text-xs text-ink-muted">{footerStatusText}</div>
          )}
        </div>
      )}
    </article>
  );
}

function PaymentSettingsModal({
  draft,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  draft: PaymentSettingsDraft;
  saving: boolean;
  error: string;
  onChange: (patch: Partial<PaymentSettingsDraft>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-racing-dark/60 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="payment-settings-title" className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="payment-settings-title" className="font-display text-2xl text-racing">Payment methods</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              These BACS details are used on future customer invoice emails.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-3 py-2 text-sm disabled:opacity-60">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="payment-account-type">Account type</label>
            <input
              id="payment-account-type"
              value={draft.accountType}
              onChange={(event) => onChange({ accountType: event.target.value })}
              className="input"
              placeholder="Business"
            />
          </div>
          <div>
            <label className="label" htmlFor="payment-account-name">Account name</label>
            <input
              id="payment-account-name"
              value={draft.accountName}
              onChange={(event) => onChange({ accountName: event.target.value })}
              className="input"
              placeholder="Craftgrange Limited"
            />
          </div>
          <div>
            <label className="label" htmlFor="payment-sort-code">Sort code</label>
            <input
              id="payment-sort-code"
              value={draft.sortCode}
              onChange={(event) => onChange({ sortCode: event.target.value })}
              className="input"
              placeholder="00-00-00"
            />
          </div>
          <div>
            <label className="label" htmlFor="payment-account-number">Account number</label>
            <input
              id="payment-account-number"
              value={draft.accountNumber}
              onChange={(event) => onChange({ accountNumber: event.target.value })}
              className="input"
              placeholder="00000000"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoicePrintSheet({ quote, paymentSettings }: { quote: QuoteRequest; paymentSettings: PaymentSettings }) {
  const quoteTotal = totals(quote);
  const includeVat = quoteIncludesVat(quote);
  const bacs = paymentSettingsRows(paymentSettings);
  const paymentLink = safePaymentLink(quote.paymentLink);
  return (
    <div className="invoice-print-sheet">
      <div className="mb-6 flex items-start justify-between gap-6 border-b border-racing/20 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">M-Machine</div>
          <h1 className="mt-1 font-display text-3xl text-racing">Invoice {quoteDisplayRef(quote)}</h1>
          <p className="mt-1 text-sm text-ink-muted">Submitted {formatDateTime(quote.submittedAt)}</p>
        </div>
        <div className="text-right text-sm text-ink-muted">
          <strong className="block text-racing">Craftgrange Limited</strong>
          Unit 6 Forge Way<br />
          Cleveland Trading Estate<br />
          Darlington, DL1 2PJ
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-racing/10 p-3">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">Customer</h2>
          <div className="font-semibold text-racing">{quote.customer.name}</div>
          {quote.customer.company && <div>{quote.customer.company}</div>}
          <div>{quote.customer.email}</div>
          <div>{quote.customer.phone}</div>
        </section>
        <section className="rounded-lg border border-racing/10 p-3">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">Delivery</h2>
          <div className="whitespace-pre-wrap">
            {quoteDeliveryAddress(quote.customer) ||
              (quoteCustomerWillArrangeDelivery(quote.customer)
                ? "Customer will arrange delivery / collection."
                : "Delivery address was not supplied.")}
          </div>
        </section>
      </div>

      <table className="mb-5 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-cream-dark text-left text-xs uppercase tracking-wider text-ink-muted">
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2 text-right">{priceLabel(quote)}</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item) => (
            <tr key={item.key} className="border-b border-racing/10 align-top">
              <td className="px-3 py-2 font-semibold text-racing">{item.qty}</td>
              <td className="px-3 py-2">
                <div className="font-semibold text-racing">{invoiceItemTitle(item)}</div>
                <div className="text-xs text-ink-muted">
                  {[invoiceLineSubtitle(item), invoiceLineDimension(item)].filter(Boolean).join(" / ")}
                </div>
              </td>
              <td className="px-3 py-2">{item.unit || "each"}</td>
              <td className="px-3 py-2 text-right font-semibold">{invoiceMoney(lineExVat(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mb-6 max-w-sm rounded-lg bg-cream-dark p-3 text-sm">
        <div className="flex justify-between gap-3"><span>{baseTotalLabel(quote, "Goods")}</span><strong>{money(quoteTotal.goods)}</strong></div>
        {quoteTotal.carriage > 0 && <div className="flex justify-between gap-3"><span>{baseTotalLabel(quote, "Carriage")}</span><strong>{money(quoteTotal.carriage)}</strong></div>}
        {quoteTotal.extra > 0 && <div className="flex justify-between gap-3"><span>{baseTotalLabel(quote, "Cut Charge")}</span><strong>{money(quoteTotal.extra)}</strong></div>}
        {quoteTotal.refunds > 0 && <div className="flex justify-between gap-3 text-red-700"><span>{baseTotalLabel(quote, "Refunds")}</span><strong>-{money(quoteTotal.refunds)}</strong></div>}
        {includeVat ? (
          <>
            <div className="flex justify-between gap-3"><span>VAT</span><strong>{money(quoteTotal.vat)}</strong></div>
            <div className="mt-2 flex justify-between gap-3 border-t border-racing/20 pt-2 text-racing"><span>Total inc VAT</span><strong>{money(quoteTotal.totalInc)}</strong></div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-3"><span>VAT</span><strong>Not applied</strong></div>
            <div className="mt-2 flex justify-between gap-3 border-t border-racing/20 pt-2 text-racing"><span>Total</span><strong>{money(quoteTotal.totalInc)}</strong></div>
          </>
        )}
      </div>

      <section className="rounded-lg border border-racing/10 bg-cream-dark p-3 text-sm">
        <h2 className="mb-2 font-semibold text-racing">Payment methods</h2>
        <div><strong>Card over the phone:</strong> Call 01325 381302 to pay by card.</div>
        {bacs.length > 0 && (
          <div className="mt-2">
            <strong>BACS:</strong>
            <div className="mt-1 grid gap-1">
              {bacs.map((row) => (
                <div key={row.label} className="flex gap-2">
                  <span className="min-w-28 text-ink-muted">{row.label}</span>
                  <span className="font-semibold text-racing">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {paymentLink && <div className="mt-2"><strong>Pay online:</strong> {paymentLink}</div>}
        <div className="mt-2"><strong>Cash on collection:</strong> Call to arrange cash payment on collection.</div>
      </section>
    </div>
  );
}

export default function OrdersClient({
  initialQuotes,
  initialError,
  initialMonth = "",
  initialHistoryCount,
  initialMonthStats,
  initialPaymentSettings,
}: {
  initialQuotes: QuoteRequest[];
  initialError: string;
  initialMonth?: string;
  initialHistoryCount: number;
  initialMonthStats: Record<string, { salesValue: number; salesCount: number }>;
  initialPaymentSettings: PaymentSettings;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [historyRows, setHistoryRows] = useState(initialQuotes.filter(isPaidQuote));
  const [historyCount, setHistoryCount] = useState(initialHistoryCount);
  const [historyMonthStats, setHistoryMonthStats] = useState(initialMonthStats);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<QuoteRequest | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QuoteRequest | null>(null);
  const [query, setQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [monthFilter, setMonthFilter] = useState(initialMonth);
  const [orderRequestFilter, setOrderRequestFilter] = useState<OrderRequestFilter>("all");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [page, setPage] = useState(1);
  const [savingAction, setSavingAction] = useState("");
  const [message, setMessage] = useState(initialError);
  const [actionNotice, setActionNotice] = useState<{ quoteId: string; tone: "success" | "error"; text: string } | null>(null);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [addLineCatalogue, setAddLineCatalogue] = useState<AddLineCatalogue>("mini");
  const [addLineQuery, setAddLineQuery] = useState("");
  const [addLineResults, setAddLineResults] = useState<CatalogueSearchProduct[]>([]);
  const [addLineCount, setAddLineCount] = useState(0);
  const [addLineLoading, setAddLineLoading] = useState(false);
  const [addLineError, setAddLineError] = useState("");
  const [addLineNotice, setAddLineNotice] = useState<{ catalogue: AddLineCatalogue; productId: string; text: string } | null>(null);
  const [manualLine, setManualLine] = useState<ManualLineDraft>(BLANK_MANUAL_LINE);
  const [refundDraft, setRefundDraft] = useState<RefundDraft>(() => blankRefundDraft());
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(initialPaymentSettings);
  const [paymentSettingsDraft, setPaymentSettingsDraft] = useState<PaymentSettingsDraft>(initialPaymentSettings);
  const [paymentSettingsOpen, setPaymentSettingsOpen] = useState(false);
  const [paymentSettingsSaving, setPaymentSettingsSaving] = useState(false);
  const [paymentSettingsError, setPaymentSettingsError] = useState("");
  const historyRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);
  const missingDeepLinkNoticeRef = useRef("");
  const closingQuoteIdRef = useRef("");
  const activeQuoteIdRef = useRef("");
  const firstHistoryLoad = useRef(true);
  const requestedQuoteId = searchParams.get("quote") || searchParams.get("order") || "";

  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => Date.parse(historyDate(b)) - Date.parse(historyDate(a))),
    [quotes]
  );

  const openRequestQuotes = useMemo(
    () => sortedQuotes.filter(isOpenRequestQuote),
    [sortedQuotes]
  );

  const pendingPaymentQuotes = useMemo(
    () => sortedQuotes.filter(isPendingPaymentQuote),
    [sortedQuotes]
  );

  const filteredOpenRequestQuotes = useMemo(
    () => openRequestQuotes.filter((quote) => quoteMatchesOrderRequestFilter(quote, orderRequestFilter)),
    [openRequestQuotes, orderRequestFilter]
  );

  const filteredPendingPaymentQuotes = useMemo(
    () => pendingPaymentQuotes.filter((quote) => quoteMatchesOrderRequestFilter(quote, orderRequestFilter)),
    [pendingPaymentQuotes, orderRequestFilter]
  );

  const selected = useMemo(
    () => quotes.find((quote) => quote.id === selectedId) ?? null,
    [quotes, selectedId]
  );

  const pageCount = Math.max(1, Math.ceil(historyCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageQuotes = historyRows.filter((quote) => quoteMatchesOrderRequestFilter(quote, orderRequestFilter));
  const monthStats = useMemo(() => new Map(Object.entries(historyMonthStats)), [historyMonthStats]);
  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (exportFrom) params.set("from", exportFrom);
    if (exportTo) params.set("to", exportTo);
    const queryString = params.toString();
    return `/api/quote-requests/export${queryString ? `?${queryString}` : ""}`;
  }, [exportFrom, exportTo]);
  const exportButtonLabel = exportFrom || exportTo ? "Download range" : "Download all";

  const pageGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; quotes: QuoteRequest[]; salesValue: number; salesCount: number }>();

    for (const quote of pageQuotes) {
      const key = historyMonthKey(quote);
      const stats = monthStats.get(key) || { salesValue: 0, salesCount: 0 };
      const group = groups.get(key) || {
        key,
        label: formatMonth(key),
        quotes: [],
        salesValue: stats.salesValue,
        salesCount: stats.salesCount,
      };

      group.quotes.push(quote);
      groups.set(key, group);
    }

    return [...groups.values()];
  }, [monthStats, pageQuotes]);

  const replaceQuoteParam = useCallback((quoteId: string | null) => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.delete("quote");
    params.delete("order");
    if (quoteId) params.set("quote", quoteId);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router]);

  const openInvoice = useCallback((quote: QuoteRequest, syncUrl = true) => {
    closingQuoteIdRef.current = "";
    activeQuoteIdRef.current = quote.id;
    setSelectedId(quote.id);
    setDraft(cloneQuote(quote));
    setMessage("");
    setActionNotice(null);
    if (syncUrl) replaceQuoteParam(quote.id);
  }, [replaceQuoteParam]);

  const closeInvoice = useCallback(() => {
    closingQuoteIdRef.current = activeQuoteIdRef.current;
    activeQuoteIdRef.current = "";
    setSelectedId("");
    setDraft(null);
    setActionNotice(null);
    replaceQuoteParam(null);
  }, [replaceQuoteParam]);

  useEffect(() => {
    if (firstHistoryLoad.current) {
      firstHistoryLoad.current = false;
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          history: "paid",
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          q: query.trim(),
          time: timeFilter,
          month: monthFilter,
        });
        if (orderRequestFilter !== "all") params.set("orderType", orderRequestFilter);
        const response = await fetch(`/api/quote-requests?${params}`, { signal: controller.signal });
        const data = await response.json() as {
          error?: string;
          quotes?: QuoteRequest[];
          count?: number;
          monthStats?: Record<string, { salesValue: number; salesCount: number }>;
        };
        if (!response.ok) throw new Error(data.error || "Order history could not be loaded.");
        const nextRows = data.quotes || [];
        setHistoryRows(nextRows);
        setHistoryCount(Number(data.count || 0));
        setHistoryMonthStats(data.monthStats || {});
        setQuotes((current) => {
          const byId = new Map(current.map((quote) => [quote.id, quote]));
          nextRows.forEach((quote) => byId.set(quote.id, quote));
          return [...byId.values()];
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage((error as Error).message || "Order history could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    }, query.trim() ? 250 : 20);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [currentPage, historyRevision, monthFilter, orderRequestFilter, query, timeFilter]);

  useEffect(() => {
    setPage(1);
  }, [monthFilter, orderRequestFilter, query, timeFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (!draft) return;
    setAddLineOpen(false);
    setAddLineCatalogue(defaultAddLineCatalogue(draft));
    setAddLineQuery("");
    setAddLineResults([]);
    setAddLineCount(0);
    setAddLineError("");
    setAddLineNotice(null);
    setManualLine(BLANK_MANUAL_LINE);
    setRefundDraft(blankRefundDraft());
  }, [draft?.id]);

  useEffect(() => {
    if (!addLineOpen) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAddLineLoading(true);
      setAddLineError("");
      try {
        const params = new URLSearchParams({
          catalogue: addLineCatalogue,
          q: addLineQuery.trim(),
          offset: "0",
          limit: "8",
        });
        if (addLineCatalogue === "metals") params.set("category", "all");
        const response = await fetch(`/api/products?${params}`, { signal: controller.signal });
        const data = await response.json() as ProductsResponse;
        if (!response.ok) throw new Error(data.error || "Catalogue search could not be loaded.");
        setAddLineResults(data.products || []);
        setAddLineCount(Number(data.count || 0));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setAddLineResults([]);
          setAddLineCount(0);
          setAddLineError("Catalogue search could not be loaded. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setAddLineLoading(false);
      }
    }, addLineQuery.trim() ? 220 : 20);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [addLineCatalogue, addLineOpen, addLineQuery]);

  useEffect(() => {
    if (!addLineNotice) return;
    const timeout = window.setTimeout(() => setAddLineNotice(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [addLineNotice]);

  useEffect(() => {
    function handleQuoteRequestsUpdated(event: Event) {
      const detail = (event as QuoteRequestsUpdatedEvent).detail;
      const incoming = Array.isArray(detail?.quotes) ? detail.quotes : [];
      if (incoming.length === 0) return;

      setQuotes((current) => mergeQuoteUpdates(current, incoming));
      setHistoryRows((current) => current.map((quote) => incoming.find((item) => item.id === quote.id) || quote));
    }

    window.addEventListener("mmachine:quote-requests-updated", handleQuoteRequestsUpdated);
    return () => window.removeEventListener("mmachine:quote-requests-updated", handleQuoteRequestsUpdated);
  }, []);

  useEffect(() => {
    if (!requestedQuoteId) {
      closingQuoteIdRef.current = "";
      return;
    }
    if (requestedQuoteId === closingQuoteIdRef.current) return;

    const existing = quotes.find((quote) => quote.id === requestedQuoteId);
    if (existing) {
      missingDeepLinkNoticeRef.current = "";
      if (selectedId !== existing.id || draft?.id !== existing.id) {
        openInvoice(existing, false);
      }
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/quote-requests?quote=${encodeURIComponent(requestedQuoteId)}`, {
          signal: controller.signal,
        });
        const data = await response.json() as { error?: string; quote?: QuoteRequest };
        if (!response.ok || !data.quote) {
          throw new Error(data.error || "Linked order could not be loaded.");
        }
        setQuotes((current) => current.some((quote) => quote.id === data.quote!.id) ? current : [data.quote!, ...current]);
        openInvoice(data.quote, false);
        missingDeepLinkNoticeRef.current = "";
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (missingDeepLinkNoticeRef.current !== requestedQuoteId) {
          missingDeepLinkNoticeRef.current = requestedQuoteId;
          setMessage((error as Error).message || "Linked order could not be loaded.");
        }
      }
    }, 20);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [draft?.id, openInvoice, quotes, requestedQuoteId, selectedId]);

  useEffect(() => {
    const quote = quotes.find((q) => q.id === selectedId);
    if (quote?.status === "new") {
      void markViewed(quote);
    }
  }, [quotes, selectedId]);

  useEffect(() => {
    if (!draft) return;

    const dialog = modalRef.current;
    if (!dialog) return;

    modalReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const focusableSelector =
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    window.setTimeout(() => focusable()[0]?.focus({ preventScroll: true }), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeInvoice();
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
      document.body.style.paddingRight = previousPaddingRight;
      if (modalReturnFocusRef.current?.isConnected) {
        modalReturnFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [closeInvoice, draft?.id]);

  useEffect(() => {
    if (!monthFilter) return;

    const timeout = window.setTimeout(() => {
      const target = document.getElementById(`order-month-${monthFilter}`) || historyRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [monthFilter, pageGroups.length]);

  function selectQuote(id: string) {
    const quote = quotes.find((q) => q.id === id);
    if (quote) {
      openInvoice(quote);
      return;
    }
    setMessage("That order could not be found.");
  }

  function patchDraft(patch: Partial<QuoteRequest>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
  }

  function patchItem(index: number, patch: Partial<QuoteItem>) {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  function openPaymentSettings() {
    setPaymentSettingsDraft(paymentSettings);
    setPaymentSettingsError("");
    setPaymentSettingsOpen(true);
  }

  async function savePaymentSettings() {
    setPaymentSettingsSaving(true);
    setPaymentSettingsError("");
    try {
      const response = await fetch("/api/payment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentSettingsDraft),
      });
      const data = await response.json() as { error?: string; settings?: PaymentSettings };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Payment settings could not be saved.");
      }
      setPaymentSettings(data.settings);
      setPaymentSettingsDraft(data.settings);
      setPaymentSettingsOpen(false);
      setMessage("Payment method settings saved.");
    } catch (error) {
      setPaymentSettingsError((error as Error).message || "Payment settings could not be saved.");
    } finally {
      setPaymentSettingsSaving(false);
    }
  }

  function printInvoice() {
    window.print();
  }

  function addCatalogueLine(product: CatalogueSearchProduct) {
    if (!draft) return;
    const item = quoteItemFromCatalogueProduct(product, addLineCatalogue);
    const existingIndex = draft.items.findIndex((current) => isCatalogueProductLine(current, addLineCatalogue, product));
    if (existingIndex >= 0) {
      setDraft({
        ...draft,
        items: draft.items.map((current, index) =>
          index === existingIndex ? { ...current, qty: clampQty(current.qty + 1) } : current
        ),
      });
      setAddLineNotice({ catalogue: addLineCatalogue, productId: product.id, text: "Qty +1" });
      setAddLineError("");
      setActionNotice(null);
      return;
    }

    setDraft({ ...draft, items: [...draft.items, item] });
    setAddLineNotice({ catalogue: addLineCatalogue, productId: product.id, text: "Added" });
    setAddLineError("");
    setActionNotice(null);
  }

  function addManualLine() {
    if (!draft) return;
    const description = manualLine.item.trim();
    if (!description) {
      setAddLineError("Enter an item description before adding the manual line.");
      return;
    }

    const unitPriceExVat = priceFromInput(manualLine.priceExVat);
    const item: QuoteItem = {
      key: lineKey(`manual-${addLineCatalogue}`),
      catalogue: addLineCatalogue,
      productId: lineKey("manual-product"),
      code: "",
      description,
      unit: manualLine.unit.trim() || "each",
      qty: clampQty(manualLine.qty),
      unitPriceExVat,
      unitPriceIncVat: incVatFromExVat(unitPriceExVat),
    };
    setDraft({ ...draft, items: [...draft.items, item] });
    setManualLine(BLANK_MANUAL_LINE);
    setAddLineNotice({ catalogue: addLineCatalogue, productId: item.productId, text: "Added" });
    setAddLineError("");
    setActionNotice(null);
  }

  function removeDraftLine(index: number) {
    if (!draft) return;
    const item = draft.items[index];
    if (!item || !isOwnerAddedLine(item)) return;
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) });
  }

  function removeQuoteFromDashboard(id: string) {
    setQuotes((current) => current.filter((quote) => quote.id !== id));
    setHistoryRows((current) => current.filter((quote) => quote.id !== id));
    if (selectedId === id) closeInvoice();
  }

  function updateQuote(updated: QuoteRequest) {
    if (updated.status === "closed") {
      removeQuoteFromDashboard(updated.id);
      setHistoryRevision((value) => value + 1);
      return;
    }

    setQuotes((current) => {
      const exists = current.some((quote) => quote.id === updated.id);
      return exists
        ? current.map((quote) => (quote.id === updated.id ? updated : quote))
        : [updated, ...current];
    });
    setHistoryRows((current) =>
      current.map((quote) => (quote.id === updated.id ? updated : quote))
    );
    setDraft((current) => (current?.id === updated.id ? cloneQuote(updated) : current));
    if (isPaidQuote(updated)) setHistoryRevision((value) => value + 1);
  }

  async function markViewed(quote: QuoteRequest) {
    try {
      const res = await fetch("/api/quote-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quote, status: "reviewing" }),
      });
      const data = await res.json() as { error?: string; quote?: QuoteRequest };
      if (!res.ok) throw new Error(data.error || "Could not mark viewed");

      if (!data.quote) throw new Error("Could not load the updated order.");
      updateQuote(data.quote);
      window.dispatchEvent(new Event("mmachine:new-quote-viewed"));
    } catch (err) {
      setMessage((err as Error).message || "Could not mark viewed");
    }
  }

  async function patchQuote(
    quote: QuoteRequest,
    options: { emailCustomer?: boolean; markPaid?: boolean; saveNoEmail?: boolean; label: string }
  ) {
    setSavingAction(`${quote.id}:${options.label}`);
    setMessage("");
    setActionNotice(null);
    try {
      const res = await fetch("/api/quote-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quote,
          emailCustomer: Boolean(options.emailCustomer),
          markPaid: Boolean(options.markPaid),
          saveNoEmail: Boolean(options.saveNoEmail),
        }),
      });
      const data = await res.json() as { error?: string; quote?: QuoteRequest };
      if (!res.ok) {
        if (data.quote) updateQuote(data.quote);
        throw new Error(data.error || "Save failed");
      }

      if (!data.quote) throw new Error("Save completed without returning the order.");
      const updated = data.quote;
      updateQuote(updated);
      if (updated.status === "closed") {
        setMessage(`Deleted ${updated.id}.`);
        return;
      }
      const wasPreviouslySent = Boolean(quote.customerEmailSentAt);
      const text = options.markPaid
        ? "Order marked as paid."
        : options.saveNoEmail
          ? "Invoice saved without email and moved to pending payment."
          : options.emailCustomer
          ? wasPreviouslySent
            ? "Updated invoice emailed to customer."
            : "Invoice emailed to customer and marked as invoice sent."
          : "Order saved.";

      if (selectedId === updated.id) {
        setActionNotice({ quoteId: updated.id, tone: "success", text });
      } else {
        setMessage(text);
      }
    } catch (err) {
      const text = (err as Error).message || "Save failed";
      if (options.emailCustomer || selectedId === quote.id) {
        setActionNotice({ quoteId: quote.id, tone: "error", text });
      } else {
        setMessage(text);
      }
    } finally {
      setSavingAction("");
    }
  }

  async function saveDraft(emailCustomer = false) {
    if (!draft) return;
    await patchQuote(draft, { emailCustomer, label: emailCustomer ? "email" : "save" });
  }

  async function saveNoEmail() {
    if (!draft) return;
    await patchQuote(draft, { saveNoEmail: true, label: "save-no-email" });
  }

  async function markPaid(quote: QuoteRequest) {
    await patchQuote(quote, { markPaid: true, label: "paid" });
  }

  async function deleteQuote(quote: QuoteRequest) {
    setSavingAction(`${quote.id}:delete`);
    setMessage("");
    setActionNotice(null);
    try {
      const res = await fetch("/api/quote-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quote.id }),
      });
      const data = await res.json() as { error?: string; quote?: QuoteRequest };
      if (!res.ok) throw new Error(data.error || "Order could not be deleted.");
      if (data.quote) updateQuote(data.quote);
      else removeQuoteFromDashboard(quote.id);
      setPendingDelete(null);
      setMessage(`Deleted ${quoteDisplayRef(quote)}.`);
    } catch (err) {
      setMessage((err as Error).message || "Order could not be deleted.");
    } finally {
      setSavingAction("");
    }
  }

  function setRefundAmount(bucket: QuoteAccountingBucket, value: string) {
    setRefundDraft((current) => ({
      ...current,
      amounts: { ...current.amounts, [bucket]: value },
    }));
  }

  function fillFullRefund() {
    if (!draft) return;
    const remaining = remainingRefundByBucket(draft);
    setRefundDraft((current) => ({
      ...current,
      open: true,
      amounts: ACCOUNTING_BUCKETS.reduce((amounts, bucket) => {
        amounts[bucket] = remaining[bucket] > 0 ? remaining[bucket].toFixed(2) : "";
        return amounts;
      }, {} as Record<QuoteAccountingBucket, string>),
    }));
  }

  async function saveRefund() {
    if (!draft) return;
    const lines = ACCOUNTING_BUCKETS
      .map((bucket) => ({
        bucket,
        amountExVat: priceFromInput(refundDraft.amounts[bucket]) ?? 0,
      }))
      .filter((line) => line.amountExVat > 0);

    if (lines.length === 0) {
      setActionNotice({ quoteId: draft.id, tone: "error", text: "Add at least one refund amount." });
      return;
    }

    setSavingAction(`${draft.id}:refund`);
    setMessage("");
    setActionNotice(null);
    try {
      const res = await fetch("/api/quote-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          refund: {
            reason: refundDraft.reason,
            lines,
          },
        }),
      });
      const data = await res.json() as { error?: string; quote?: QuoteRequest };
      if (!res.ok) throw new Error(data.error || "Refund could not be saved.");
      if (!data.quote) throw new Error("Refund saved without returning the order.");
      updateQuote(data.quote);
      setRefundDraft(blankRefundDraft());
      setActionNotice({ quoteId: data.quote.id, tone: "success", text: "Refund saved and sales totals updated." });
    } catch (err) {
      setActionNotice({
        quoteId: draft.id,
        tone: "error",
        text: (err as Error).message || "Refund could not be saved.",
      });
    } finally {
      setSavingAction("");
    }
  }

  const draftTotals = draft ? totals(draft) : null;
  const hasDraftPoaItems = Boolean(draftTotals?.hasPoaItems);
  const draftCustomerInvoiceWasSent = draft ? Boolean(draft.customerEmailSentAt) : false;
  const draftInvoiceWasSaved = draft ? Boolean(draft.invoiceSentAt) : false;
  const invoiceReady = draft
    ? draft.items.every((item) => typeof item.unitPriceExVat === "number" && item.unitPriceExVat >= 0)
    : false;
  const isSaving = Boolean(savingAction);
  const showingFrom = historyCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, historyCount);
  const draftRefundRemaining = draft ? remainingRefundByBucket(draft) : null;
  const draftRefunds = draft ? quoteRefunds(draft) : [];
  const draftHasRefundCapacity = Boolean(
    draftRefundRemaining && ACCOUNTING_BUCKETS.some((bucket) => draftRefundRemaining[bucket] > 0)
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-racing mb-1">Quote requests</h1>
        <p className="text-ink-muted text-sm">
          Review new website orders, email the invoice to the buyer, then manually mark it paid when money arrives.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-lg bg-cream-dark border border-racing/10 p-3 text-sm text-racing">
          {message}
        </div>
      )}

      <div className="space-y-5">
        <div className="rounded-xl border border-racing/10 bg-white p-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Order type
              </div>
              {ORDER_REQUEST_FILTERS.map((filter) => {
                const active = orderRequestFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => {
                      setOrderRequestFilter(filter.value);
                      setPage(1);
                    }}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-racing text-cream"
                        : "text-racing hover:bg-cream-dark"
                    }`}
                  >
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={openPaymentSettings}
              className="btn-secondary px-3 py-2 text-sm"
            >
              Payment settings
            </button>
          </div>
        </div>

        <OrderCardSection
          title="New order requests"
          quotes={filteredOpenRequestQuotes}
          empty="No new order requests waiting."
          selectedId={selectedId}
          savingAction={savingAction}
          isSaving={isSaving}
          onSelect={selectQuote}
          onMarkPaid={markPaid}
          onDelete={setPendingDelete}
          dateLabel="Submitted"
          dateForQuote={(quote) => quote.submittedAt}
        />

        <OrderCardSection
          title="Pending payment"
          quotes={filteredPendingPaymentQuotes}
          empty="No sent invoices are awaiting payment."
          selectedId={selectedId}
          savingAction={savingAction}
          isSaving={isSaving}
          onSelect={selectQuote}
          onMarkPaid={markPaid}
          onDelete={setPendingDelete}
          dateLabel="Invoice saved"
          dateForQuote={(quote) => quote.invoiceSentAt || quote.customerEmailSentAt || quote.updatedAt}
        />

        <div ref={historyRef} id="paid-order-history" className="scroll-mt-6 pt-2">
          <h2 className="font-display text-2xl text-racing mb-1">Order history</h2>
          <p className="text-sm text-ink-muted">
            Paid orders only. Unpaid quote requests stay above until they are marked paid.
          </p>
        </div>

        <div className="min-w-0 bg-white rounded-xl border border-racing/10 overflow-hidden">
          <div className="border-b border-racing/10 p-4">
            <label className="label" htmlFor="order-search">Search paid order history</label>
            <input
              id="order-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input"
              placeholder="Name, email, order ref, item, part code..."
            />

            <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="label" htmlFor="time-filter">Time period</label>
                <select
                  id="time-filter"
                  value={timeFilter}
                  onChange={(e) => {
                    setTimeFilter(e.target.value as TimeFilter);
                    setMonthFilter("");
                  }}
                  className="input"
                >
                  {TIME_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>{filter.label}</option>
                  ))}
                </select>
              </div>
              <div className="pb-2 text-right text-xs text-ink-muted">
                {showingFrom}-{showingTo} of {historyCount}
              </div>
            </div>
            {monthFilter && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-cream-dark px-3 py-2 text-sm text-racing">
                <span>Showing {formatMonth(monthFilter)}</span>
                <button
                  type="button"
                  onClick={() => setMonthFilter("")}
                  className="text-xs font-semibold underline hover:text-gold"
                >
                  Clear month
                </button>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-racing/10 bg-cream-dark p-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-racing">Sage export</div>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    Downloads paid website sales and refunds in the SageBook format.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted" htmlFor="export-from">From</label>
                    <input
                      id="export-from"
                      type="date"
                      value={exportFrom}
                      onChange={(event) => setExportFrom(event.target.value)}
                      className="input min-h-0 w-[10.75rem] px-2 py-2 pr-1 text-sm leading-tight"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted" htmlFor="export-to">To</label>
                    <input
                      id="export-to"
                      type="date"
                      value={exportTo}
                      onChange={(event) => setExportTo(event.target.value)}
                      className="input min-h-0 w-[10.75rem] px-2 py-2 pr-1 text-sm leading-tight"
                    />
                  </div>
                  <div className="flex gap-2">
                    {(exportFrom || exportTo) && (
                      <button
                        type="button"
                        onClick={() => {
                          setExportFrom("");
                          setExportTo("");
                        }}
                        className="rounded-lg border border-racing/20 px-3 py-2 text-sm font-semibold text-racing hover:bg-white"
                      >
                        Clear
                      </button>
                    )}
                    <a href={exportHref} className="btn-primary whitespace-nowrap px-4 py-2 text-sm">
                      {exportButtonLabel}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-5 p-4 transition-opacity ${historyLoading ? "opacity-60" : "opacity-100"}`} aria-busy={historyLoading}>
            {historyLoading && (
              <div className="rounded-lg bg-cream-dark p-3 text-sm text-ink-muted" aria-live="polite">
                Loading order history...
              </div>
            )}
            {!historyLoading && pageQuotes.length === 0 && (
              <div className="rounded-lg bg-cream-dark p-5 text-sm text-ink-muted">
                No orders match that search.
              </div>
            )}
            {pageGroups.map((group) => (
              <section key={group.key} id={`order-month-${group.key}`} className="scroll-mt-6">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-racing/10 pb-2">
                  <h2 className="font-display text-xl text-racing">{group.label}</h2>
                  <div className="text-xs font-semibold text-ink-muted">
                    Sales {money(group.salesValue)} / {group.salesCount} {group.salesCount === 1 ? "sale" : "sales"}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {group.quotes.map((quote) => (
                    <OrderCard
                      key={quote.id}
                      quote={quote}
                      selectedId={selectedId}
                      savingAction={savingAction}
                      isSaving={isSaving}
                      onSelect={selectQuote}
                      onMarkPaid={markPaid}
                      onDelete={setPendingDelete}
                      dateLabel="Paid"
                      dateValue={quote.paidAt || quote.updatedAt}
                      showMarkPaid={false}
                      showDelete={false}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-racing/10 p-4">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-racing/20 px-3 py-2 text-sm text-racing disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <div className="text-sm text-ink-muted">
              Page {currentPage} of {pageCount}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="rounded-lg border border-racing/20 px-3 py-2 text-sm text-racing disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        {draft && selected && (
          <div
            className="fixed inset-0 z-[90] bg-racing-dark/65 p-2 sm:p-5"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeInvoice();
            }}
          >
            <InvoicePrintSheet quote={draft} paymentSettings={paymentSettings} />
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="invoice-editor-title"
              className="mx-auto flex h-[calc(100vh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[calc(100vh-2.5rem)]"
            >
              <div className="shrink-0 border-b border-racing/10 px-4 py-3 sm:px-5">
                <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderTypePill quote={draft} />
                    </div>
                    <h2 id="invoice-editor-title" className="mt-1 truncate font-display text-2xl text-racing">
                      {draft.customer.name}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
                      <span>Invoice {quoteDisplayRef(draft)}</span>
                      <span>Submitted {formatDateTime(draft.submittedAt)}</span>
                      <span>{draft.customer.email}</span>
                      {draft.customer.phone && <span>{draft.customer.phone}</span>}
                      {draft.customer.company && <span>{draft.customer.company}</span>}
                    </div>
                  </div>
                  <div className="w-full justify-self-end">
                    <div>
                      <label className="label !mb-1 text-[11px]" htmlFor="status">Status</label>
                      <select
                        id="status"
                        value={draft.status}
                        onChange={(e) => patchDraft({ status: e.target.value as QuoteStatus })}
                        className="input min-h-0 py-2 text-sm leading-tight"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" onClick={closeInvoice} className="btn-secondary mt-2 w-full px-3 py-2 text-sm">
                      Close
                    </button>
                  </div>
                </div>
                {(draftCustomerInvoiceWasSent || draftInvoiceWasSaved) && (
                  <div className="mt-3 rounded-lg bg-cream-dark px-3 py-2 text-xs font-semibold text-racing">
                    {draftCustomerInvoiceWasSent
                      ? `Customer invoice last emailed ${formatDateTime(draft.customerEmailSentAt)}. Edits can be sent with the updated invoice button.`
                      : `Invoice saved without email ${formatDateTime(draft.invoiceSentAt)}.`}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0 space-y-4">
                    {hasMiniItems(draft) && (
                      <section className="rounded-lg border border-racing/10 p-3 text-sm">
                        <div className="label !mb-2">Vehicle details</div>
                        <dl className="grid gap-2 sm:grid-cols-2">
                          {vehicleDetailRows(draft).map((row) => (
                            <div key={row.label} className="rounded-md bg-cream-dark px-3 py-2">
                              <dt className="text-[11px] uppercase tracking-wider text-ink-muted">{row.label}</dt>
                              <dd className={`mt-0.5 text-sm font-semibold ${row.value ? "text-racing" : "text-amber-800"}`}>
                                {row.value || "Not supplied"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    )}

                    <section className="rounded-lg border border-racing/10 bg-cream-dark p-3 text-sm">
                      <div className="label !mb-1">Delivery</div>
                      {(() => {
                        const deliveryAddress = quoteDeliveryAddress(draft.customer);
                        if (deliveryAddress) {
                          return <p className="whitespace-pre-wrap">{deliveryAddress}</p>;
                        }
                        if (quoteCustomerWillArrangeDelivery(draft.customer)) {
                          return <p>Customer will arrange delivery / collection.</p>;
                        }
                        return (
                          <p className="font-semibold text-amber-800">
                            Delivery address was not supplied. Contact the customer before arranging carriage.
                          </p>
                        );
                      })()}
                    </section>

                    {quoteKind(draft) === "custom" && (
                      <section className="rounded-lg border border-racing/10 p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-ink-muted">Custom work context</div>
                            <h3 className="font-display text-xl text-racing">Customer job description</h3>
                          </div>
                          {customFiles(draft).length > 0 && (
                            <span className="rounded-full bg-cream-dark px-3 py-1 text-xs font-semibold text-racing">
                              {customFiles(draft).length} {customFiles(draft).length === 1 ? "file" : "files"}
                            </span>
                          )}
                        </div>
                        <div className="rounded-md bg-cream-dark px-3 py-2 text-sm">
                          <p className="whitespace-pre-wrap leading-6 text-ink">
                            {customBrief(draft) || "No job description supplied."}
                          </p>
                        </div>
                        {customJobRows(draft).length > 0 && (
                          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {customJobRows(draft).map((row) => (
                              <div key={row.label} className="rounded-md bg-cream-dark px-3 py-2">
                                <dt className="text-[11px] uppercase tracking-wider text-ink-muted">{row.label}</dt>
                                <dd className="mt-0.5 text-sm font-semibold text-racing">{row.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {customFiles(draft).length > 0 && (
                          <div className="mt-3 rounded-md bg-cream-dark p-3 text-sm">
                            <div className="label !mb-2">Uploaded design files</div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {customFiles(draft).map((file) => (
                                <a
                                  key={file.key}
                                  href={fileHref(file.key)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-w-0 rounded-md bg-white px-3 py-2 font-semibold text-racing hover:text-gold"
                                >
                                  <span className="block truncate">{file.name}</span>
                                  <span className="block text-xs font-normal text-ink-muted">
                                    {Math.ceil(file.size / 1024)} KB
                                  </span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    {draft.customer.message && quoteKind(draft) !== "custom" && (
                      <section className="rounded-lg border border-racing/10 bg-cream-dark p-3 text-sm">
                        <div className="label !mb-1">Customer note</div>
                        <p className="whitespace-pre-wrap">{draft.customer.message}</p>
                      </section>
                    )}

                    <section className="rounded-lg border border-racing/10">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-racing/10 bg-cream-dark px-3 py-2">
                        <div className="text-sm font-semibold text-racing">Invoice</div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-racing">
                          {draft.items.length} {draft.items.length === 1 ? "line" : "lines"}
                        </span>
                      </div>

                      <div className="hidden grid-cols-[72px_minmax(0,1fr)_92px_132px] gap-3 border-b border-racing/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted lg:grid">
                        <div>Qty</div>
                        <div>Item</div>
                        <div>Unit</div>
                        <div className="text-right">{priceLabel(draft)}</div>
                      </div>

                      <div className="divide-y divide-racing/10">
                        {draft.items.map((item, index) => {
                          const manualLine = isManualLine(item);
                          const ownerAdded = isOwnerAddedLine(item);
                          return (
                            <div key={item.key} className="grid gap-3 p-3 lg:grid-cols-[72px_minmax(0,1fr)_92px_132px] lg:items-start">
                              <div>
                                <label className="label lg:hidden" htmlFor={`qty-${draft.id}-${index}`}>Qty</label>
                                {manualLine ? (
                                  <input
                                    id={`qty-${draft.id}-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={item.qty}
                                    onChange={(e) => patchItem(index, { qty: clampQty(e.target.value) })}
                                    className="input text-center font-semibold text-racing"
                                  />
                                ) : (
                                  <div className="rounded-md border border-racing/10 bg-cream-dark px-3 py-2 text-center font-semibold text-racing">
                                    {item.qty}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <label className="label lg:hidden" htmlFor={`description-${draft.id}-${index}`}>Item</label>
                                {manualLine ? (
                                  <textarea
                                    id={`description-${draft.id}-${index}`}
                                    value={item.description}
                                    onChange={(e) => patchItem(index, { description: e.target.value })}
                                    rows={2}
                                    className="input min-h-[74px] resize-y text-sm leading-5"
                                  />
                                ) : (
                                  <div className="rounded-md border border-racing/10 bg-white px-3 py-2">
                                    <div className="font-semibold leading-5 text-racing">{invoiceItemTitle(item)}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                      <span>{invoiceLineSubtitle(item)}</span>
                                      {invoiceLineDimension(item) && (
                                        <span className="rounded-full bg-cream-dark px-2 py-0.5 font-semibold text-racing">
                                          {invoiceLineDimension(item)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="label lg:hidden" htmlFor={`unit-${draft.id}-${index}`}>Unit</label>
                                {manualLine ? (
                                  <input
                                    id={`unit-${draft.id}-${index}`}
                                    value={item.unit || ""}
                                    onChange={(e) => patchItem(index, { unit: e.target.value })}
                                    className="input"
                                  />
                                ) : (
                                  <div className="truncate whitespace-nowrap rounded-md border border-racing/10 bg-cream-dark px-2 py-2 text-center text-[11px] font-semibold leading-5 text-racing">
                                    {item.unit || "each"}
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="label lg:hidden" htmlFor={`price-${draft.id}-${index}`}>{priceLabel(draft)}</label>
                                <input
                                  id={`price-${draft.id}-${index}`}
                                  type="number"
                                  step="0.01"
                                  value={item.unitPriceExVat ?? ""}
                                  onChange={(e) => {
                                    const unitPriceExVat = e.target.value === "" ? null : Number(e.target.value);
                                    patchItem(index, {
                                      unitPriceExVat,
                                      unitPriceIncVat: incVatFromExVat(unitPriceExVat),
                                    });
                                  }}
                                  className="input text-right"
                                  placeholder="0.00"
                                />
                                <div className="mt-1 text-right text-xs font-semibold text-ink-muted">
                                  Line {invoiceMoney(lineExVat(item))}
                                </div>
                                {ownerAdded && (
                                  <button
                                    type="button"
                                    onClick={() => removeDraftLine(index)}
                                    className="mt-1 text-xs font-semibold text-red-700 hover:underline"
                                  >
                                    Remove line
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-lg border border-racing/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="text-sm font-semibold text-racing">Add new line</div>
                          {addLineNotice && (
                            <span aria-live="polite" className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                              {addLineNotice.text === "Qty +1" ? "Quantity increased" : "Added"}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAddLineOpen((open) => !open)}
                          className="btn-secondary px-3 py-2 text-sm"
                          aria-expanded={addLineOpen}
                        >
                          {addLineOpen ? "Hide" : "Add New Line"}
                        </button>
                      </div>

                      {addLineOpen && (
                        <div className="mt-3 space-y-3 border-t border-racing/10 pt-3">
                          <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                            <div>
                              <label className="label" htmlFor="add-line-catalogue">Part type</label>
                              <select
                                id="add-line-catalogue"
                                value={addLineCatalogue}
                                onChange={(event) => {
                                  setAddLineCatalogue(event.target.value as AddLineCatalogue);
                                  setAddLineQuery("");
                                }}
                                className="input"
                              >
                                <option value="mini">Mini panels</option>
                                <option value="metals">Metals</option>
                              </select>
                            </div>
                            <div>
                              <label className="label" htmlFor="add-line-search">Search catalogue</label>
                              <input
                                id="add-line-search"
                                type="search"
                                value={addLineQuery}
                                onChange={(event) => setAddLineQuery(event.target.value)}
                                className="input"
                                placeholder={addLineCatalogue === "metals" ? "Shape, metal, spec, size, or code" : "Part number, title, or fitment"}
                              />
                            </div>
                          </div>

                          {addLineError && (
                            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                              {addLineError}
                            </div>
                          )}

                          <div className="rounded-md border border-racing/10">
                            <div className="flex items-center justify-between gap-3 border-b border-racing/10 bg-cream-dark px-3 py-2 text-xs text-ink-muted">
                              <span>{addLineLoading ? "Searching..." : `${addLineResults.length} of ${addLineCount} matches`}</span>
                              {addLineQuery.trim() && (
                                <button
                                  type="button"
                                  onClick={() => setAddLineQuery("")}
                                  className="font-semibold text-racing hover:text-gold"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <div className="max-h-56 overflow-y-auto divide-y divide-racing/10">
                              {addLineResults.map((product) => (
                                (() => {
                                  const activeNotice = addLineNotice?.catalogue === addLineCatalogue && addLineNotice.productId === product.id
                                    ? addLineNotice.text
                                    : "";
                                  return (
                                    <button
                                      type="button"
                                      key={`${addLineCatalogue}-${product.id}`}
                                      onClick={() => addCatalogueLine(product)}
                                      className="grid w-full gap-3 px-3 py-2 text-left hover:bg-cream-dark sm:grid-cols-[minmax(0,1fr)_96px_auto] sm:items-center"
                                      aria-label={`Add ${catalogueResultTitle(product, addLineCatalogue)} to invoice`}
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-racing">
                                          {catalogueResultTitle(product, addLineCatalogue)}
                                        </span>
                                        <span className="block truncate text-xs text-ink-muted">
                                          {catalogueResultSubtitle(product, addLineCatalogue)}
                                        </span>
                                      </span>
                                      <span className="text-sm font-semibold text-racing sm:text-right">
                                        {money(product.priceExVat)}
                                      </span>
                                      <span className={`rounded-md px-3 py-1 text-center text-xs font-semibold ${activeNotice ? "bg-green-50 text-green-800" : "bg-racing text-cream"}`}>
                                        {activeNotice || "Add"}
                                      </span>
                                    </button>
                                  );
                                })()
                              ))}
                              {!addLineLoading && addLineResults.length === 0 && (
                                <div className="px-3 py-4 text-sm text-ink-muted">
                                  No catalogue lines match that search.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-md bg-cream-dark p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                              Manual line
                            </div>
                            <div className="grid gap-3 lg:grid-cols-[72px_minmax(0,1fr)_92px_132px_auto] lg:items-end">
                              <div>
                                <label className="label" htmlFor="manual-line-qty">Qty</label>
                                <input
                                  id="manual-line-qty"
                                  value={manualLine.qty}
                                  onChange={(event) => setManualLine((line) => ({ ...line, qty: event.target.value }))}
                                  className="input text-center font-semibold text-racing"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                />
                              </div>
                              <div>
                                <label className="label" htmlFor="manual-line-item">Item</label>
                                <input
                                  id="manual-line-item"
                                  value={manualLine.item}
                                  onChange={(event) => setManualLine((line) => ({ ...line, item: event.target.value }))}
                                  className="input"
                                  placeholder="Description shown on invoice"
                                />
                              </div>
                              <div>
                                <label className="label" htmlFor="manual-line-unit">Unit</label>
                                <input
                                  id="manual-line-unit"
                                  value={manualLine.unit}
                                  onChange={(event) => setManualLine((line) => ({ ...line, unit: event.target.value }))}
                                  className="input"
                                />
                              </div>
                              <div>
                                <label className="label" htmlFor="manual-line-price">{priceLabel(draft)}</label>
                                <input
                                  id="manual-line-price"
                                  type="number"
                                  step="0.01"
                                  value={manualLine.priceExVat}
                                  onChange={(event) => setManualLine((line) => ({ ...line, priceExVat: event.target.value }))}
                                  className="input text-right"
                                  placeholder="0.00"
                                />
                              </div>
                              <button type="button" onClick={addManualLine} className="btn-primary px-4 py-2 text-sm">
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>

                  <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                    <section className="rounded-lg border border-racing/10 bg-cream-dark p-3 text-sm">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-wider text-ink-muted">Invoice state</span>
                        <StatusPill status={draft.status} />
                      </div>
                      <div className="space-y-1 text-ink-muted">
                        <div className="flex justify-between gap-3">
                          <span>Invoice</span>
                          <strong className="text-right text-racing">
                            {draft.websiteInvoiceNumber
                              ? websiteInvoiceDisplay(draft)
                              : draft.invoiceSentAt
                                ? formatDateTime(draft.invoiceSentAt)
                                : "Not sent"}
                          </strong>
                        </div>
                        {draft.websiteInvoiceNumber && draft.invoiceSentAt && (
                          <div className="flex justify-between gap-3">
                            <span>{draft.customerEmailSentAt ? "Sent" : "Saved"}</span>
                            <strong className="text-right text-racing">{formatDateTime(draft.invoiceSentAt)}</strong>
                          </div>
                        )}
                        <div className="flex justify-between gap-3">
                          <span>Payment</span>
                          <strong className="text-right text-racing">
                            {draft.paidAt ? formatDateTime(draft.paidAt) : "Awaiting"}
                          </strong>
                        </div>
                        {draft.paidAt && (
                          <div className="flex justify-between gap-3">
                            <span>Paid by</span>
                            <strong className="text-right text-racing">
                              {paymentMethodLabel(draft.paymentMethod)}
                            </strong>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-lg border border-racing/10 p-3">
                      <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-md border border-racing/10 bg-cream-dark px-3 py-2">
                        <input
                          type="checkbox"
                          checked={quoteIncludesVat(draft)}
                          onChange={(e) => patchDraft({ includeVat: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-racing/30 text-racing accent-racing"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-racing">Include VAT</span>
                        </span>
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="label" htmlFor="carriage">{baseTotalLabel(draft, "Carriage")}</label>
                          <input
                            id="carriage"
                            type="number"
                            step="0.01"
                            value={draft.carriageExVat ?? ""}
                            onChange={(e) => patchDraft({ carriageExVat: e.target.value === "" ? null : Number(e.target.value) })}
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor="extra-charges">{baseTotalLabel(draft, "Cut Charge")}</label>
                          <input
                            id="extra-charges"
                            type="number"
                            step="0.01"
                            value={draft.extraChargesExVat ?? ""}
                            onChange={(e) => patchDraft({ extraChargesExVat: e.target.value === "" ? null : Number(e.target.value) })}
                            className="input"
                          />
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 rounded-md bg-cream-dark p-3 text-sm">
                        {hasDraftPoaItems && (
                          <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            Totals calculate after every invoice line has a price.
                          </div>
                        )}
                        <div className="flex justify-between gap-3"><span>{baseTotalLabel(draft, "Goods")}</span><strong>{totalsReadyText(draftTotals?.goods, hasDraftPoaItems)}</strong></div>
                        {draftTotals && draftTotals.refunds > 0 && (
                          <div className="flex justify-between gap-3 text-red-700">
                            <span>{baseTotalLabel(draft, "Refunds")}</span>
                            <strong>-{totalsReadyText(draftTotals.refunds, hasDraftPoaItems)}</strong>
                          </div>
                        )}
                        {draftTotals && draftTotals.carriage > 0 && (
                          <div className="flex justify-between gap-3">
                            <span>{baseTotalLabel(draft, "Carriage")}</span>
                            <strong>{money(draftTotals.carriage)}</strong>
                          </div>
                        )}
                        {draftTotals && draftTotals.extra > 0 && (
                          <div className="flex justify-between gap-3">
                            <span>{baseTotalLabel(draft, "Cut Charge")}</span>
                            <strong>{money(draftTotals.extra)}</strong>
                          </div>
                        )}
                        {quoteIncludesVat(draft) ? (
                          <>
                            <div className="flex justify-between gap-3"><span>VAT</span><strong>{totalsReadyText(draftTotals?.vat, hasDraftPoaItems)}</strong></div>
                            <div className="flex justify-between gap-3"><span>Total ex VAT</span><strong>{totalsReadyText(draftTotals?.totalEx, hasDraftPoaItems)}</strong></div>
                            <div className="flex justify-between gap-3 text-racing"><span>Total inc VAT</span><strong>{totalsReadyText(draftTotals?.totalInc, hasDraftPoaItems)}</strong></div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between gap-3"><span>VAT</span><strong>Not applied</strong></div>
                            <div className="flex justify-between gap-3 text-racing"><span>Total</span><strong>{totalsReadyText(draftTotals?.totalInc, hasDraftPoaItems)}</strong></div>
                          </>
                        )}
                      </div>
                    </section>

                    <section>
                      <label className="label" htmlFor="payment-link">Payment link</label>
                      <input
                        id="payment-link"
                        type="url"
                        value={draft.paymentLink || ""}
                        onChange={(event) => patchDraft({ paymentLink: event.target.value })}
                        className="input text-sm"
                        placeholder="https://..."
                      />
                    </section>

                    {isPaidQuote(draft) && (
                      <section className="rounded-lg border border-racing/10 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-racing">Refunds</div>
                            <div className="text-xs text-ink-muted">
                              {draftRefunds.length > 0
                                ? `${draftRefunds.length} recorded`
                                : "No refunds yet"}
                            </div>
                          </div>
                          {draftHasRefundCapacity && (
                            <button
                              type="button"
                              onClick={() => setRefundDraft((current) => ({ ...current, open: !current.open }))}
                              className="btn-secondary px-3 py-2 text-sm"
                              aria-expanded={refundDraft.open}
                            >
                              {refundDraft.open ? "Hide" : "Add refund"}
                            </button>
                          )}
                        </div>

                        {draftRefunds.length > 0 && (
                          <div className="mb-3 space-y-2">
                            {draftRefunds.map((refund) => {
                              const net = refundNetExVat(refund);
                              return (
                                <div key={refund.id} className="rounded-md bg-cream-dark p-3 text-xs">
                                  <div className="flex items-start justify-between gap-3 font-semibold text-racing">
                                    <span>Refund recorded<br /><span className="font-normal text-ink-muted">{formatDateTime(refund.createdAt)}</span></span>
                                    <span className="text-right text-sm">-{money(net)}</span>
                                  </div>
                                  <div className="mt-2 grid gap-1">
                                    {refund.lines.map((line) => (
                                      <div key={`${refund.id}-${line.bucket}`} className="flex justify-between gap-3 text-ink-muted">
                                        <span>{ACCOUNTING_BUCKET_LABELS[line.bucket]}</span>
                                        <span>-{money(line.amountExVat)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {refund.reason && <div className="mt-1 text-ink-muted">{refund.reason}</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!draftHasRefundCapacity && (
                          <div className="rounded-md bg-cream-dark px-3 py-2 text-xs text-ink-muted">
                            This order has no remaining refundable value.
                          </div>
                        )}

                        {refundDraft.open && draftRefundRemaining && (
                          <div className="space-y-3 border-t border-racing/10 pt-3">
                            <p className="text-xs leading-5 text-ink-muted">
                              Enter refund amounts against the part of the invoice being refunded.
                            </p>
                            <div className="grid gap-2">
                              {ACCOUNTING_BUCKETS.map((bucket) => {
                                const remaining = draftRefundRemaining[bucket];
                                if (remaining <= 0) return null;
                                return (
                                  <div key={bucket}>
                                    <label className="label" htmlFor={`refund-${bucket}`}>
                                      {ACCOUNTING_BUCKET_LABELS[bucket]}
                                    </label>
                                    <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2">
                                      <span className="text-xs text-ink-muted">Remaining {money(remaining)}</span>
                                      <input
                                        id={`refund-${bucket}`}
                                        type="number"
                                        min="0"
                                        max={remaining}
                                        step="0.01"
                                        value={refundDraft.amounts[bucket]}
                                        onChange={(event) => setRefundAmount(bucket, event.target.value)}
                                        className="input text-right"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div>
                              <label className="label" htmlFor="refund-reason">Reason or note</label>
                              <textarea
                                id="refund-reason"
                                value={refundDraft.reason}
                                onChange={(event) => setRefundDraft((current) => ({ ...current, reason: event.target.value }))}
                                rows={2}
                                className="input resize-none text-sm"
                                placeholder="Optional note for the order record"
                              />
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={fillFullRefund}
                                disabled={isSaving}
                                className="rounded-lg border border-racing/20 px-3 py-2 text-sm font-semibold text-racing hover:bg-cream-dark disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Full remaining refund
                              </button>
                              <button
                                type="button"
                                onClick={saveRefund}
                                disabled={isSaving}
                                className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {savingAction === `${draft.id}:refund` ? "Saving..." : "Save refund"}
                              </button>
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    <section>
                      <label className="label" htmlFor="customer-message">Message to customer</label>
                      <textarea
                        id="customer-message"
                        value={draft.customerMessage || ""}
                        onChange={(e) => patchDraft({ customerMessage: e.target.value })}
                        rows={4}
                        className="input resize-none text-sm"
                        placeholder="Delivery timing, collection notes, payment instructions, etc."
                      />
                    </section>

                    <section>
                      <label className="label" htmlFor="owner-notes">Owner notes</label>
                      <textarea
                        id="owner-notes"
                        value={draft.ownerNotes || ""}
                        onChange={(e) => patchDraft({ ownerNotes: e.target.value })}
                        rows={4}
                        className="input resize-none text-sm"
                        placeholder="Private notes for the owner dashboard"
                      />
                    </section>

                    {actionNotice && actionNotice.quoteId === draft.id && (
                      <div
                        className={`rounded-lg border p-3 text-sm ${
                          actionNotice.tone === "error"
                            ? "border-red-200 bg-red-50 text-red-800"
                            : "border-racing/10 bg-cream-dark text-racing"
                        }`}
                      >
                        {actionNotice.text}
                      </div>
                    )}

                    {!invoiceReady && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        Add a price to every invoice line before emailing it to the customer.
                        {draft && quoteIncludesVat(draft) ? " VAT is added automatically." : ""}
                      </div>
                    )}
                  </aside>
                </div>
              </div>

              <div className="shrink-0 border-t border-racing/10 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {draft.status !== "paid" && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setPendingDelete(draft)}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete job
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={printInvoice}
                      className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Print
                    </button>
                  </div>

                  <div className="flex flex-wrap items-end justify-end gap-3">
                    {draft.status !== "paid" && (
                      <div className="flex items-end gap-2">
                        <div className="w-32">
                          <label className="label !mb-1 text-[11px]" htmlFor="payment-method">Paid by</label>
                          <select
                            id="payment-method"
                            value={draft.paymentMethod || "card"}
                            onChange={(event) => patchDraft({ paymentMethod: event.target.value as QuotePaymentMethod })}
                            className="input min-h-0 py-2 text-sm"
                          >
                            {PAYMENT_METHOD_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => markPaid({ ...draft, paymentMethod: draft.paymentMethod || "card" })}
                          className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingAction === `${draft.id}:paid` ? "Saving..." : "Mark Paid"}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={isSaving || !invoiceReady}
                      onClick={saveNoEmail}
                      className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingAction === `${draft.id}:save-no-email` ? "Saving..." : "Save, No Email"}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || !invoiceReady}
                      onClick={() => saveDraft(true)}
                      className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingAction === `${draft.id}:email`
                        ? "Sending..."
                        : draftCustomerInvoiceWasSent
                          ? "Send updated invoice"
                          : "Email invoice to buyer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {pendingDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-racing-dark/60 px-4">
            <div role="dialog" aria-modal="true" aria-labelledby="delete-order-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 id="delete-order-title" className="font-display text-2xl text-racing">Delete this job?</h2>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                {quoteDisplayRef(pendingDelete)} for {pendingDelete.customer.name} will be removed from the active dashboard.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  disabled={isSaving}
                  className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteQuote(pendingDelete)}
                  disabled={isSaving}
                  className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAction === `${pendingDelete.id}:delete` ? "Deleting..." : "Delete job"}
                </button>
              </div>
            </div>
          </div>
        )}

        {paymentSettingsOpen && (
          <PaymentSettingsModal
            draft={paymentSettingsDraft}
            saving={paymentSettingsSaving}
            error={paymentSettingsError}
            onChange={(patch) => setPaymentSettingsDraft((current) => ({ ...current, ...patch }))}
            onClose={() => {
              if (!paymentSettingsSaving) setPaymentSettingsOpen(false);
            }}
            onSave={savePaymentSettings}
          />
        )}
      </div>
    </div>
  );
}
