import type {
  QuoteAccountingBucket,
  QuoteCatalogue,
  QuoteItem,
  QuoteRefund,
  QuoteRequest,
} from "@/lib/quote-types";

export const VAT_RATE = 0.2;
export const ACCOUNTING_BUCKETS: QuoteAccountingBucket[] = ["mini", "metals", "engineering"];

export const ACCOUNTING_NOMINALS: Record<QuoteAccountingBucket, number> = {
  mini: 4000,
  metals: 4001,
  engineering: 4005,
};

export const ACCOUNTING_BUCKET_LABELS: Record<QuoteAccountingBucket, string> = {
  mini: "Mini panels",
  metals: "Metals",
  engineering: "Engineering",
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
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
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
  return "engineering";
}

export function lineExVat(item: QuoteItem) {
  return typeof item.unitPriceExVat === "number"
    ? roundAccounting(item.unitPriceExVat * item.qty)
    : 0;
}

function emptyBucketTotals() {
  return {
    mini: 0,
    metals: 0,
    engineering: 0,
  } satisfies Record<QuoteAccountingBucket, number>;
}

function quoteItemBuckets(quote: QuoteRequest) {
  const buckets = new Set<QuoteAccountingBucket>();
  for (const item of quote.items) buckets.add(accountingBucketForCatalogue(item.catalogue));
  return [...buckets];
}

export function quoteGoodsByBucket(quote: QuoteRequest) {
  const totals = emptyBucketTotals();
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

export function quoteAccountingGroups(quote: QuoteRequest): AccountingGroup[] {
  const goodsByBucket = quoteGoodsByBucket(quote);
  const itemBuckets = quoteItemBuckets(quote);
  const goodsBuckets = ACCOUNTING_BUCKETS.filter((bucket) => goodsByBucket[bucket] > 0);
  const activeBuckets = goodsBuckets.length > 0
    ? goodsBuckets
    : itemBuckets.length > 0
      ? itemBuckets
      : ["engineering" as const];

  const totalGoods = roundAccounting(ACCOUNTING_BUCKETS.reduce((sum, bucket) => sum + goodsByBucket[bucket], 0));
  const totalCharges = roundAccounting((quote.carriageExVat ?? 0) + (quote.extraChargesExVat ?? 0));
  const chargesByBucket = emptyBucketTotals();

  if (totalCharges !== 0) {
    if (totalGoods > 0) {
      let allocated = 0;
      activeBuckets.forEach((bucket, index) => {
        const amount = index === activeBuckets.length - 1
          ? roundAccounting(totalCharges - allocated)
          : roundAccounting(totalCharges * (goodsByBucket[bucket] / totalGoods));
        chargesByBucket[bucket] = amount;
        allocated = roundAccounting(allocated + amount);
      });
    } else {
      chargesByBucket[activeBuckets[0]] = totalCharges;
    }
  }

  return ACCOUNTING_BUCKETS
    .map((bucket) => {
      const goodsExVat = roundAccounting(goodsByBucket[bucket]);
      const chargesExVat = roundAccounting(chargesByBucket[bucket]);
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
  const carriageExVat = roundAccounting(quote.carriageExVat ?? 0);
  const extraChargesExVat = roundAccounting(quote.extraChargesExVat ?? 0);
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
  const remaining = emptyBucketTotals();
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

function taxForNet(quote: QuoteRequest, net: number) {
  return quoteIncludesVat(quote) ? roundAccounting(net * VAT_RATE) : 0;
}

function taxCode(quote: QuoteRequest): "T1" | "T0" {
  return quoteIncludesVat(quote) ? "T1" : "T0";
}

function exportDate(value: string | null | undefined) {
  return value ? new Date(value) : new Date();
}

function invoiceRef(quote: QuoteRequest) {
  return quote.websiteInvoiceNumber || quote.id;
}

export function sageSaleRowsForQuote(quote: QuoteRequest): SageExportRow[] {
  const date = exportDate(quote.paidAt || quote.updatedAt);
  const details = accountingDetailsName(quote);
  const ref = invoiceRef(quote);
  const groups = quoteAccountingGroups(quote);
  const totalTax = taxForNet(quote, groups.reduce((sum, group) => sum + group.netExVat, 0));
  let allocatedTax = 0;

  return groups.map((group, index) => {
    const tax = index === groups.length - 1
      ? roundAccounting(totalTax - allocatedTax)
      : taxForNet(quote, group.netExVat);
    allocatedTax = roundAccounting(allocatedTax + tax);
    return {
      Type: "SI",
      Account: "WEB",
      Nominal: group.nominal,
      Dept: 0,
      Details: details,
      Date: date,
      Ref: ref,
      Net: roundAccounting(group.netExVat),
      Tax: tax,
      "T/C": taxCode(quote),
    };
  });
}

export function sageRefundRowsForQuote(quote: QuoteRequest, refunds = quoteRefunds(quote)): SageExportRow[] {
  const details = accountingDetailsName(quote);
  const ref = invoiceRef(quote);
  return refunds.flatMap((refund) =>
    refund.lines.map((line) => {
      const net = -positiveAmount(line.amountExVat);
      return {
        Type: "SI" as const,
        Account: "WEB" as const,
        Nominal: ACCOUNTING_NOMINALS[line.bucket],
        Dept: 0 as const,
        Details: details,
        Date: exportDate(refund.createdAt),
        Ref: ref,
        Net: roundAccounting(net),
        Tax: taxForNet(quote, net),
        "T/C": taxCode(quote),
      };
    })
  );
}
