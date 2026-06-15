import { getD1 } from "@/lib/cloudflare";
import type { QuoteItem, QuoteRequest, QuoteStatus } from "@/lib/quote-types";

type QuoteRow = {
  id: string;
  submitted_at: string;
  updated_at: string;
  status: string;
  customer: string;
  items: string;
  owner_notes: string | null;
  customer_message: string | null;
  carriage_ex_vat: number | null;
  extra_charges_ex_vat: number | null;
  quoted_at: string | null;
  invoice_sent_at: string | null;
  paid_at: string | null;
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

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToQuote(row: QuoteRow): QuoteRequest {
  return {
    id: row.id,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    status: normaliseStatus(row.status),
    customer: parseJson(row.customer, { name: "", email: "", phone: "" }),
    items: parseJson<QuoteItem[]>(row.items, []),
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

export async function listQuoteRequests(): Promise<QuoteRequest[]> {
  const db = await getD1();
  const result = await db
    .prepare("select * from quote_requests order by submitted_at desc")
    .all<QuoteRow>();

  if (result.error) throw new Error(`D1 quote_requests read failed: ${result.error}`);
  return (result.results || []).map(rowToQuote);
}

export async function countNewQuoteRequests(): Promise<number> {
  const db = await getD1();
  const row = await db
    .prepare("select count(*) as count from quote_requests where status = ?")
    .bind("new")
    .first<{ count: number }>();

  return Number(row?.count || 0);
}

export async function getQuoteRequest(id: string): Promise<QuoteRequest | null> {
  const db = await getD1();
  const row = await db
    .prepare("select * from quote_requests where id = ?")
    .bind(id)
    .first<QuoteRow>();

  return row ? rowToQuote(row) : null;
}

export async function saveQuoteRequest(quote: QuoteRequest): Promise<QuoteRequest> {
  const db = await getD1();

  const result = await db
    .prepare(
      `
      insert into quote_requests (
        id,
        submitted_at,
        updated_at,
        status,
        customer,
        items,
        owner_notes,
        customer_message,
        carriage_ex_vat,
        extra_charges_ex_vat,
        quoted_at,
        invoice_sent_at,
        paid_at,
        customer_email_sent_at,
        owner_email_sent_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        submitted_at = excluded.submitted_at,
        updated_at = excluded.updated_at,
        status = excluded.status,
        customer = excluded.customer,
        items = excluded.items,
        owner_notes = excluded.owner_notes,
        customer_message = excluded.customer_message,
        carriage_ex_vat = excluded.carriage_ex_vat,
        extra_charges_ex_vat = excluded.extra_charges_ex_vat,
        quoted_at = excluded.quoted_at,
        invoice_sent_at = excluded.invoice_sent_at,
        paid_at = excluded.paid_at,
        customer_email_sent_at = excluded.customer_email_sent_at,
        owner_email_sent_at = excluded.owner_email_sent_at
      `
    )
    .bind(
      quote.id,
      quote.submittedAt,
      quote.updatedAt,
      quote.status,
      JSON.stringify(quote.customer),
      JSON.stringify(quote.items),
      quote.ownerNotes || "",
      quote.customerMessage || "",
      quote.carriageExVat ?? null,
      quote.extraChargesExVat ?? null,
      quote.quotedAt ?? null,
      quote.invoiceSentAt ?? null,
      quote.paidAt ?? null,
      quote.customerEmailSentAt ?? null,
      quote.ownerEmailSentAt ?? null
    )
    .run();

  if (result.error) throw new Error(`D1 quote_requests save failed: ${result.error}`);

  const saved = await getQuoteRequest(quote.id);
  if (!saved) throw new Error("D1 quote_requests save failed: saved row could not be read.");
  return saved;
}
