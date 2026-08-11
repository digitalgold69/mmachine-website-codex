import Link from "next/link";
import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { products } from "@/lib/mini-data";
import { metals } from "@/lib/metals-data";
import { listFeaturedWork } from "@/lib/featured";
import {
  accountingBucketForCatalogue,
  emptyAccountingTotals,
  quoteRefunds,
  roundAccounting,
  websiteInvoiceDisplay,
} from "@/lib/order-accounting";
import { getBestPaidMonth, listDashboardQuoteRequests, type BestPaidMonth } from "@/lib/quotes";
import { quoteTotals } from "@/lib/quote-email";
import type { QuoteItem, QuoteRequest } from "@/lib/quote-types";
import { shiftUkDateKey, ukDateKey, ukMidnightUtc } from "@/lib/uk-time";

export const dynamic = "force-dynamic";

const GBP = "\u00a3";
const TZ = "Europe/London";

type Metric = {
  label: string;
  value: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
};

type RankedItem = {
  label: string;
  detail: string;
  qty: number;
  value: number;
};

type RankedCustomer = {
  name: string;
  detail: string;
  orders: number;
  value: number;
};

type DayPoint = {
  key: string;
  label: string;
  count: number;
  value: number;
};

export default async function DashboardHomePage() {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

  let quotes: QuoteRequest[] = [];
  let bestPaidMonth: BestPaidMonth | null = null;
  let featuredCount = 0;
  let dataError = "";

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    [quotes, bestPaidMonth] = await Promise.all([
      listDashboardQuoteRequests(ninetyDaysAgo.toISOString()),
      getBestPaidMonth(),
    ]);
  } catch (err) {
    console.error("dashboard_analytics_load_failed", {
      error: err instanceof Error ? err.message : "unknown error",
    });
    dataError = "Business figures could not be loaded. Refresh the page to try again.";
  }

  try {
    featuredCount = (await listFeaturedWork()).length;
  } catch {
    featuredCount = 0;
  }

  const analytics = buildAnalytics(quotes, bestPaidMonth);
  const catalogueCount = products.length + metals.length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-racing mb-1">Business dashboard</h1>
        </div>
        <Link href="/dashboard/orders" className="btn-primary">
          View all order history
        </Link>
      </div>

      {dataError && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {dataError}
        </div>
      )}

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {analytics.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid xl:grid-cols-[1.1fr_0.9fr] gap-5 mb-6">
        <Panel
          title="New order requests"
          action={<Link href="/dashboard/orders" className="text-sm font-medium text-racing hover:text-gold">View all</Link>}
        >
          {analytics.newRequests.length === 0 ? (
            <EmptyState>No new order requests waiting.</EmptyState>
          ) : (
            <div className="divide-y divide-racing/5">
              {analytics.newRequests.map((quote) => (
                <Link
                  key={quote.id}
                  href="/dashboard/orders"
                  className="block py-3 hover:bg-cream-dark/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-racing">{quote.customer.name}</div>
                      <div className="text-xs text-ink-muted">
                        {websiteInvoiceDisplay(quote)} / {formatDateTime(quote.submittedAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-racing">
                        {money(quoteTotals(quote).totalExVat)}
                      </div>
                      <div className="text-xs text-ink-muted">ex VAT</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Daily sales">
          <div className="space-y-3">
            {analytics.dailyTrend.map((day) => (
              <div key={day.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-muted">{day.label}</span>
                  <span className="font-semibold text-racing">
                    {money(day.value)} / {day.count} {day.count === 1 ? "request" : "requests"}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-cream-dark">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${analytics.maxDailyValue > 0 ? Math.max(4, (day.value / analytics.maxDailyValue) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid xl:grid-cols-2 gap-5 mb-6">
        <Panel
          title={
            <>
              Top sellers, past 90 days <span className="font-sans text-sm font-semibold text-ink-muted">(Excl Custom Work)</span>
            </>
          }
        >
          {analytics.topItems.length === 0 ? (
            <EmptyState>No item history yet.</EmptyState>
          ) : (
            <RankedList
              rows={analytics.topItems.map((item) => ({
                key: item.label,
                left: item.label,
                sub: item.detail,
                right: `${item.qty} sold`,
                value: money(item.value),
              }))}
            />
          )}
        </Panel>

        <Panel title="Top customers, past 90 days">
          {analytics.topCustomers.length === 0 ? (
            <EmptyState>No customer history yet.</EmptyState>
          ) : (
            <RankedList
              rows={analytics.topCustomers.map((customer) => ({
                key: customer.detail,
                left: customer.name,
                sub: customer.detail,
                right: `${customer.orders} ${customer.orders === 1 ? "sale" : "sales"}`,
                value: money(customer.value),
              }))}
            />
          )}
        </Panel>
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <Link href="/dashboard/products" className="card bg-white group block">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-racing">Catalogue</h2>
            <span className="text-xs font-mono text-gold">{catalogueCount.toLocaleString()} ITEMS</span>
          </div>
          <p className="text-sm text-ink-muted mb-3">
            {products.length.toLocaleString()} Mini panel lines and {metals.length.toLocaleString()} metal lines.
          </p>
          <span className="text-sm font-medium text-racing group-hover:text-gold">Open products</span>
        </Link>

        <Link href="/dashboard/featured" className="card bg-white group block">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl text-racing">Featured Work</h2>
            <span className="text-xs font-mono text-gold">{featuredCount} JOBS</span>
          </div>
          <p className="text-sm text-ink-muted mb-3">
            Manage workshop case studies and images from Cloudflare.
          </p>
          <span className="text-sm font-medium text-racing group-hover:text-gold">Open Featured Work</span>
        </Link>

        <div className="card bg-cream-dark">
          <h2 className="font-display text-xl text-racing mb-2">Data note</h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Sales figures are based on orders marked paid in the owner dashboard. New requests and unpaid invoices are shown separately.
          </p>
        </div>
      </section>
    </div>
  );
}

function buildAnalytics(
  quotes: QuoteRequest[],
  bestPaidMonth: BestPaidMonth | null
) {
  const now = new Date();
  const todayKey = ukDateKey(now);
  const monthKey = todayKey.slice(0, 7);
  const sevenDaysAgo = ukMidnightUtc(shiftUkDateKey(todayKey, -6));
  const ninetyDaysAgo = daysAgo(now, 90);

  const todayRequests = quotes.filter((quote) => ukDateKey(quote.submittedAt) === todayKey);
  const newRequestQuotes = quotes.filter((quote) => quote.status === "new");
  const newRequests = newRequestQuotes.slice(0, 6);
  const invoiceSentQuotes = quotes.filter((quote) => quote.invoiceSentAt || quote.customerEmailSentAt || quote.status === "invoice_sent");
  const invoiceSentMonthQuotes = invoiceSentQuotes.filter((quote) =>
    ukDateKey(invoiceDate(quote)).startsWith(monthKey)
  );
  const invoiceSent7DayQuotes = invoiceSentQuotes.filter((quote) => isOnOrAfter(invoiceDate(quote), sevenDaysAgo));
  const paidQuotes = quotes.filter((quote) => quote.status === "paid");
  const paidTodayQuotes = paidQuotes.filter((quote) => ukDateKey(quote.paidAt || quote.updatedAt) === todayKey);
  const paidMonthQuotes = paidQuotes.filter((quote) =>
    ukDateKey(quote.paidAt || quote.updatedAt).startsWith(monthKey)
  );
  const paid7DayQuotes = paidQuotes.filter((quote) => isOnOrAfter(quote.paidAt || quote.updatedAt, sevenDaysAgo));
  const paid90DayQuotes = paidQuotes.filter((quote) => isOnOrAfter(quote.paidAt || quote.updatedAt, ninetyDaysAgo));
  const unpaidInvoiceQuotes = invoiceSentQuotes.filter((quote) => !quote.paidAt);
  const unpaidInvoiceValue = unpaidInvoiceQuotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0);
  const paidMonthValue = paidMonthQuotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0);
  const paidTodayValue = paidTodayQuotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0);
  const paid90DayValue = paid90DayQuotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0);

  const bestMonth = bestPaidMonth;
  const topItems = topItemsFrom(paidQuotes);
  const topCustomers = topCustomersFrom(paidQuotes);
  const dailyTrend = lastDays(7).map((day) => {
    const dayQuotes = paidQuotes.filter((quote) => ukDateKey(quote.paidAt || quote.updatedAt) === day.key);
    return {
      ...day,
      count: dayQuotes.length,
      value: dayQuotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0),
    };
  });

  const metrics: Metric[] = [
    {
      label: "Requests today",
      value: String(todayRequests.length),
      detail: `${newRequestQuotes.length} still awaiting review`,
    },
    {
      label: "Sales today",
      value: money(paidTodayValue),
      detail: `${paidTodayQuotes.length} paid today, ex VAT`,
    },
    {
      label: "Sales this month",
      value: money(paidMonthValue),
      detail: `${paidMonthQuotes.length} paid in ${formatMonth(monthKey)}, ex VAT`,
    },
    {
      label: "Best paid month",
      value: bestMonth ? money(bestMonth.value) : `${GBP}0.00`,
      detail: bestMonth ? `${formatMonth(bestMonth.key)} paid sales, ex VAT` : "No paid orders yet",
      actionHref: bestMonth ? `/dashboard/orders?month=${bestMonth.key}#order-month-${bestMonth.key}` : undefined,
      actionLabel: bestMonth ? "View month" : undefined,
    },
    {
      label: "Awaiting payment",
      value: money(unpaidInvoiceValue),
      detail: `${unpaidInvoiceQuotes.length} invoices sent but not paid`,
    },
    {
      label: "Average paid order",
      value: money(paid90DayQuotes.length ? paid90DayValue / paid90DayQuotes.length : 0),
      detail: `${paid90DayQuotes.length} paid ${paid90DayQuotes.length === 1 ? "order" : "orders"} in the past 90 days`,
    },
    {
      label: "Invoices sent",
      value: String(invoiceSent7DayQuotes.length),
      detail: `Past 7 days; ${invoiceSentMonthQuotes.length} sent in ${formatMonth(monthKey)}`,
    },
    {
      label: "Paid orders",
      value: String(paid7DayQuotes.length),
      detail: `Past 7 days; ${paidMonthQuotes.length} paid in ${formatMonth(monthKey)}`,
    },
  ];

  return {
    metrics,
    newRequests,
    topItems,
    topCustomers,
    dailyTrend,
    maxDailyValue: Math.max(...dailyTrend.map((day) => day.value), 0),
  };
}

function topItemsFrom(quotes: QuoteRequest[]): RankedItem[] {
  const map = new Map<string, RankedItem>();
  for (const quote of quotes) {
    const refundByBucket = refundTotalsByBucket(quote);
    const goodsByBucket = goodsTotalsByBucket(quote);
    for (const item of quote.items) {
      if (item.catalogue === "custom") continue;

      const bucket = accountingBucketForCatalogue(item.catalogue);
      const itemValue = lineExVat(item);
      const refundShare = goodsByBucket[bucket] > 0
        ? refundByBucket[bucket] * (itemValue / goodsByBucket[bucket])
        : 0;
      const label = itemLabel(item);
      const current = map.get(label) || {
        label,
        detail:
          item.catalogue === "featured"
            ? "Featured Work"
            : item.catalogue === "metals"
              ? "Metals"
              : item.code || "Mini panels",
        qty: 0,
        value: 0,
      };
      current.qty += item.qty;
      current.value += Math.max(0, roundAccounting(itemValue - refundShare));
      map.set(label, current);
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty || b.value - a.value).slice(0, 8);
}

function topCustomersFrom(quotes: QuoteRequest[]): RankedCustomer[] {
  const map = new Map<string, RankedCustomer>();
  for (const quote of quotes) {
    const key = (quote.customer.email || quote.customer.name).toLowerCase();
    const current = map.get(key) || {
      name: quote.customer.name || "Unknown customer",
      detail: quote.customer.email || quote.customer.phone || "No contact detail",
      orders: 0,
      value: 0,
    };
    current.orders += 1;
    current.value += quoteTotals(quote).totalExVat;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.value - a.value || b.orders - a.orders).slice(0, 8);
}

function daysAgo(from: Date, count: number) {
  const date = new Date(from);
  date.setDate(date.getDate() - count);
  return date;
}

function isOnOrAfter(value: string | Date, date: Date) {
  return new Date(value).getTime() >= date.getTime();
}

function invoiceDate(quote: QuoteRequest) {
  return quote.invoiceSentAt || quote.customerEmailSentAt || quote.updatedAt;
}

function lastDays(count: number): Omit<DayPoint, "count" | "value">[] {
  const todayKey = ukDateKey();
  return Array.from({ length: count }, (_, index) => {
    const key = shiftUkDateKey(todayKey, -(count - index - 1));
    const d = new Date(`${key}T12:00:00.000Z`);
    return {
      key,
      label: index === count - 1 ? "Today" : formatShortDate(d),
    };
  });
}

function lineExVat(item: QuoteItem) {
  return typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : 0;
}

function itemLabel(item: QuoteItem) {
  return item.catalogue === "custom"
    ? item.custom?.projectName || item.description || "Custom fabrication request"
    : item.catalogue === "metals"
    ? [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ")
    : item.description;
}

function emptyAccountingBuckets() {
  return emptyAccountingTotals();
}

function refundTotalsByBucket(quote: QuoteRequest) {
  const totals = emptyAccountingBuckets();
  for (const refund of quoteRefunds(quote)) {
    for (const line of refund.lines) totals[line.bucket] += line.amountExVat;
  }
  return totals;
}

function goodsTotalsByBucket(quote: QuoteRequest) {
  const totals = emptyAccountingBuckets();
  for (const item of quote.items) totals[accountingBucketForCatalogue(item.catalogue)] += lineExVat(item);
  return totals;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function money(value: number) {
  return `${GBP}${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-racing/10">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="text-xs text-ink-muted uppercase tracking-wider">{metric.label}</div>
        {metric.actionHref && metric.actionLabel && (
          <Link href={metric.actionHref} className="shrink-0 text-xs font-semibold text-racing hover:text-gold">
            {metric.actionLabel}
          </Link>
        )}
      </div>
      <div className="font-sans text-3xl font-semibold tracking-normal text-racing tabular-nums">{metric.value}</div>
      <div className="text-xs text-ink-muted mt-2">{metric.detail}</div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-racing/10 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex flex-wrap items-baseline gap-2 font-display text-xl text-racing">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-cream-dark p-4 text-sm text-ink-muted">{children}</div>;
}

function RankedList({
  rows,
}: {
  rows: { key: string; left: string; sub: string; right: string; value: string }[];
}) {
  return (
    <div className="divide-y divide-racing/5">
      {rows.map((row) => (
        <div key={row.key} className="py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate font-semibold text-racing">{row.left}</div>
              <div className="truncate text-xs text-ink-muted">{row.sub}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold text-racing">{row.value}</div>
              <div className="text-xs text-ink-muted">{row.right}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
