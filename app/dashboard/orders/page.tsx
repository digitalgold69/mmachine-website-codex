import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { listQuoteRequests } from "@/lib/quotes";
import type { QuoteRequest } from "@/lib/quote-types";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

  let quotes: QuoteRequest[] = [];
  let error = "";

  try {
    quotes = await listQuoteRequests();
  } catch (err) {
    error = (err as Error).message;
  }

  return <OrdersClient initialQuotes={quotes} initialError={error} />;
}
