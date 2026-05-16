import Link from "next/link";
import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { products } from "@/lib/mini-data";
import { metals } from "@/lib/metals-data";
import { listFeaturedWork } from "@/lib/featured";
import { listQuoteRequests } from "@/lib/quotes";
import { quoteTotals } from "@/lib/quote-email";
import type { QuoteItem, QuoteRequest } from "@/lib/quote-types";

export const dynamic = "force-dynamic";

const GBP = "\u00a3";
const TZ = "Europe/London";

type Metric = {
  label: string;
  value: string;
  detail: string;
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
  let featuredCount = 0;
  let dataError = "";

  try {
    quotes = await listQuoteRequests();
  } catch (err) {
    dataError = (err as Error).message;
  }

  try {
    featuredCount = (await listFeaturedWork()).length;
  } catch {
    featuredCount = 0;
  }

  const analytics = buildAnalytics(quotes);
  const catalogueCount = products.length + metals.length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-racing mb-1">Business dashboard</h1>
          <p className="text-ink-muted">
            Live order-request analytics using UK dates. A new day starts at midnight in London.
          </p>
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
                        {quote.id} / {formatDateTime(quote.submittedAt)}
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

        <Panel title="Daily order value">
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
        <Panel title="Top sellers">
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

        <Panel title="Top customers">
          {analytics.topCustomers.length === 0 ? (
            <EmptyState>No customer history yet.</EmptyState>
          ) : (
            <RankedList
              rows={analytics.topCustomers.map((customer) => ({
                key: customer.detail,
                left: customer.name,
                sub: customer.detail,
                right: `${customer.orders} ${customer.orders === 1 ? "request" : "requests"}`,
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
            <h2 className="font-display text-xl text-racing">Featured work</h2>
            <span className="text-xs font-mono text-gold">{featuredCount} JOBS</span>
          </div>
          <p className="text-sm text-ink-muted mb-3">
            Manage workshop case studies and images from Supabase.
          </p>
          <span className="text-sm font-medium text-racing group-hover:text-gold">Open featured work</span>
        </Link>

        <div className="card bg-cream-dark">
          <h2 className="font-display text-xl text-racing mb-2">Data note</h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            These figures track submitted website orders, invoice-sent value, and manually marked payments. It is a live sales dashboard rather than audited accounts.
          </p>
        </div>
      </section>
    </div>
  );
}

function buildAnalytics(quotes: QuoteRequest[]) {
  const now = new Date();
  const todayKey = ukDateKey(now);
  const monthKey = todayKey.slice(0, 7);

  const totalValue = quotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0);
  const todayQuotes = quotes.filter((quote) => ukDateKey(quote.submittedAt) === todayKey);
  const monthQuotes = quotes.filter((quote) => ukDateKey(quote.submittedAt).startsWith(monthKey));
  const newRequests = quotes.filter((quote) => quote.status === "new").slice(0, 6);

  const bestMonth = bestMonthFrom(quotes);
  const topItems = topItemsFrom(quotes);
  const topCustomers = topCustomersFrom(quotes);
  const dailyTrend = lastDays(7).map((day) => {
    const dayQuotes = quotes.filter((quote) => ukDateKey(quote.submittedAt) === day.key);
    return {
      ...day,
      count: dayQuotes.length,
      value: dayQuotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0),
    };
  });

  const metrics: Metric[] = [
    {
      label: "New requests",
      value: String(quotes.filter((quote) => quote.status === "new").length),
      detail: `${todayQuotes.length} submitted today`,
    },
    {
      label: "Today",
      value: money(todayQuotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0)),
      detail: "order-request value ex VAT",
    },
    {
      label: "This month",
      value: money(monthQuotes.reduce((sum, quote) => sum + quoteTotals(quote).totalExVat, 0)),
      detail: `${monthQuotes.length} requests in ${formatMonth(monthKey)}`,
    },
    {
      label: "Best month",
      value: bestMonth ? money(bestMonth.value) : `${GBP}0.00`,
      detail: bestMonth ? formatMonth(bestMonth.key) : "No history yet",
    },
    {
      label: "All-time pipeline",
      value: money(totalValue),
      detail: `${quotes.length} total requests`,
    },
    {
      label: "Average request",
      value: money(quotes.length ? totalValue / quotes.length : 0),
      detail: "mean order-request value",
    },
    {
      label: "Invoice sent",
      value: String(quotes.filter((quote) => quote.status === "invoice_sent").length),
      detail: "completed invoices emailed",
    },
    {
      label: "Paid",
      value: String(quotes.filter((quote) => quote.status === "paid").length),
      detail: "manually confirmed payments",
    },
    {
      label: "Closed",
      value: String(quotes.filter((quote) => quote.status === "closed").length),
      detail: "finished or archived",
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
    for (const item of quote.items) {
      const label = itemLabel(item);
      const current = map.get(label) || {
        label,
        detail: item.catalogue === "metals" ? "Metals" : item.code || "Mini panels",
        qty: 0,
        value: 0,
      };
      current.qty += item.qty;
      current.value += lineExVat(item);
      map.set(label, current);
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value || b.qty - a.qty).slice(0, 8);
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

function bestMonthFrom(quotes: QuoteRequest[]) {
  const months = new Map<string, number>();
  for (const quote of quotes) {
    const key = ukDateKey(quote.submittedAt).slice(0, 7);
    months.set(key, (months.get(key) || 0) + quoteTotals(quote).totalExVat);
  }
  return [...months.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)[0];
}

function lastDays(count: number): Omit<DayPoint, "count" | "value">[] {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - (count - index - 1));
    return {
      key: ukDateKey(d),
      label: index === count - 1 ? "Today" : formatShortDate(d),
    };
  });
}

function lineExVat(item: QuoteItem) {
  return typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : 0;
}

function itemLabel(item: QuoteItem) {
  return item.catalogue === "metals"
    ? [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ")
    : item.description;
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
      <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">{metric.label}</div>
      <div className="font-display text-3xl text-racing">{metric.value}</div>
      <div className="text-xs text-ink-muted mt-2">{metric.detail}</div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-racing/10 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-racing">{title}</h2>
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
