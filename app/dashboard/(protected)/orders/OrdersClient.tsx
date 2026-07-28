"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { QuoteItem, QuoteRequest, QuoteStatus } from "@/lib/quote-types";

const GBP = "\u00a3";
const PAGE_SIZE = 8;
const TZ = "Europe/London";

type TimeFilter = "all" | "today" | "7d" | "month" | "year";

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
  const goods = quote.items.reduce((sum, item) => sum + (lineExVat(item) ?? 0), 0);
  const carriage = quote.carriageExVat ?? 0;
  const extra = quote.extraChargesExVat ?? 0;
  const totalEx = goods + carriage + extra;
  const vat = totalEx * 0.2;
  return { goods, carriage, extra, totalEx, vat, totalInc: totalEx + vat, hasPoaItems };
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

function sameText(a: string | null | undefined, b: string | null | undefined) {
  return compactText(a).toLowerCase() === compactText(b).toLowerCase();
}

function firstText(...values: Array<string | null | undefined>) {
  return values.map(compactText).find(Boolean) || "";
}

function customBrief(quote: QuoteRequest) {
  const item = firstCustomItem(quote);
  return firstText(quote.customer.message, item?.custom?.projectName, item?.description);
}

function customBriefForContext(quote: QuoteRequest) {
  const brief = customBrief(quote);
  if (!brief) return "";
  const duplicateLine = quote.items.some((item) =>
    item.catalogue === "custom" && (sameText(item.description, brief) || sameText(item.custom?.projectName, brief))
  );
  return duplicateLine ? "" : brief;
}

function invoiceReferenceLabel(item: QuoteItem) {
  if (item.catalogue === "custom") return "";
  if (item.catalogue === "featured") return "Featured ref";
  if (item.catalogue === "metals") return "Metal ref";
  return "Part no.";
}

function invoiceReferencePlaceholder(item: QuoteItem) {
  if (item.catalogue === "featured") return "Featured ref";
  if (item.catalogue === "metals") return "Metal code";
  return "Mini part no.";
}

function invoiceLineTypeLabel(item: QuoteItem) {
  if (item.catalogue === "custom") return "Custom work";
  if (item.catalogue === "featured") return "Featured work";
  if (item.catalogue === "metals") return "Metal";
  return "Mini panel";
}

function invoiceLineContext(item: QuoteItem) {
  if (item.catalogue === "custom") {
    const custom = item.custom;
    const quantity = custom?.quantity || String(item.qty || "");
    return [
      custom?.material,
      custom?.thickness,
      custom?.services?.length ? custom.services.join(", ") : "",
      custom?.finish,
      quantity ? `Qty ${quantity}${custom?.units ? ` ${custom.units}` : ""}` : "",
    ].filter(Boolean).join(" / ");
  }

  if (item.catalogue === "metals") {
    return [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" / ");
  }

  if (item.catalogue === "featured") {
    return "Featured Work order line";
  }

  return item.code ? `Mini panel ${item.code}` : "Mini panel order line";
}

function totalsReadyText(value: number | null | undefined, hasPoaItems: boolean) {
  return hasPoaItems ? "Add prices" : money(value);
}

function orderCardSummary(quote: QuoteRequest) {
  const firstItem = quote.items[0];
  if (!firstItem) return "";

  if (quoteKind(quote) === "custom") {
    return firstItem.custom?.projectName || quote.customer.message || "Custom fabrication request";
  }

  return itemName(firstItem);
}

type QuoteKind = "mini" | "metals" | "custom" | "featured" | "mixed";

const KIND_STYLES: Record<QuoteKind, string> = {
  mini: "bg-racing/10 text-racing",
  metals: "bg-cream-dark text-racing",
  custom: "bg-gold/15 text-gold",
  featured: "bg-sky-50 text-sky-800",
  mixed: "bg-stone-100 text-stone-700",
};

const KIND_LABELS: Record<QuoteKind, string> = {
  mini: "Mini parts",
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

function fileHref(key: string) {
  return `/api/quote-files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function cloneQuote(quote: QuoteRequest): QuoteRequest {
  return JSON.parse(JSON.stringify(quote));
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
    <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${KIND_STYLES[kind]}`}>
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

  return (
    <article
      className={`rounded-lg border p-4 transition ${
        selectedId === quote.id
          ? "border-gold bg-cream-dark shadow-sm"
          : "border-racing/10 bg-white hover:border-gold/60"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(quote.id)}
        className="block w-full text-left"
        aria-current={selectedId === quote.id ? "true" : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <OrderTypePill quote={quote} />
            <div className="truncate font-semibold text-racing">{quote.id}</div>
            <div className="mt-1 truncate text-sm font-medium text-ink">{quote.customer.name}</div>
          </div>
          <StatusPill status={quote.status} />
        </div>
        <div className="mt-3 text-xs text-ink-muted">
          {dateLabel}: {formatDateTime(dateValue)}
        </div>
        {orderCardSummary(quote) && (
          <div className="mt-3 max-h-10 overflow-hidden text-sm leading-5 text-ink">
            {orderCardSummary(quote)}
          </div>
        )}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="text-xs text-ink-muted">
            {quote.items.length} {quote.items.length === 1 ? "item" : "items"}
          </div>
          <div className="text-right">
            <div className="font-semibold text-racing">
              {quoteTotals.hasPoaItems ? "POA" : money(quoteTotals.totalEx)}
            </div>
            <div className="text-xs text-ink-muted">ex VAT</div>
          </div>
        </div>
      </button>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-racing/10 pt-3">
        <div className="min-w-0 text-xs text-ink-muted">
          {quote.paidAt
            ? `Paid ${formatDateTime(quote.paidAt)}`
            : quote.invoiceSentAt
              ? `Sent ${formatDateTime(quote.invoiceSentAt)}`
              : "Not invoiced"}
        </div>
        {(showDelete || showMarkPaid) && (
          <div className="flex shrink-0 items-center gap-2">
            {showDelete && (
              <button
                type="button"
                onClick={() => onDelete(quote)}
                disabled={isSaving}
                aria-label={`Delete order ${quote.id}`}
                className="rounded-lg px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Delete
              </button>
            )}
            {showMarkPaid && (
              <button
                type="button"
                onClick={() => onMarkPaid(quote)}
                disabled={isSaving}
                aria-label={`Mark order ${quote.id} as paid`}
                className="shrink-0 rounded-lg border border-racing px-3 py-2 text-xs font-semibold text-racing hover:bg-racing hover:text-cream disabled:cursor-not-allowed disabled:opacity-70"
              >
                {cardSaving && savingAction.endsWith(":paid") ? "Saving..." : "Mark Paid"}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function OrdersClient({
  initialQuotes,
  initialError,
  initialMonth = "",
  initialHistoryCount,
  initialMonthStats,
}: {
  initialQuotes: QuoteRequest[];
  initialError: string;
  initialMonth?: string;
  initialHistoryCount: number;
  initialMonthStats: Record<string, { salesValue: number; salesCount: number }>;
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
  const [page, setPage] = useState(1);
  const [savingAction, setSavingAction] = useState("");
  const [message, setMessage] = useState(initialError);
  const [actionNotice, setActionNotice] = useState<{ quoteId: string; tone: "success" | "error"; text: string } | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);
  const missingDeepLinkNoticeRef = useRef("");
  const closingQuoteIdRef = useRef("");
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

  const selected = useMemo(
    () => quotes.find((quote) => quote.id === selectedId) ?? null,
    [quotes, selectedId]
  );

  const pageCount = Math.max(1, Math.ceil(historyCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageQuotes = historyRows;
  const monthStats = useMemo(() => new Map(Object.entries(historyMonthStats)), [historyMonthStats]);

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
    const params = new URLSearchParams(searchParams.toString());
    params.delete("quote");
    params.delete("order");
    if (quoteId) params.set("quote", quoteId);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openInvoice = useCallback((quote: QuoteRequest, syncUrl = true) => {
    closingQuoteIdRef.current = "";
    setSelectedId(quote.id);
    setDraft(cloneQuote(quote));
    setMessage("");
    setActionNotice(null);
    if (syncUrl) replaceQuoteParam(quote.id);
  }, [replaceQuoteParam]);

  const closeInvoice = useCallback(() => {
    closingQuoteIdRef.current = selectedId || draft?.id || "";
    setSelectedId("");
    setDraft(null);
    setActionNotice(null);
    replaceQuoteParam(null);
  }, [draft?.id, replaceQuoteParam, selectedId]);

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
  }, [currentPage, historyRevision, monthFilter, query, timeFilter]);

  useEffect(() => {
    setPage(1);
  }, [monthFilter, query, timeFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

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
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    window.setTimeout(() => focusable()[0]?.focus(), 0);

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
      modalReturnFocusRef.current?.focus();
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
    options: { emailCustomer?: boolean; markPaid?: boolean; label: string }
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
      const wasPreviouslySent = Boolean(quote.customerEmailSentAt || quote.invoiceSentAt);
      const text = options.markPaid
        ? "Order marked as paid."
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
      setMessage(`Deleted ${quote.id}.`);
    } catch (err) {
      setMessage((err as Error).message || "Order could not be deleted.");
    } finally {
      setSavingAction("");
    }
  }

  const draftTotals = draft ? totals(draft) : null;
  const hasDraftPoaItems = Boolean(draftTotals?.hasPoaItems);
  const draftInvoiceWasSent = draft ? Boolean(draft.customerEmailSentAt || draft.invoiceSentAt) : false;
  const invoiceReady = draft
    ? draft.items.every((item) => typeof item.unitPriceExVat === "number" && item.unitPriceExVat >= 0)
    : false;
  const isSaving = Boolean(savingAction);
  const showingFrom = historyCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, historyCount);

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
        <OrderCardSection
          title="New order requests"
          quotes={openRequestQuotes}
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
          quotes={pendingPaymentQuotes}
          empty="No sent invoices are awaiting payment."
          selectedId={selectedId}
          savingAction={savingAction}
          isSaving={isSaving}
          onSelect={selectQuote}
          onMarkPaid={markPaid}
          onDelete={setPendingDelete}
          dateLabel="Invoice sent"
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
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="invoice-editor-title"
              className="mx-auto flex h-[calc(100vh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[calc(100vh-2.5rem)]"
            >
              <div className="shrink-0 border-b border-racing/10 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderTypePill quote={draft} />
                      <StatusPill status={draft.status} />
                    </div>
                    <h2 id="invoice-editor-title" className="mt-1 truncate font-display text-2xl text-racing">
                      {draft.customer.name}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
                      <span>{draft.id}</span>
                      <span>Submitted {formatDateTime(draft.submittedAt)}</span>
                      <span>{draft.customer.email}</span>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:justify-end">
                    <div className="w-full sm:w-56">
                      <label className="label !mb-1" htmlFor="status">Status</label>
                      <select
                        id="status"
                        value={draft.status}
                        onChange={(e) => patchDraft({ status: e.target.value as QuoteStatus })}
                        className="input min-h-[46px] py-2 text-base leading-normal"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" onClick={closeInvoice} className="btn-secondary min-h-[46px] px-4 py-2 text-sm">
                      Close
                    </button>
                  </div>
                </div>
                {draftInvoiceWasSent && (
                  <div className="mt-3 rounded-lg bg-cream-dark px-3 py-2 text-xs font-semibold text-racing">
                    Customer invoice last emailed {formatDateTime(draft.customerEmailSentAt || draft.invoiceSentAt)}.
                    Edits can be sent with the updated invoice button.
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0 space-y-4">
                    <section className="grid gap-3 rounded-lg border border-racing/10 bg-cream-dark p-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="label !mb-1">Customer</div>
                        <div className="font-semibold text-racing">{draft.customer.name}</div>
                        <div className="break-all text-ink-muted">{draft.customer.email}</div>
                        <div className="text-ink-muted">{draft.customer.phone || "No phone supplied"}</div>
                        {draft.customer.company && <div className="text-ink-muted">{draft.customer.company}</div>}
                      </div>
                      <div>
                        <div className="label !mb-1">Delivery</div>
                        {draft.customer.arrangeOwnDelivery ? (
                          <p>Customer will arrange delivery / collection.</p>
                        ) : (
                          <p className="whitespace-pre-wrap">{draft.customer.address || "No delivery address supplied"}</p>
                        )}
                      </div>
                    </section>

                    {quoteKind(draft) === "custom" && (customBriefForContext(draft) || customJobRows(draft).length > 0) && (
                      <section className="rounded-lg border border-racing/10 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs uppercase tracking-wider text-ink-muted">Custom request</div>
                            <h3 className="font-display text-xl text-racing">Job details</h3>
                          </div>
                        </div>
                        {customBriefForContext(draft) && (
                          <div className="mb-3 rounded-md bg-cream-dark px-3 py-2 text-sm">
                            <div className="label !mb-1">Job brief</div>
                            <p className="whitespace-pre-wrap leading-6 text-ink">{customBriefForContext(draft)}</p>
                          </div>
                        )}
                        {customJobRows(draft).length > 0 && (
                          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {customJobRows(draft).map((row) => (
                              <div key={row.label} className="rounded-md bg-cream-dark px-3 py-2">
                                <dt className="text-[11px] uppercase tracking-wider text-ink-muted">{row.label}</dt>
                                <dd className="mt-0.5 text-sm font-semibold text-racing">{row.value}</dd>
                              </div>
                            ))}
                          </dl>
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
                        <div>
                          <div className="text-xs uppercase tracking-wider text-ink-muted">Invoice lines</div>
                          <div className="text-sm font-semibold text-racing">
                            {quoteKind(draft) === "custom" ? "Customer-facing wording and price" : "Check quantities and pricing"}
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-racing">
                          {draft.items.length} {draft.items.length === 1 ? "line" : "lines"}
                        </span>
                      </div>

                      <div className="divide-y divide-racing/10">
                        {draft.items.map((item, index) => {
                          const referenceLabel = invoiceReferenceLabel(item);
                          const files = item.custom?.files || [];
                          return (
                            <div key={item.key} className="p-3">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                                    {invoiceLineTypeLabel(item)}
                                  </div>
                                  {invoiceLineContext(item) && (
                                    <div className="mt-0.5 truncate text-xs text-ink-muted">
                                      {invoiceLineContext(item)}
                                    </div>
                                  )}
                                </div>
                                <div className="rounded-full bg-cream-dark px-3 py-1 text-sm font-semibold text-racing">
                                  {invoiceMoney(lineExVat(item))}
                                </div>
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[84px_minmax(0,1fr)_96px_140px]">
                                <div>
                                  <label className="label" htmlFor={`qty-${draft.id}-${index}`}>Qty</label>
                                  <input
                                    id={`qty-${draft.id}-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={item.qty}
                                    onChange={(e) => {
                                      const qty = Number(e.target.value.replace(/\D/g, "")) || 1;
                                      patchItem(index, { qty: Math.max(1, Math.min(999, qty)) });
                                    }}
                                    className="input text-center font-semibold text-racing"
                                  />
                                </div>

                                <div className="min-w-0">
                                  <label className="label" htmlFor={`description-${draft.id}-${index}`}>
                                    {item.catalogue === "custom" ? "Invoice wording" : "Item"}
                                  </label>
                                  <textarea
                                    id={`description-${draft.id}-${index}`}
                                    value={item.description}
                                    onChange={(e) => patchItem(index, { description: e.target.value })}
                                    rows={2}
                                    className="input min-h-[74px] resize-y text-sm leading-5"
                                  />
                                </div>

                                <div>
                                  <label className="label" htmlFor={`unit-${draft.id}-${index}`}>Unit</label>
                                  <input
                                    id={`unit-${draft.id}-${index}`}
                                    value={item.unit || ""}
                                    onChange={(e) => patchItem(index, { unit: e.target.value })}
                                    className="input"
                                  />
                                </div>

                                <div>
                                  <label className="label" htmlFor={`price-${draft.id}-${index}`}>Price ex VAT</label>
                                  <input
                                    id={`price-${draft.id}-${index}`}
                                    type="number"
                                    step="0.01"
                                    value={item.unitPriceExVat ?? ""}
                                    onChange={(e) =>
                                      patchItem(index, {
                                        unitPriceExVat: e.target.value === "" ? null : Number(e.target.value),
                                        unitPriceIncVat: e.target.value === "" ? null : Number(e.target.value) * 1.2,
                                      })
                                    }
                                    className="input text-right"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>

                              {referenceLabel && (
                                <div className="mt-3 max-w-sm">
                                  <label className="label" htmlFor={`code-${draft.id}-${index}`}>{referenceLabel}</label>
                                  <input
                                    id={`code-${draft.id}-${index}`}
                                    value={item.code || ""}
                                    onChange={(e) => patchItem(index, { code: e.target.value })}
                                    className="input font-mono text-sm"
                                    placeholder={invoiceReferencePlaceholder(item)}
                                  />
                                </div>
                              )}

                              {files.length > 0 && (
                                <div className="mt-3 rounded-md bg-cream-dark p-3 text-sm">
                                  <div className="label !mb-2">Uploaded design files</div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {files.map((file) => (
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
                            </div>
                          );
                        })}
                      </div>
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
                            {draft.invoiceSentAt ? formatDateTime(draft.invoiceSentAt) : "Not sent"}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>Payment</span>
                          <strong className="text-right text-racing">
                            {draft.paidAt ? formatDateTime(draft.paidAt) : "Awaiting"}
                          </strong>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-lg border border-racing/10 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="label" htmlFor="carriage">Carriage ex VAT</label>
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
                          <label className="label" htmlFor="extra-charges">Extra charges ex VAT</label>
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
                            Totals calculate after every invoice line has an ex VAT price.
                          </div>
                        )}
                        <div className="flex justify-between gap-3"><span>Goods ex VAT</span><strong>{totalsReadyText(draftTotals?.goods, hasDraftPoaItems)}</strong></div>
                        <div className="flex justify-between gap-3"><span>VAT</span><strong>{totalsReadyText(draftTotals?.vat, hasDraftPoaItems)}</strong></div>
                        <div className="flex justify-between gap-3"><span>Total ex VAT</span><strong>{totalsReadyText(draftTotals?.totalEx, hasDraftPoaItems)}</strong></div>
                        <div className="flex justify-between gap-3 text-racing"><span>Total inc VAT</span><strong>{totalsReadyText(draftTotals?.totalInc, hasDraftPoaItems)}</strong></div>
                      </div>
                    </section>

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
                        Add an ex VAT price to every invoice line before emailing it to the customer. VAT is added automatically.
                      </div>
                    )}
                  </aside>
                </div>
              </div>

              <div className="shrink-0 border-t border-racing/10 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {draft.status !== "paid" && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setPendingDelete(draft)}
                      className="mr-auto rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete job
                    </button>
                  )}
                  {draft.status !== "paid" && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => markPaid(draft)}
                      className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingAction === `${draft.id}:paid` ? "Saving..." : "Mark Paid"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => saveDraft(false)}
                    className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingAction === `${draft.id}:save` ? "Saving..." : "Save draft"}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving || !invoiceReady}
                    onClick={() => saveDraft(true)}
                    className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingAction === `${draft.id}:email`
                      ? "Sending..."
                      : draftInvoiceWasSent
                        ? "Send updated invoice"
                        : "Email invoice to buyer"}
                  </button>
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
                {pendingDelete.id} for {pendingDelete.customer.name} will be removed from the active dashboard and kept as closed in the order records.
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
      </div>
    </div>
  );
}
