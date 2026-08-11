import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireLogin } from "@/lib/auth";
import {
  sageRefundRowsForQuote,
  sageSaleRowsForQuote,
  quoteRefunds,
  type SageExportRow,
} from "@/lib/order-accounting";
import { ensureRefundInvoiceNumbers, ensureWebsiteInvoiceNumber, listPaidQuoteRecordsForExport } from "@/lib/quotes";
import type { QuoteRefund, QuoteRequest } from "@/lib/quote-types";
import { shiftUkDateKey, ukMidnightUtc } from "@/lib/uk-time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS: Array<keyof SageExportRow> = [
  "Type",
  "Account",
  "Nominal",
  "Dept",
  "Details",
  "Date",
  "Ref",
  "Net",
  "Tax",
  "T/C",
];

function dateKey(value: string | null) {
  const clean = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function exportBounds(url: URL) {
  const from = dateKey(url.searchParams.get("from"));
  const to = dateKey(url.searchParams.get("to"));
  const start = from ? ukMidnightUtc(from) : null;
  const end = to ? ukMidnightUtc(shiftUkDateKey(to, 1)) : null;
  if (start && end && start.getTime() >= end.getTime()) {
    return { error: "Choose an end date after the start date.", from, to, start: null, end: null };
  }
  return { error: "", from, to, start, end };
}

function isWithinBounds(value: string | null | undefined, start: Date | null, end: Date | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  if (start && time < start.getTime()) return false;
  if (end && time >= end.getTime()) return false;
  return true;
}

function includedRefunds(quote: QuoteRequest, start: Date | null, end: Date | null) {
  return quoteRefunds(quote).filter((refund) => isWithinBounds(refund.createdAt, start, end));
}

function rowValues(row: SageExportRow) {
  return HEADERS.map((header) => row[header]);
}

function buildWorkbook(rows: SageExportRow[]) {
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows.map(rowValues)], { cellDates: true });
  sheet["!cols"] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
  ];

  for (let rowIndex = 2; rowIndex <= rows.length + 1; rowIndex += 1) {
    const dateCell = sheet[`F${rowIndex}`];
    if (dateCell) dateCell.z = "dd/mm/yyyy";
    const netCell = sheet[`H${rowIndex}`];
    if (netCell) netCell.z = "0.00";
    const taxCell = sheet[`I${rowIndex}`];
    if (taxCell) taxCell.z = "0.00";
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "SageBook");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array", cellDates: true }) as ArrayBuffer;
}

function filename(_from: string, _to: string) {
  return "WebsiteInvoiceRecordSheet.xlsx";
}

async function rowsForExport(start: Date | null, end: Date | null) {
  const quotes = await listPaidQuoteRecordsForExport();
  const rows: SageExportRow[] = [];

  for (const quote of quotes) {
    const saleIncluded = isWithinBounds(quote.paidAt || quote.updatedAt, start, end);
    const refunds = includedRefunds(quote, start, end);
    if (!saleIncluded && refunds.length === 0) continue;

    let numbered = await ensureWebsiteInvoiceNumber(quote);
    if (refunds.length > 0) numbered = await ensureRefundInvoiceNumbers(numbered);
    if (saleIncluded) rows.push(...sageSaleRowsForQuote(numbered));
    if (refunds.length > 0) {
      rows.push(...sageRefundRowsForQuote(numbered, includedRefunds(numbered, start, end) as QuoteRefund[]));
    }
  }

  return rows.sort((a, b) => {
    const dateDiff = a.Date.getTime() - b.Date.getTime();
    if (dateDiff) return dateDiff;
    return String(a.Ref).localeCompare(String(b.Ref)) || a.Nominal - b.Nominal;
  });
}

export async function GET(request: Request) {
  const auth = await requireLogin();
  if (auth) return auth;

  try {
    const bounds = exportBounds(new URL(request.url));
    if (bounds.error) return NextResponse.json({ error: bounds.error }, { status: 400 });

    const rows = await rowsForExport(bounds.start, bounds.end);
    const workbook = buildWorkbook(rows);
    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename(bounds.from, bounds.to)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("sage_export_failed", {
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ error: "Sage export could not be created. Please try again." }, { status: 500 });
  }
}
