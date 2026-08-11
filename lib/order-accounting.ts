import type {
  QuoteAccountingBucket,
  QuoteCatalogue,
  QuoteItem,
  QuoteRefund,
  QuoteRequest,
} from "@/lib/quote-types";

export const VAT_RATE = 0.2;

export const PRODUCT_ACCOUNTING_BUCKETS: QuoteAccountingBucket[] = [
  "mini",
  "metals",
  "engineering",
  "featured",
];

export const ACCOUNTING_BUCKETS: QuoteAccountingBucket[] = [
  ...PRODUCT_ACCOUNTING_BUCKETS,
  "carriage",
];

export const ACCOUNTING_NOMINALS: Record<QuoteAccountingBucket, number> = {
  mini: 4000,
  metals: 4001,
  carriage: 4002,
  engineering: 4005,
  featured: 4009,
};

export const ACCOUNTING_BUCKET_LABELS: Record<QuoteAccountingBucket, string> = {
  mini: "Mini panels",
  metals: "Metals",
  carriage: "Carriage",
  engineering: "Engineering",
  featured: "Featured work",
};

export type AccountingGroup = {
  bucket: QuoteAccountingBucket;
  nominal: number;
  goodsExVat: number;
  chargesExVat: number;
  netExVat: number;
};

export type SageExportRow = {
  Type: "SI";
  Account: "WEB";
  Nominal: number;
  Dept: 0;
  Details: string;
  Date: Date;
  Ref: string;
  Net: number;
  Tax: number;
  "T/C": "T1" | "T0";
};

function finiteNumber(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function roundAccounting(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positiveAmount(value: unknown) {
  return Math.max(0, roundAccounting(finiteNumber(value)));
}

export function quoteIncludesVat(quote: Pick<QuoteRequest, "includeVat">) {
  return quote.includeVat !== false;
}

export function accountingBucketForCatalogue(catalogue: QuoteCatalogue): QuoteAccountingBucket {
  if (catalogue === "mini") return "mini";
  if (catalogue === "metals") return "metals";
  if (catalogue === "featured") return "featured";
  return "engineering";
}

export function lineExVat(item: QuoteItem) {
  return typeof item.unitPriceExVat === "number"
    ? roundAccounting(item.unitPriceExVat * item.qty)
    : 0;
}

export function emptyAccountingTotals() {
  return ACCOUNTING_BUCKETS.reduce((totals, bucket) => {
    totals[bucket] = 0;
    return totals;
  }, {} as Record<QuoteAccountingBucket, number>);
}

function productItemBuckets(quote: QuoteRequest) {
  const buckets = new Set<QuoteAccountingBucket>();
  for (const item of quote.items) buckets.add(accountingBucketForCatalogue(item.catalogue));
  return [...buckets].filter((bucket) => PRODUCT_ACCOUNTING_BUCKETS.includes(bucket));
}

export function quoteGoodsByBucket(quote: QuoteRequest) {
  const totals = emptyAccountingTotals();
  for (const item of quote.items) {
    totals[accountingBucketForCatalogue(item.catalogue)] += lineExVat(item);
  }
  for (const bucket of ACCOUNTING_BUCKETS) totals[bucket] = roundAccounting(totals[bucket]);
  return totals;
}

export function quoteRefunds(quote: Pick<QuoteRequest, "refunds">): QuoteRefund[] {
  return Array.isArray(quote.refunds)
    ? quote.refunds
        .map((refund) => ({
          ...refund,
          lines: Array.isArray(refund.lines)
            ? refund.lines
                .filter((line) => ACCOUNTING_BUCKETS.includes(line.bucket))
                .map((line) => ({ bucket: line.bucket, amountExVat: positiveAmount(line.amountExVat) }))
                .filter((line) => line.amountExVat > 0)
            : [],
        }))
        .filter((refund) => refund.lines.length > 0)
    : [];
}

export function refundNetExVat(refund: QuoteRefund) {
  return roundAccounting(refund.lines.reduce((sum, line) => sum + positiveAmount(line.amountExVat), 0));
}

export function quoteRefundExVat(quote: Pick<QuoteRequest, "refunds">) {
  return roundAccounting(quoteRefunds(quote).reduce((sum, refund) => sum + refundNetExVat(refund), 0));
}

export function quoteProductAccountingGroups(quote: QuoteRequest): AccountingGroup[] {
  const goodsByBucket = quoteGoodsByBucket(quote);
  const productBuckets = PRODUCT_ACCOUNTING_BUCKETS.filter((bucket) => goodsByBucket[bucket] > 0);
  const itemBuckets = productItemBuckets(quote);
  const activeBuckets = productBuckets.length > 0
    ? productBuckets
    : itemBuckets.length > 0
      ? itemBuckets
      : ["engineering" as const];

  const totalGoods = roundAccounting(PRODUCT_ACCOUNTING_BUCKETS.reduce((sum, bucket) => sum + goodsByBucket[bucket], 0));
  const totalExtraCharges = positiveAmount(quote.extraChargesExVat ?? 0);
  const extraByBucket = emptyAccountingTotals();

  if (totalExtraCharges !== 0) {
    if (totalGoods > 0) {
      let allocated = 0;
      activeBuckets.forEach((bucket, index) => {
        const amount = index === activeBuckets.length - 1
          ? roundAccounting(totalExtraCharges - allocated)
          : roundAccounting(totalExtraCharges * (goodsByBucket[bucket] / totalGoods));
        extraByBucket[bucket] = amount;
        allocated = roundAccounting(allocated + amount);
      });
    } else {
      extraByBucket[activeBuckets[0]] = totalExtraCharges;
    }
  }

  return PRODUCT_ACCOUNTING_BUCKETS
    .map((bucket) => {
      const goodsExVat = roundAccounting(goodsByBucket[bucket]);
      const chargesExVat = roundAccounting(extraByBucket[bucket]);
      return {
        bucket,
        nominal: ACCOUNTING_NOMINALS[bucket],
        goodsExVat,
        chargesExVat,
        netExVat: roundAccounting(goodsExVat + chargesExVat),
      };
    })
    .filter((group) => group.netExVat !== 0);
}

export function quoteAccountingGroups(quote: QuoteRequest): AccountingGroup[] {
  const groups = quoteProductAccountingGroups(quote);
  const carriageExVat = positiveAmount(quote.carriageExVat ?? 0);
  if (carriageExVat > 0) {
    groups.push({
      bucket: "carriage",
      nominal: ACCOUNTING_NOMINALS.carriage,
      goodsExVat: 0,
      chargesExVat: carriageExVat,
      netExVat: carriageExVat,
    });
  }
  return groups;
}

export function requiredWebsiteInvoiceCount(quote: QuoteRequest) {
  return Math.max(1, quoteAccountingGroups(quote).length);
}

function invoiceNumberValue(ref: string | null | undefined) {
  const match = String(ref || "").match(/^W(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function invoiceRefFromBase(ref: string | null | undefined, offset: number, fallback: string) {
  const base = invoiceNumberValue(ref);
  if (!base) return ref || fallback;
  return `W${base + Math.max(0, offset)}`;
}

function invoiceRefAt(quote: QuoteRequest, offset: number) {
  return invoiceRefFromBase(quote.websiteInvoiceNumber, offset, quote.id);
}

function storedInvoiceCount(quote: Pick<QuoteRequest, "websiteInvoiceCount">) {
  return Math.max(1, Math.floor(Number(quote.websiteInvoiceCount) || 1));
}

export function websiteInvoiceDisplay(quote: QuoteRequest) {
  if (!quote.websiteInvoiceNumber) return quote.id;
  const count = Math.max(storedInvoiceCount(quote), requiredWebsiteInvoiceCount(quote));
  if (count <= 1) return quote.websiteInvoiceNumber;
  return `${quote.websiteInvoiceNumber}-${invoiceRefAt(quote, count - 1)}`;
}

export function websiteInvoiceRefForBucket(quote: QuoteRequest, bucket: QuoteAccountingBucket) {
  const groupIndex = quoteAccountingGroups(quote).findIndex((group) => group.bucket === bucket);
  return invoiceRefAt(quote, groupIndex >= 0 ? groupIndex : 0);
}

export function requiredRefundInvoiceCount(refund: QuoteRefund) {
  return Math.max(1, refund.lines.length);
}

export function websiteRefundRefForLine(refund: QuoteRefund, lineIndex: number) {
  return invoiceRefFromBase(refund.websiteInvoiceNumber, lineIndex, refund.id);
}

export function quoteGrossExVat(quote: QuoteRequest) {
  return roundAccounting(quoteAccountingGroups(quote).reduce((sum, group) => sum + group.netExVat, 0));
}

export function quoteNetExVat(quote: QuoteRequest) {
  return roundAccounting(quoteGrossExVat(quote) - quoteRefundExVat(quote));
}

export function quoteVat(quote: QuoteRequest) {
  return quoteIncludesVat(quote) ? roundAccounting(quoteNetExVat(quote) * VAT_RATE) : 0;
}

export function quoteTotalIncVat(quote: QuoteRequest) {
  return roundAccounting(quoteNetExVat(quote) + quoteVat(quote));
}

export function quoteTotals(quote: QuoteRequest) {
  const goodsExVat = roundAccounting(quote.items.reduce((sum, item) => sum + lineExVat(item), 0));
  const carriageExVat = positiveAmount(quote.carriageExVat ?? 0);
  const extraChargesExVat = positiveAmount(quote.extraChargesExVat ?? 0);
  const subtotalExVat = roundAccounting(goodsExVat + carriageExVat + extraChargesExVat);
  const refundsExVat = quoteRefundExVat(quote);
  const totalExVat = roundAccounting(subtotalExVat - refundsExVat);
  const vat = quoteIncludesVat(quote) ? roundAccounting(totalExVat * VAT_RATE) : 0;
  const totalIncVat = roundAccounting(totalExVat + vat);

  return {
    goodsExVat,
    carriageExVat,
    extraChargesExVat,
    subtotalExVat,
    refundsExVat,
    totalExVat,
    vat,
    totalIncVat,
    includeVat: quoteIncludesVat(quote),
  };
}

export function remainingRefundByBucket(quote: QuoteRequest) {
  const remaining = emptyAccountingTotals();
  for (const group of quoteAccountingGroups(quote)) remaining[group.bucket] = group.netExVat;

  for (const refund of quoteRefunds(quote)) {
    for (const line of refund.lines) {
      remaining[line.bucket] = roundAccounting(remaining[line.bucket] - positiveAmount(line.amountExVat));
    }
  }

  for (const bucket of ACCOUNTING_BUCKETS) remaining[bucket] = Math.max(0, roundAccounting(remaining[bucket]));
  return remaining;
}

export function accountingDetailsName(quote: QuoteRequest) {
  return (quote.customer.company || quote.customer.name || "Website customer").trim();
}

function taxCode(quote: QuoteRequest): "T1" | "T0" {
  return quoteIncludesVat(quote) ? "T1" : "T0";
}

function exportDate(value: string | null | undefined) {
  return value ? new Date(value) : new Date();
}

function applyTaxRemainder(quote: QuoteRequest, rows: SageExportRow[]) {
  if (rows.length === 0 || !quoteIncludesVat(quote)) return rows;
  const totalTax = roundAccounting(rows.reduce((sum, row) => sum + row.Net, 0) * VAT_RATE);
  let allocatedTax = 0;
  return rows.map((row, index) => {
    const tax = index === rows.length - 1
      ? roundAccounting(totalTax - allocatedTax)
      : roundAccounting(row.Net * VAT_RATE);
    allocatedTax = roundAccounting(allocatedTax + tax);
    return { ...row, Tax: tax };
  });
}

export function sageSaleRowsForQuote(quote: QuoteRequest): SageExportRow[] {
  const date = exportDate(quote.paidAt || quote.updatedAt);
  const details = accountingDetailsName(quote);
  const rows = quoteAccountingGroups(quote).map((group) => ({
    Type: "SI" as const,
    Account: "WEB" as const,
    Nominal: group.nominal,
    Dept: 0 as const,
    Details: details,
    Date: date,
    Ref: websiteInvoiceRefForBucket(quote, group.bucket),
    Net: roundAccounting(group.netExVat),
    Tax: 0,
    "T/C": taxCode(quote),
  }));

  return applyTaxRemainder(quote, rows);
}

export function sageRefundRowsForQuote(quote: QuoteRequest, refunds = quoteRefunds(quote)): SageExportRow[] {
  const details = accountingDetailsName(quote);
  const rows = refunds.flatMap((refund) =>
    refund.lines.map((line, lineIndex) => ({
      Type: "SI" as const,
      Account: "WEB" as const,
      Nominal: ACCOUNTING_NOMINALS[line.bucket],
      Dept: 0 as const,
      Details: details,
      Date: exportDate(refund.createdAt),
      Ref: websiteRefundRefForLine(refund, lineIndex),
      Net: roundAccounting(-positiveAmount(line.amountExVat)),
      Tax: 0,
      "T/C": taxCode(quote),
    }))
  );

  return applyTaxRemainder(quote, rows);
}
