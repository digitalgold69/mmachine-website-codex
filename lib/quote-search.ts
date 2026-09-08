import {
  ACCOUNTING_BUCKET_LABELS,
  quoteAccountingGroups,
  quoteRefunds,
  quoteTotals,
  websiteInvoiceDisplay,
  websiteInvoiceRefForBucket,
  websiteRefundRefForLine,
} from "@/lib/order-accounting";
import type { QuoteRequest } from "@/lib/quote-types";

function compactSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function collectSearchValues(value: unknown, values: string[], depth = 0) {
  if (depth > 6 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchValues(item, values, depth + 1));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectSearchValues(item, values, depth + 1));
    return;
  }
  values.push(String(value));
}

export function quotePaidHistorySearchText(quote: QuoteRequest) {
  const values: string[] = [];
  collectSearchValues(quote, values);
  values.push(websiteInvoiceDisplay(quote));

  for (const group of quoteAccountingGroups(quote)) {
    values.push(
      group.bucket,
      ACCOUNTING_BUCKET_LABELS[group.bucket],
      String(group.nominal),
      websiteInvoiceRefForBucket(quote, group.bucket),
      group.netExVat.toFixed(2)
    );
  }

  for (const refund of quoteRefunds(quote)) {
    values.push(refund.id, refund.reason || "", refund.createdAt, refund.websiteInvoiceNumber || "");
    refund.lines.forEach((line, index) => {
      values.push(
        websiteRefundRefForLine(refund, index),
        line.bucket,
        ACCOUNTING_BUCKET_LABELS[line.bucket],
        line.amountExVat.toFixed(2)
      );
    });
  }

  collectSearchValues(quoteTotals(quote), values);
  return values.filter(Boolean).join(" ");
}

export function quoteMatchesPaidHistorySearch(quote: QuoteRequest, rawQuery = "") {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const haystack = quotePaidHistorySearchText(quote).toLowerCase();
  if (haystack.includes(query)) return true;

  const compactQuery = compactSearchText(query);
  return compactQuery ? compactSearchText(haystack).includes(compactQuery) : true;
}
