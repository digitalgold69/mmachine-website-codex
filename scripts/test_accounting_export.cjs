const assert = require("node:assert/strict");
const path = require("node:path");

const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.resolve(__dirname, ".."),
  },
  cache: false,
});

const {
  ACCOUNTING_NOMINALS,
  quoteTotals,
  remainingRefundByBucket,
  roundAccounting,
  sageRefundRowsForQuote,
  sageSaleRowsForQuote,
  requiredWebsiteInvoiceCount,
  websiteInvoiceDisplay,
} = jiti("../lib/order-accounting.ts");

const quote = {
  id: "Q-MIXED-TEST",
  websiteInvoiceNumber: "W1234",
  submittedAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-02T10:00:00.000Z",
  paidAt: "2026-08-02T10:00:00.000Z",
  status: "paid",
  includeVat: true,
  paymentMethod: "bacs",
  customer: {
    name: "Alice Buyer",
    email: "alice@example.test",
    phone: "01325 000000",
    company: "Alice Works",
  },
  items: [
    {
      key: "mini-a",
      catalogue: "mini",
      productId: "mini-a",
      code: "14A1234",
      description: "Front floor panel",
      qty: 2,
      unit: "each",
      unitPriceExVat: 100,
      unitPriceIncVat: 120,
    },
    {
      key: "metal-a",
      catalogue: "metals",
      productId: "metal-a",
      code: "MS-SHEET",
      description: "Mild steel sheet",
      shape: "Sheet",
      metal: "Mild steel",
      spec: "CR4",
      size: "1.2 mm",
      qty: 3,
      unit: "sheet",
      unitPriceExVat: 50,
      unitPriceIncVat: 60,
    },
    {
      key: "featured-a",
      catalogue: "featured",
      productId: "featured-a",
      code: "FW-1",
      description: "Machined bracket",
      qty: 1,
      unit: "each",
      unitPriceExVat: 200,
      unitPriceIncVat: 240,
    },
  ],
  carriageExVat: 70,
  extraChargesExVat: 30,
  refunds: [],
};

const saleRows = sageSaleRowsForQuote(quote);
assert.equal(saleRows.length, 4);
assert.equal(ACCOUNTING_NOMINALS.featured, 4010);
assert.deepEqual(saleRows.map((row) => row.Nominal).sort(), [
  ACCOUNTING_NOMINALS.carriage,
  ACCOUNTING_NOMINALS.featured,
  ACCOUNTING_NOMINALS.metals,
  ACCOUNTING_NOMINALS.mini,
].sort());
assert.equal(saleRows.every((row) => row.Type === "SI" && row.Account === "WEB" && row.Dept === 0), true);
assert.equal(saleRows.every((row) => row.Details === "Alice Works"), true);
assert.equal(saleRows.every((row) => row["Payment Method"] === "BACS"), true);
assert.deepEqual(
  saleRows.map((row) => [row.Nominal, row.Ref]),
  [
    [ACCOUNTING_NOMINALS.mini, "W1234"],
    [ACCOUNTING_NOMINALS.metals, "W1235"],
    [ACCOUNTING_NOMINALS.featured, "W1236"],
    [ACCOUNTING_NOMINALS.carriage, "W1237"],
  ]
);
assert.equal(new Set(saleRows.map((row) => row.Ref)).size, saleRows.length);
assert.equal(requiredWebsiteInvoiceCount(quote), 4);
assert.equal(websiteInvoiceDisplay(quote), "W1234-W1237");
assert.equal(saleRows.find((row) => row.Nominal === ACCOUNTING_NOMINALS.metals).Net, 180);
assert.equal(roundAccounting(saleRows.reduce((sum, row) => sum + row.Net, 0)), 650);
assert.equal(roundAccounting(saleRows.reduce((sum, row) => sum + row.Tax, 0)), 130);
assert.equal(saleRows.every((row) => row["T/C"] === "T1"), true);

const noVatRows = sageSaleRowsForQuote({ ...quote, includeVat: false, websiteInvoiceNumber: "W1235" });
assert.equal(noVatRows.every((row) => row["T/C"] === "T0"), true);
assert.equal(noVatRows.every((row) => row.Tax === 0), true);
assert.equal(quoteTotals({ ...quote, includeVat: false }).totalIncVat, 650);
assert.equal(sageSaleRowsForQuote({ ...quote, paymentMethod: null })[0]["Payment Method"], "Card");

const refundedQuote = {
  ...quote,
  refunds: [
    {
      id: "refund-1",
      createdAt: "2026-08-05T12:00:00.000Z",
      reason: "Partial return",
      websiteInvoiceNumber: "W2000",
      websiteInvoiceCount: 2,
      lines: [
        { bucket: "mini", amountExVat: 50 },
        { bucket: "metals", amountExVat: 10 },
      ],
    },
  ],
};
const refundRows = sageRefundRowsForQuote(refundedQuote);
assert.equal(refundRows.length, 2);
assert.deepEqual(refundRows.map((row) => row.Ref), ["W2000", "W2001"]);
assert.equal(new Set(refundRows.map((row) => row.Ref)).size, refundRows.length);
assert.equal(refundRows.some((row) => saleRows.some((saleRow) => saleRow.Ref === row.Ref)), false);
assert.deepEqual(refundRows.map((row) => row.Net).sort((a, b) => a - b), [-50, -10]);
assert.equal(refundRows.every((row) => row["Payment Method"] === "BACS"), true);
assert.equal(roundAccounting(refundRows.reduce((sum, row) => sum + row.Tax, 0)), -12);
assert.equal(quoteTotals(refundedQuote).totalExVat, 590);
assert.equal(quoteTotals(refundedQuote).totalIncVat, 708);
assert.equal(remainingRefundByBucket(refundedQuote).mini, roundAccounting(saleRows.find((row) => row.Nominal === 4000).Net - 50));

console.log("ok - accounting export helpers split website orders, VAT, and refunds for Sage");
