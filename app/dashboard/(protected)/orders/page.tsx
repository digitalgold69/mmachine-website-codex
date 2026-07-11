import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { listActiveQuoteRequests, listPaidQuoteHistory } from "@/lib/quotes";
import { ukMonthBounds } from "@/lib/uk-time";
import type { QuoteRequest } from "@/lib/quote-types";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams?: Promise<{ month?: string | string[] }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

  let quotes: QuoteRequest[] = [];
  let historyCount = 0;
  let monthStats: Record<string, { salesValue: number; salesCount: number }> = {};
  let error = "";
  const params = searchParams ? await searchParams : {};
  const monthParam = Array.isArray(params.month) ? params.month[0] : params.month;
  const initialMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : "";

  try {
    const bounds = initialMonth ? ukMonthBounds(initialMonth) : null;
    const [active, history] = await Promise.all([
      listActiveQuoteRequests(),
      listPaidQuoteHistory({
        limit: 8,
        offset: 0,
        start: bounds?.start.toISOString(),
        end: bounds?.end.toISOString(),
      }),
    ]);
    quotes = [...active, ...history.quotes];
    historyCount = history.count;
    monthStats = history.monthStats;
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <OrdersClient
      initialQuotes={quotes}
      initialError={error}
      initialMonth={initialMonth}
      initialHistoryCount={historyCount}
      initialMonthStats={monthStats}
    />
  );
}
