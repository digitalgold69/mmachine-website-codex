import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { listQuoteRequests } from "@/lib/quotes";
import type { QuoteRequest } from "@/lib/quote-types";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams?: Promise<{ month?: string | string[] }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

  let quotes: QuoteRequest[] = [];
  let error = "";
  const params = searchParams ? await searchParams : {};
  const monthParam = Array.isArray(params.month) ? params.month[0] : params.month;
  const initialMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : "";

  try {
    quotes = await listQuoteRequests();
  } catch (err) {
    error = (err as Error).message;
  }

  return <OrdersClient initialQuotes={quotes} initialError={error} initialMonth={initialMonth} />;
}
