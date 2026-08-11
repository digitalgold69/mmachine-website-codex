import { getD1 } from "@/lib/cloudflare";
import {
  quoteNetExVat,
  quoteRefunds,
  requiredRefundInvoiceCount,
  requiredWebsiteInvoiceCount,
} from "@/lib/order-accounting";
import type { QuoteItem, QuoteRefund, QuoteRequest, QuoteStatus } from "@/lib/quote-types";
import { ukDateKey, ukMonthBounds } from "@/lib/uk-time";

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
  paid_month_uk: string | null;
  total_ex_vat: number | null;
  customer_email_sent_at: string | null;
  owner_email_sent_at: string | null;
  include_vat?: number | string | boolean | null;
  website_invoice_number?: string | null;
  website_invoice_count?: number | string | null;
  refunds?: string | null;
};

let quoteSchemaReady: Promise<void> | null = null;

async function executeSchema(db: Awaited<ReturnType<typeof getD1>>, sql: string) {
  try {
    await db.prepare(sql).run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/duplicate column name|already exists/i.test(message)) throw err;
  }
}

async function ensureQuoteAccountingSchemaInner() {
  const db = await getD1();
  const statements = [
    `ALTER TABLE quote_requests ADD COLUMN include_vat INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE quote_requests ADD COLUMN website_invoice_number TEXT`,
    `ALTER TABLE quote_requests ADD COLUMN website_invoice_count INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE quote_requests ADD COLUMN refunds TEXT NOT NULL DEFAULT '[]'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_website_invoice_number_idx
      ON quote_requests(website_invoice_number)`,
    `CREATE TABLE IF NOT EXISTS accounting_sequences (
      name TEXT PRIMARY KEY,
      next_number INTEGER NOT NULL
    )`,
    `INSERT INTO accounting_sequences (name, next_number)
      VALUES ('website_invoice', 1234)
      ON CONFLICT(name) DO NOTHING`,
  ];

  for (const statement of statements) await executeSchema(db, statement);

  const maxRow = await db
    .prepare(
      `SELECT MAX(CAST(SUBSTR(website_invoice_number, 2) AS INTEGER) + coalesce(website_invoice_count, 1) - 1) AS max_ref
       FROM quote_requests
       WHERE website_invoice_number LIKE 'W%'`
    )
    .first<{ max_ref: number | null }>();
  const refundMaxRow = await db
    .prepare(
      `SELECT MAX(
         CAST(SUBSTR(json_extract(refund.value, '$.websiteInvoiceNumber'), 2) AS INTEGER)
         + coalesce(CAST(json_extract(refund.value, '$.websiteInvoiceCount') AS INTEGER), 1)
         - 1
       ) AS max_ref
       FROM quote_requests, json_each(coalesce(quote_requests.refunds, '[]')) AS refund
       WHERE json_extract(refund.value, '$.websiteInvoiceNumber') LIKE 'W%'`
    )
    .first<{ max_ref: number | null }>();
  const nextNumber = Math.max(
    1234,
    Number(maxRow?.max_ref || 0) + 1,
    Number(refundMaxRow?.max_ref || 0) + 1
  );
  await db
    .prepare(
      `UPDATE accounting_sequences
       SET next_number = CASE WHEN next_number < ? THEN ? ELSE next_number END
       WHERE name = 'website_invoice'`
    )
    .bind(nextNumber, nextNumber)
    .run();
}

export async function ensureQuoteAccountingSchema() {
  if (!quoteSchemaReady) {
    quoteSchemaReady = ensureQuoteAccountingSchemaInner().catch((err) => {
      quoteSchemaReady = null;
      throw err;
    });
  }
  return quoteSchemaReady;
}

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

function boolFromDb(value: unknown, fallback = true) {
  if (value === null || value === undefined || value === "") return fallback;
  return value === 1 || value === true || value === "1";
}

function intFromDb(value: unknown, fallback = 1) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
    includeVat: boolFromDb(row.include_vat, true),
    websiteInvoiceNumber: row.website_invoice_number || null,
    websiteInvoiceCount: intFromDb(row.website_invoice_count, 1),
    refunds: quoteRefunds({ refunds: parseJson(row.refunds || null, []) }),
  };
}

async function ensureStoredInvoiceRanges(quotes: QuoteRequest[]) {
  return Promise.all(
    quotes.map((quote) => ensureWebsiteInvoiceNumber(quote))
  );
}

export async function listDashboardQuoteRequests(sincePaidAt: string): Promise<QuoteRequest[]> {
  const db = await getD1();
  const result = await db
    .prepare(
      `select * from quote_requests
       where status in ('new', 'reviewing', 'invoice_sent')
          or (status = 'paid' and paid_at >= ?)
       order by submitted_at desc`
    )
    .bind(sincePaidAt)
    .all<QuoteRow>();

  if (result.error) throw new Error(`D1 dashboard quote read failed: ${result.error}`);
  return ensureStoredInvoiceRanges((result.results || []).map(rowToQuote));
}

const QUOTE_TOTAL_SQL = `
  coalesce(
    total_ex_vat,
    coalesce((
      select sum(
        coalesce(cast(json_extract(line.value, '$.unitPriceExVat') as real), 0) *
        coalesce(cast(json_extract(line.value, '$.qty') as integer), 0)
      )
      from json_each(quote_requests.items) as line
    ), 0)
    + coalesce(carriage_ex_vat, 0)
    + coalesce(extra_charges_ex_vat, 0)
  )
`;

export type BestPaidMonth = {
  key: string;
  value: number;
  count: number;
};

export async function getBestPaidMonth(): Promise<BestPaidMonth | null> {
  const db = await getD1();
  const missing = await db
    .prepare(
      `select id, coalesce(paid_at, updated_at) as paid_at
       from quote_requests
       where status = 'paid' and (paid_month_uk is null or paid_month_uk = '')`
    )
    .all<{ id: string; paid_at: string }>();

  if (missing.error) throw new Error(`D1 paid month backfill read failed: ${missing.error}`);
  for (const row of missing.results || []) {
    const monthKey = ukDateKey(row.paid_at).slice(0, 7);
    const result = await db
      .prepare("update quote_requests set paid_month_uk = ? where id = ?")
      .bind(monthKey, row.id)
      .run();
    if (result.error) throw new Error(`D1 paid month backfill failed: ${result.error}`);
  }

  const row = await db
    .prepare(
      `select
         paid_month_uk as month_key,
         count(*) as sales_count,
         coalesce(sum(${QUOTE_TOTAL_SQL}), 0) as sales_value
       from quote_requests
       where status = 'paid' and paid_month_uk is not null and paid_month_uk != ''
       group by paid_month_uk
       order by sales_value desc, paid_month_uk desc
       limit 1`
    )
    .first<{ month_key: string; sales_count: number; sales_value: number }>();

  if (!row?.month_key) return null;
  return {
    key: row.month_key,
    count: Number(row.sales_count || 0),
    value: Number(row.sales_value || 0),
  };
}

export type PaidHistoryResult = {
  quotes: QuoteRequest[];
  count: number;
  monthStats: Record<string, { salesValue: number; salesCount: number }>;
};

export type PaidHistoryOrderType = "all" | "mini" | "metals" | "custom" | "featured";

function quoteMatchesPaidHistoryOrderType(quote: QuoteRequest, orderType: PaidHistoryOrderType = "all") {
  if (orderType === "all") return true;
  return quote.items.some((item) => item.catalogue === orderType);
}

export async function listActiveQuoteRequests(): Promise<QuoteRequest[]> {
  const db = await getD1();
  const result = await db
    .prepare("select * from quote_requests where status in ('new', 'reviewing', 'invoice_sent') order by submitted_at desc")
    .all<QuoteRow>();
  if (result.error) throw new Error(`D1 active quote read failed: ${result.error}`);
  return ensureStoredInvoiceRanges((result.results || []).map(rowToQuote));
}

export async function listPaidQuoteHistory(options: {
  limit: number;
  offset: number;
  query?: string;
  start?: string;
  end?: string;
  orderType?: PaidHistoryOrderType;
}): Promise<PaidHistoryResult> {
  const db = await getD1();
  const clauses = ["status = 'paid'"];
  const bindings: unknown[] = [];

  if (options.start) {
    clauses.push("paid_at >= ?");
    bindings.push(options.start);
  }
  if (options.end) {
    clauses.push("paid_at < ?");
    bindings.push(options.end);
  }
  if (options.query?.trim()) {
    const escaped = options.query.trim().toLowerCase().replace(/[\\%_]/g, "\\$&");
    clauses.push("lower(id || ' ' || customer || ' ' || items || ' ' || coalesce(owner_notes, '') || ' ' || coalesce(customer_message, '')) like ? escape '\\'");
    bindings.push(`%${escaped}%`);
  }

  const where = clauses.join(" and ");
  const result = await db
    .prepare(`select * from quote_requests where ${where} order by paid_at desc`)
    .bind(...bindings)
    .all<QuoteRow>();

  if (result.error) throw new Error(`D1 paid history read failed: ${result.error}`);
  const allQuotes = await ensureStoredInvoiceRanges((result.results || []).map(rowToQuote));
  const filteredQuotes = allQuotes.filter((quote) =>
    quoteMatchesPaidHistoryOrderType(quote, options.orderType || "all")
  );
  const offset = Math.max(0, options.offset);
  const limit = Math.max(1, Math.min(100, options.limit));
  const quotes = filteredQuotes.slice(offset, offset + limit);
  const monthKeys = [...new Set(quotes.map((quote) => ukDateKey(quote.paidAt || quote.updatedAt).slice(0, 7)))];
  const filteredMonthStats = filteredQuotes.reduce((stats, quote) => {
    const monthKey = ukDateKey(quote.paidAt || quote.updatedAt).slice(0, 7);
    const current = stats[monthKey] || { salesValue: 0, salesCount: 0 };
    current.salesCount += 1;
    current.salesValue += quoteNetExVat(quote);
    stats[monthKey] = current;
    return stats;
  }, {} as Record<string, { salesValue: number; salesCount: number }>);
  const monthStats: Record<string, { salesValue: number; salesCount: number }> = {};

  for (const monthKey of monthKeys) {
    const row = filteredMonthStats[monthKey];
    monthStats[monthKey] = {
      salesCount: Number(row?.salesCount || 0),
      salesValue: Number(row?.salesValue || 0),
    };
  }

  return { quotes, count: filteredQuotes.length, monthStats };
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

function invoiceNumberValue(ref: string | null | undefined) {
  const match = String(ref || "").match(/^W(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function invoiceNumberRange(ref: string | null | undefined, count: number) {
  const base = invoiceNumberValue(ref);
  if (!base) return null;
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  return { base, end: base + safeCount - 1 };
}

async function ensureInvoiceSequenceAfter(ref: string | null | undefined, count: number) {
  const base = invoiceNumberValue(ref);
  if (!base) return;
  const nextNumber = base + Math.max(1, Math.floor(count));
  const db = await getD1();
  await db
    .prepare(
      `UPDATE accounting_sequences
       SET next_number = CASE WHEN next_number < ? THEN ? ELSE next_number END
       WHERE name = 'website_invoice'`
    )
    .bind(nextNumber, nextNumber)
    .run();
}

async function saleInvoiceRangeHasConflict(ref: string | null | undefined, count: number, excludedQuoteId = "") {
  const range = invoiceNumberRange(ref, count);
  if (!range) return false;
  const db = await getD1();
  const row = await db
    .prepare(
      `SELECT id
       FROM quote_requests
       WHERE (? = '' OR id != ?)
         AND website_invoice_number LIKE 'W%'
         AND CAST(SUBSTR(website_invoice_number, 2) AS INTEGER) <= ?
         AND CAST(SUBSTR(website_invoice_number, 2) AS INTEGER) + coalesce(website_invoice_count, 1) - 1 >= ?
       LIMIT 1`
    )
    .bind(excludedQuoteId, excludedQuoteId, range.end, range.base)
    .first<{ id: string }>();
  return Boolean(row?.id);
}

async function refundInvoiceRangeHasConflict(
  quoteId: string,
  refundId: string,
  ref: string | null | undefined,
  count: number
) {
  const range = invoiceNumberRange(ref, count);
  if (!range) return false;
  if (await saleInvoiceRangeHasConflict(ref, count)) return true;

  const db = await getD1();
  const row = await db
    .prepare(
      `SELECT quote_requests.id AS quote_id
       FROM quote_requests, json_each(coalesce(quote_requests.refunds, '[]')) AS refund
       WHERE json_extract(refund.value, '$.websiteInvoiceNumber') LIKE 'W%'
         AND NOT (
           quote_requests.id = ?
           AND json_extract(refund.value, '$.id') = ?
         )
         AND CAST(SUBSTR(json_extract(refund.value, '$.websiteInvoiceNumber'), 2) AS INTEGER) <= ?
         AND CAST(SUBSTR(json_extract(refund.value, '$.websiteInvoiceNumber'), 2) AS INTEGER)
             + coalesce(CAST(json_extract(refund.value, '$.websiteInvoiceCount') AS INTEGER), 1)
             - 1 >= ?
       LIMIT 1`
    )
    .bind(quoteId, refundId, range.end, range.base)
    .first<{ quote_id: string }>();
  return Boolean(row?.quote_id);
}

async function invoiceRangeHasConflict(quoteId: string, ref: string | null | undefined, count: number) {
  const range = invoiceNumberRange(ref, count);
  if (!range) return false;
  if (await saleInvoiceRangeHasConflict(ref, count, quoteId)) return true;

  const db = await getD1();
  const row = await db
    .prepare(
      `SELECT quote_requests.id AS quote_id
       FROM quote_requests, json_each(coalesce(quote_requests.refunds, '[]')) AS refund
       WHERE json_extract(refund.value, '$.websiteInvoiceNumber') LIKE 'W%'
         AND CAST(SUBSTR(json_extract(refund.value, '$.websiteInvoiceNumber'), 2) AS INTEGER) <= ?
         AND CAST(SUBSTR(json_extract(refund.value, '$.websiteInvoiceNumber'), 2) AS INTEGER)
             + coalesce(CAST(json_extract(refund.value, '$.websiteInvoiceCount') AS INTEGER), 1)
             - 1 >= ?
       LIMIT 1`
    )
    .bind(range.end, range.base)
    .first<{ quote_id: string }>();
  return Boolean(row?.quote_id);
}

async function allocateAvailableInvoiceNumber(
  count: number,
  hasConflict: (ref: string) => Promise<boolean>
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const ref = await allocateWebsiteInvoiceNumber(count);
    if (!(await hasConflict(ref))) return ref;
  }
  throw new Error("Website invoice number range could not be allocated without a conflict.");
}

export async function allocateWebsiteInvoiceNumber(count = 1): Promise<string> {
  await ensureQuoteAccountingSchema();
  const requestedCount = Math.max(1, Math.floor(Number(count) || 1));
  const db = await getD1();
  const row = await db
    .prepare(
      `UPDATE accounting_sequences
       SET next_number = next_number + ?
       WHERE name = 'website_invoice'
       RETURNING next_number - ? AS allocated`
    )
    .bind(requestedCount, requestedCount)
    .first<{ allocated: number }>();

  if (!row?.allocated) throw new Error("Website invoice number could not be allocated.");
  const allocated = Math.max(1234, Number(row.allocated));
  return `W${allocated}`;
}

export async function ensureWebsiteInvoiceNumber(quote: QuoteRequest): Promise<QuoteRequest> {
  const requiredCount = requiredWebsiteInvoiceCount(quote);
  const currentCount = Math.max(1, Math.floor(Number(quote.websiteInvoiceCount) || 1));
  if (
    quote.websiteInvoiceNumber &&
    currentCount >= requiredCount &&
    !(await invoiceRangeHasConflict(quote.id, quote.websiteInvoiceNumber, currentCount))
  ) {
    return quote;
  }

  const fresh = await getQuoteRequest(quote.id);
  const freshCount = Math.max(1, Math.floor(Number(fresh?.websiteInvoiceCount) || 1));
  if (
    fresh?.websiteInvoiceNumber &&
    freshCount >= requiredCount &&
    !(await invoiceRangeHasConflict(quote.id, fresh.websiteInvoiceNumber, freshCount))
  ) {
    return { ...quote, websiteInvoiceNumber: fresh.websiteInvoiceNumber, websiteInvoiceCount: freshCount };
  }

  if (fresh?.websiteInvoiceNumber || quote.websiteInvoiceNumber) {
    const websiteInvoiceNumber = fresh?.websiteInvoiceNumber || quote.websiteInvoiceNumber || null;
    if (await invoiceRangeHasConflict(quote.id, websiteInvoiceNumber, requiredCount)) {
      const freshWebsiteInvoiceNumber = await allocateAvailableInvoiceNumber(requiredCount, (ref) =>
        invoiceRangeHasConflict(quote.id, ref, requiredCount)
      );
      return saveQuoteRequest({
        ...quote,
        websiteInvoiceNumber: freshWebsiteInvoiceNumber,
        websiteInvoiceCount: requiredCount,
      });
    }
    await ensureInvoiceSequenceAfter(websiteInvoiceNumber, requiredCount);
    return saveQuoteRequest({
      ...quote,
      websiteInvoiceNumber,
      websiteInvoiceCount: requiredCount,
    });
  }

  const websiteInvoiceNumber = await allocateAvailableInvoiceNumber(requiredCount, (ref) =>
    invoiceRangeHasConflict(quote.id, ref, requiredCount)
  );
  return saveQuoteRequest({ ...quote, websiteInvoiceNumber, websiteInvoiceCount: requiredCount });
}

export async function ensureRefundInvoiceNumbers(quote: QuoteRequest): Promise<QuoteRequest> {
  const refunds = quoteRefunds(quote);
  if (refunds.length === 0) return quote;

  let changed = false;
  const numberedRefunds: QuoteRefund[] = [];

  for (const refund of refunds) {
    const requiredCount = requiredRefundInvoiceCount(refund);
    const currentCount = Math.max(1, Math.floor(Number(refund.websiteInvoiceCount) || 1));

    if (
      refund.websiteInvoiceNumber &&
      currentCount >= requiredCount &&
      !(await refundInvoiceRangeHasConflict(quote.id, refund.id, refund.websiteInvoiceNumber, currentCount))
    ) {
      changed ||= refund.websiteInvoiceCount !== currentCount;
      numberedRefunds.push({
        ...refund,
        websiteInvoiceCount: currentCount,
      });
      continue;
    }

    const websiteInvoiceNumber = await allocateAvailableInvoiceNumber(requiredCount, (ref) =>
      refundInvoiceRangeHasConflict(quote.id, refund.id, ref, requiredCount)
    );
    numberedRefunds.push({
      ...refund,
      websiteInvoiceNumber,
      websiteInvoiceCount: requiredCount,
    });
    changed = true;
  }

  if (!changed) return quote;
  return saveQuoteRequest({ ...quote, refunds: numberedRefunds });
}

export async function listPaidQuoteRecordsForExport(): Promise<QuoteRequest[]> {
  await ensureQuoteAccountingSchema();
  const db = await getD1();
  const quotes: QuoteRequest[] = [];
  const pageSize = 500;
  let offset = 0;

  for (;;) {
    const result = await db
      .prepare("select * from quote_requests where status = 'paid' order by paid_at asc limit ? offset ?")
      .bind(pageSize, offset)
      .all<QuoteRow>();
    if (result.error) throw new Error(`D1 paid export read failed: ${result.error}`);
    const rows = result.results || [];
    quotes.push(...rows.map(rowToQuote));
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return quotes;
}

export async function saveQuoteRequest(quote: QuoteRequest): Promise<QuoteRequest> {
  await ensureQuoteAccountingSchema();
  const db = await getD1();
  const paidMonthUk = quote.status === "paid"
    ? ukDateKey(quote.paidAt || quote.updatedAt).slice(0, 7)
    : null;
  const totalExVat = quoteNetExVat(quote);
  const storedWebsiteInvoiceCount = Math.max(1, Math.floor(Number(quote.websiteInvoiceCount) || 1));
  const websiteInvoiceCount = quote.websiteInvoiceNumber
    ? storedWebsiteInvoiceCount
    : Math.max(1, requiredWebsiteInvoiceCount(quote));

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
        paid_month_uk,
        total_ex_vat,
        customer_email_sent_at,
        owner_email_sent_at,
        include_vat,
        website_invoice_number,
        website_invoice_count,
        refunds
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        paid_month_uk = excluded.paid_month_uk,
        total_ex_vat = excluded.total_ex_vat,
        customer_email_sent_at = excluded.customer_email_sent_at,
        owner_email_sent_at = excluded.owner_email_sent_at,
        include_vat = excluded.include_vat,
        website_invoice_number = excluded.website_invoice_number,
        website_invoice_count = excluded.website_invoice_count,
        refunds = excluded.refunds
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
      paidMonthUk,
      totalExVat,
      quote.customerEmailSentAt ?? null,
      quote.ownerEmailSentAt ?? null,
      quote.includeVat === false ? 0 : 1,
      quote.websiteInvoiceNumber ?? null,
      websiteInvoiceCount,
      JSON.stringify(quoteRefunds(quote))
    )
    .run();

  if (result.error) throw new Error(`D1 quote_requests save failed: ${result.error}`);

  const saved = await getQuoteRequest(quote.id);
  if (!saved) throw new Error("D1 quote_requests save failed: saved row could not be read.");
  return saved;
}
