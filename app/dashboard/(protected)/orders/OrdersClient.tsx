"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { QuoteItem, QuoteRequest, QuoteStatus } from "@/lib/quote-types";

const GBP = "\u00a3";
const PAGE_SIZE = 8;
const TZ = "Europe/London";

type StatusFilter = "all" | QuoteStatus;
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

const lineExVat = (item: QuoteItem) =>
  typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : null;

const totals = (quote: QuoteRequest) => {
  const goods = quote.items.reduce((sum, item) => sum + (lineExVat(item) ?? 0), 0);
  const carriage = quote.carriageExVat ?? 0;
  const extra = quote.extraChargesExVat ?? 0;
  const totalEx = goods + carriage + extra;
  const vat = totalEx * 0.2;
  return { goods, carriage, extra, totalEx, vat, totalInc: totalEx + vat };
};

const itemName = (item: QuoteItem) =>
  item.catalogue === "metals"
    ? [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ")
    : item.description;

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
  return quote.status === "paid" ? quote.paidAt || quote.updatedAt : quote.submittedAt;
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

function isInTimeFilter(quote: QuoteRequest, filter: TimeFilter) {
  if (filter === "all") return true;

  const relevantDate = new Date(historyDate(quote));
  const todayKey = ukDateKey(new Date());
  const quoteKey = ukDateKey(relevantDate);

  if (filter === "today") return quoteKey === todayKey;
  if (filter === "month") return quoteKey.slice(0, 7) === todayKey.slice(0, 7);
  if (filter === "year") return quoteKey.slice(0, 4) === todayKey.slice(0, 4);

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - relevantDate.getTime() <= sevenDays;
}

function quoteSearchText(quote: QuoteRequest) {
  return [
    quote.id,
    statusLabel(quote.status),
    quote.customer.name,
    quote.customer.email,
    quote.customer.phone,
    quote.customer.company,
    quote.customer.message,
    quote.customerMessage,
    quote.ownerNotes,
    ...quote.items.flatMap((item) => [
      item.code,
      item.description,
      item.shape,
      item.metal,
      item.spec,
      item.size,
      item.unit,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function StatusPill({ status }: { status: QuoteStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${STATUS_STYLES[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

export default function OrdersClient({
  initialQuotes,
  initialError,
  initialMonth = "",
}: {
  initialQuotes: QuoteRequest[];
  initialError: string;
  initialMonth?: string;
}) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<QuoteRequest | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [monthFilter, setMonthFilter] = useState(initialMonth);
  const [page, setPage] = useState(1);
  const [savingAction, setSavingAction] = useState("");
  const [message, setMessage] = useState(initialError);
  const invoiceRef = useRef<HTMLDivElement | null>(null);

  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => Date.parse(historyDate(b)) - Date.parse(historyDate(a))),
    [quotes]
  );

  const filteredQuotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortedQuotes.filter((quote) => {
      if (statusFilter !== "all" && quote.status !== statusFilter) return false;
      if (monthFilter) {
        if (historyMonthKey(quote) !== monthFilter) return false;
      } else if (!isInTimeFilter(quote, timeFilter)) {
        return false;
      }
      if (needle && !quoteSearchText(quote).includes(needle)) return false;
      return true;
    });
  }, [monthFilter, query, sortedQuotes, statusFilter, timeFilter]);

  const selected = useMemo(
    () => quotes.find((quote) => quote.id === selectedId) ?? null,
    [quotes, selectedId]
  );

  const statusCounts = useMemo(() => {
    const counts = new Map<StatusFilter, number>([["all", quotes.length]]);
    for (const option of STATUS_OPTIONS) counts.set(option.value, 0);
    for (const quote of quotes) counts.set(quote.status, (counts.get(quote.status) || 0) + 1);
    return counts;
  }, [quotes]);

  const pageCount = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageQuotes = filteredQuotes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const monthStats = useMemo(() => {
    const stats = new Map<string, { salesValue: number; salesCount: number }>();

    for (const quote of filteredQuotes) {
      if (quote.status !== "paid") continue;
      const key = historyMonthKey(quote);
      const current = stats.get(key) || { salesValue: 0, salesCount: 0 };
      current.salesCount += 1;
      current.salesValue += totals(quote).totalEx;
      stats.set(key, current);
    }

    return stats;
  }, [filteredQuotes]);

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

  useEffect(() => {
    setPage(1);
  }, [monthFilter, query, statusFilter, timeFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    const quote = quotes.find((q) => q.id === selectedId);
    if (quote?.status === "new") {
      void markViewed(quote);
    }
  }, [quotes, selectedId]);

  useEffect(() => {
    if (draft) invoiceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [draft?.id]);

  function selectQuote(id: string) {
    const quote = quotes.find((q) => q.id === id);
    setSelectedId(id);
    setDraft(quote ? cloneQuote(quote) : null);
    setMessage("");
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

  function updateQuote(updated: QuoteRequest) {
    setQuotes((current) => current.map((quote) => (quote.id === updated.id ? updated : quote)));
    setDraft((current) => (current?.id === updated.id ? cloneQuote(updated) : current));
  }

  async function markViewed(quote: QuoteRequest) {
    try {
      const res = await fetch("/api/quote-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quote, status: "reviewing" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mark viewed");

      updateQuote(data.quote as QuoteRequest);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const updated = data.quote as QuoteRequest;
      updateQuote(updated);
      setMessage(
        options.markPaid
          ? "Order marked as paid."
          : options.emailCustomer
            ? "Invoice emailed to customer and marked as invoice sent."
            : "Order saved."
      );
    } catch (err) {
      setMessage((err as Error).message || "Save failed");
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

  const draftTotals = draft ? totals(draft) : null;
  const isSaving = Boolean(savingAction);
  const showingFrom = filteredQuotes.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, filteredQuotes.length);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-racing mb-1">Order history</h1>
        <p className="text-ink-muted text-sm">
          Search every website order, review the invoice, email it to the buyer, then manually mark it paid when money arrives.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-lg bg-cream-dark border border-racing/10 p-3 text-sm text-racing">
          {message}
        </div>
      )}

      <div className="space-y-5">
        <div className="min-w-0 bg-white rounded-xl border border-racing/10 overflow-hidden">
          <div className="border-b border-racing/10 p-4">
            <label className="label" htmlFor="order-search">Search order history</label>
            <input
              id="order-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input"
              placeholder="Name, email, order ref, item, part code..."
            />

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter by order status">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === "all" ? "bg-racing text-cream" : "bg-cream-dark text-racing"}`}
              >
                All ({statusCounts.get("all") || 0})
              </button>
              {STATUS_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === option.value ? "bg-racing text-cream" : "bg-cream-dark text-racing"}`}
                >
                  {option.label} ({statusCounts.get(option.value) || 0})
                </button>
              ))}
            </div>

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
                {showingFrom}-{showingTo} of {filteredQuotes.length}
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

          <div className="space-y-5 p-4">
            {pageQuotes.length === 0 && (
              <div className="rounded-lg bg-cream-dark p-5 text-sm text-ink-muted">
                No orders match that search.
              </div>
            )}
            {pageGroups.map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-racing/10 pb-2">
                  <h2 className="font-display text-xl text-racing">{group.label}</h2>
                  <div className="text-xs font-semibold text-ink-muted">
                    Sales {money(group.salesValue)} / {group.salesCount} {group.salesCount === 1 ? "sale" : "sales"}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {group.quotes.map((quote) => {
                    const quoteTotals = totals(quote);
                    const paid = quote.status === "paid";
                    const cardSaving = savingAction.startsWith(`${quote.id}:`);
                    return (
                      <article
                        key={quote.id}
                        className={`rounded-lg border p-4 transition ${
                          selectedId === quote.id
                            ? "border-gold bg-cream-dark shadow-sm"
                            : "border-racing/10 bg-white hover:border-gold/60"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectQuote(quote.id)}
                          className="block w-full text-left"
                          aria-current={selectedId === quote.id ? "true" : undefined}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-racing">{quote.id}</div>
                              <div className="mt-1 truncate text-sm font-medium text-ink">{quote.customer.name}</div>
                            </div>
                            <StatusPill status={quote.status} />
                          </div>
                          <div className="mt-3 text-xs text-ink-muted">
                            {formatDateTime(historyDate(quote))}
                          </div>
                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div className="text-xs text-ink-muted">
                              {quote.items.length} {quote.items.length === 1 ? "item" : "items"}
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-racing">{money(quoteTotals.totalEx)}</div>
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
                          {!paid && (
                            <button
                              type="button"
                              onClick={() => markPaid(quote)}
                              disabled={isSaving}
                              aria-label={`Mark order ${quote.id} as paid`}
                              className="shrink-0 rounded-lg border border-racing px-3 py-2 text-xs font-semibold text-racing hover:bg-racing hover:text-cream disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {cardSaving && savingAction.endsWith(":paid") ? "Saving..." : "Mark Paid"}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
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
          <div ref={invoiceRef} className="min-w-0 scroll-mt-6 bg-white rounded-xl border border-racing/10 p-5">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-muted">Invoice editor</div>
                <h2 className="font-display text-2xl text-racing">{draft.customer.name}</h2>
                <div className="text-sm text-ink-muted">
                  {draft.id} / submitted {formatDateTime(draft.submittedAt)}
                </div>
                <div className="text-sm text-ink-muted">
                  {draft.customer.email} / {draft.customer.phone}
                </div>
                {draft.customer.company && (
                  <div className="text-sm text-ink-muted">{draft.customer.company}</div>
                )}
              </div>
              <div className="flex min-w-[180px] flex-col gap-3">
                <div>
                  <label className="label" htmlFor="status">Status</label>
                  <select
                    id="status"
                    value={draft.status}
                    onChange={(e) => patchDraft({ status: e.target.value as QuoteStatus })}
                    className="input"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId("");
                    setDraft(null);
                  }}
                  className="btn-secondary justify-center py-2"
                >
                  Close invoice
                </button>
              </div>
            </div>

            <div className="mb-5 grid sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-cream-dark p-3">
                <div className="text-xs uppercase tracking-wider text-ink-muted">Current status</div>
                <div className="mt-2"><StatusPill status={draft.status} /></div>
              </div>
              <div className="rounded-lg bg-cream-dark p-3">
                <div className="text-xs uppercase tracking-wider text-ink-muted">Invoice sent</div>
                <div className="mt-1 text-sm font-semibold text-racing">
                  {draft.invoiceSentAt ? formatDateTime(draft.invoiceSentAt) : "Not sent yet"}
                </div>
              </div>
              <div className="rounded-lg bg-cream-dark p-3">
                <div className="text-xs uppercase tracking-wider text-ink-muted">Payment</div>
                <div className="mt-1 text-sm font-semibold text-racing">
                  {draft.paidAt ? `Paid ${formatDateTime(draft.paidAt)}` : "Awaiting payment"}
                </div>
              </div>
            </div>

            {draft.customer.message && (
              <div className="mb-5 rounded-lg bg-cream-dark p-4 text-sm">
                <div className="label mb-1">Customer note</div>
                <p className="whitespace-pre-wrap">{draft.customer.message}</p>
              </div>
            )}

            <div className="overflow-x-auto border border-racing/10 rounded-lg">
              <table className="w-full min-w-[930px] table-fixed">
                <colgroup>
                  <col className="w-[90px]" />
                  <col className="w-[150px]" />
                  <col />
                  <col className="w-[120px]" />
                  <col className="w-[130px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Qty</th>
                    <th className="text-left px-3 py-2">Part no.</th>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-left px-3 py-2">Unit</th>
                    <th className="text-right px-3 py-2">Each ex VAT</th>
                    <th className="text-right px-3 py-2">Line ex VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((item, index) => (
                    <tr key={item.key} className="border-t border-racing/5">
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.qty}
                          onChange={(e) => {
                            const qty = Number(e.target.value.replace(/\D/g, "")) || 1;
                            patchItem(index, { qty: Math.max(1, Math.min(999, qty)) });
                          }}
                          className="h-9 w-full rounded-md border border-racing/20 bg-white px-2 text-center font-semibold text-racing"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={item.code || ""}
                          onChange={(e) => patchItem(index, { code: e.target.value })}
                          className="input h-9 font-mono text-xs"
                          placeholder={item.catalogue === "mini" ? "Mini part no." : "Metal code"}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={item.description}
                          onChange={(e) => patchItem(index, { description: e.target.value })}
                          className="input"
                        />
                        <div className="mt-1 text-xs text-ink-muted">{itemName(item)}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={item.unit || ""}
                          onChange={(e) => patchItem(index, { unit: e.target.value })}
                          className="input h-9"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPriceExVat ?? ""}
                          onChange={(e) =>
                            patchItem(index, {
                              unitPriceExVat: e.target.value === "" ? null : Number(e.target.value),
                              unitPriceIncVat: e.target.value === "" ? null : Number(e.target.value) * 1.2,
                            })
                          }
                          className="input h-9 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-racing align-top">
                        {money(lineExVat(item))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="label" htmlFor="customer-message">Message to customer</label>
                <textarea
                  id="customer-message"
                  value={draft.customerMessage || ""}
                  onChange={(e) => patchDraft({ customerMessage: e.target.value })}
                  rows={5}
                  className="input resize-none"
                  placeholder="Delivery timing, collection notes, payment instructions, etc."
                />
              </div>
              <div>
                <label className="label" htmlFor="owner-notes">Owner notes</label>
                <textarea
                  id="owner-notes"
                  value={draft.ownerNotes || ""}
                  onChange={(e) => patchDraft({ ownerNotes: e.target.value })}
                  rows={5}
                  className="input resize-none"
                  placeholder="Private notes for the owner dashboard"
                />
              </div>
            </div>

            <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
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
              <div className="lg:col-span-3 bg-cream-dark rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span>Goods ex VAT</span><strong>{money(draftTotals?.goods)}</strong></div>
                <div className="flex justify-between"><span>VAT</span><strong>{money(draftTotals?.vat)}</strong></div>
                <div className="flex justify-between"><span>Total ex VAT</span><strong>{money(draftTotals?.totalEx)}</strong></div>
                <div className="flex justify-between text-racing"><span>Total inc VAT</span><strong>{money(draftTotals?.totalInc)}</strong></div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-racing/10 pt-5">
              {draft.status !== "paid" && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => markPaid(draft)}
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAction === `${draft.id}:paid` ? "Saving..." : "Mark Paid"}
                </button>
              )}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveDraft(false)}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAction === `${draft.id}:save` ? "Saving..." : "Save draft"}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveDraft(true)}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAction === `${draft.id}:email` ? "Sending..." : "Email invoice to buyer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
