import { getSupabaseAdmin } from "@/lib/supabase";
import type { QuoteItem, QuoteRequest, QuoteStatus } from "@/lib/quote-types";

type QuoteRow = {
  id: string;
  submitted_at: string;
  updated_at: string;
  status: string;
  customer: QuoteRequest["customer"];
  items: QuoteItem[];
  owner_notes: string | null;
  customer_message: string | null;
  carriage_ex_vat: number | null;
  extra_charges_ex_vat: number | null;
  quoted_at: string | null;
  invoice_sent_at?: string | null;
  paid_at?: string | null;
  customer_email_sent_at: string | null;
  owner_email_sent_at: string | null;
};

function normaliseStatus(status: string): QuoteStatus {
  if (status === "quoted") return "invoice_sent";
  if (
    status === "new" ||
    status === "reviewing" ||
    status === "invoice_sent" ||
    status === "paid" ||
    status === "closed"
  ) {
    return status;
  }
  return "new";
}

function rowToQuote(row: QuoteRow): QuoteRequest {
  return {
    id: row.id,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    status: normaliseStatus(row.status),
    customer: row.customer,
    items: row.items,
    ownerNotes: row.owner_notes || "",
    customerMessage: row.customer_message || "",
    carriageExVat: row.carriage_ex_vat,
    extraChargesExVat: row.extra_charges_ex_vat,
    quotedAt: row.quoted_at,
    invoiceSentAt: row.invoice_sent_at || row.customer_email_sent_at || row.quoted_at,
    paidAt: row.paid_at,
    customerEmailSentAt: row.customer_email_sent_at,
    ownerEmailSentAt: row.owner_email_sent_at,
  };
}

function quoteToRow(quote: QuoteRequest, legacy = false) {
  return {
    id: quote.id,
    submitted_at: quote.submittedAt,
    updated_at: quote.updatedAt,
    status: legacy && quote.status === "invoice_sent" ? "quoted" : quote.status,
    customer: quote.customer,
    items: quote.items,
    owner_notes: quote.ownerNotes || "",
    customer_message: quote.customerMessage || "",
    carriage_ex_vat: quote.carriageExVat ?? null,
    extra_charges_ex_vat: quote.extraChargesExVat ?? null,
    quoted_at: quote.quotedAt ?? null,
    ...(legacy ? {} : { invoice_sent_at: quote.invoiceSentAt ?? null }),
    ...(legacy ? {} : { paid_at: quote.paidAt ?? null }),
    customer_email_sent_at: quote.customerEmailSentAt ?? null,
    owner_email_sent_at: quote.ownerEmailSentAt ?? null,
  };
}

function isMissingInvoiceColumns(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes("invoice_sent_at") || error?.message?.includes("paid_at")
  );
}

export async function listQuoteRequests(): Promise<QuoteRequest[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quote_requests")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(`Supabase quote_requests read failed: ${error.message}`);
  return (data || []).map((row) => rowToQuote(row as QuoteRow));
}

export async function countNewQuoteRequests(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("quote_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (error) throw new Error(`Supabase quote_requests count failed: ${error.message}`);
  return count || 0;
}

export async function getQuoteRequest(id: string): Promise<QuoteRequest | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quote_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Supabase quote_requests read failed: ${error.message}`);
  return data ? rowToQuote(data as QuoteRow) : null;
}

export async function saveQuoteRequest(quote: QuoteRequest): Promise<QuoteRequest> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quote_requests")
    .upsert(quoteToRow(quote), { onConflict: "id" })
    .select("*")
    .single();

  if (error && isMissingInvoiceColumns(error)) {
    if (quote.status === "paid" || quote.paidAt) {
      throw new Error(
        "Supabase quote_requests needs the invoice/paid migration before paid orders can be saved."
      );
    }

    const legacy = await supabase
      .from("quote_requests")
      .upsert(quoteToRow(quote, true), { onConflict: "id" })
      .select("*")
      .single();

    if (legacy.error) {
      throw new Error(`Supabase quote_requests save failed: ${legacy.error.message}`);
    }
    return rowToQuote(legacy.data as QuoteRow);
  }

  if (error) throw new Error(`Supabase quote_requests save failed: ${error.message}`);
  return rowToQuote(data as QuoteRow);
}
