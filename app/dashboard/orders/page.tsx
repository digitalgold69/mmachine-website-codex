import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { readJsonFile } from "@/lib/github";
import type { QuoteRequest } from "@/lib/quote-types";
import OrdersClient from "./OrdersClient";

const QUOTES_PATH = "data-source/quote-requests.json";

export default async function OrdersPage() {
  if (!(await isLoggedIn())) redirect("/dashboard/login");

  let quotes: QuoteRequest[] = [];
  let error = "";

  try {
    const data = await readJsonFile<QuoteRequest[]>(QUOTES_PATH);
    quotes = Array.isArray(data) ? data : [];
  } catch (err) {
    error = (err as Error).message;
  }

  return <OrdersClient initialQuotes={quotes} initialError={error} />;
}
