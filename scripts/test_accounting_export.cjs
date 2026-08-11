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
} = jiti("../lib/order-accounting.ts");

const quote = {
  id: "Q-MIXED-TEST",
  websiteInvoiceNumber: "W1234",
  submittedAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-02T10:00:00.000Z",
  paidAt: "2026-08-02T10:00:00.000Z",
  status: "paid",
  includeVat: true,
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
assert.equal(saleRows.length, 3);
assert.deepEqual(saleRows.map((row) => row.Nominal).sort(), [
  ACCOUNTING_NOMINALS.engineering,
  ACCOUNTING_NOMINALS.metals,
  ACCOUNTING_NOMINALS.mini,
].sort());
assert.equal(saleRows.every((row) => row.Type === "SI" && row.Account === "WEB" && row.Dept === 0), true);
assert.equal(saleRows.every((row) => row.Ref === "W1234" && row.Details === "Alice Works"), true);
assert.equal(roundAccounting(saleRows.reduce((sum, row) => sum + row.Net, 0)), 650);
assert.equal(roundAccounting(saleRows.reduce((sum, row) => sum + row.Tax, 0)), 130);
assert.equal(saleRows.every((row) => row["T/C"] === "T1"), true);

const noVatRows = sageSaleRowsForQuote({ ...quote, includeVat: false, websiteInvoiceNumber: "W1235" });
assert.equal(noVatRows.every((row) => row["T/C"] === "T0"), true);
assert.equal(noVatRows.every((row) => row.Tax === 0), true);
assert.equal(quoteTotals({ ...quote, includeVat: false }).totalIncVat, 650);

const refundedQuote = {
  ...quote,
  refunds: [
    {
      id: "refund-1",
      createdAt: "2026-08-05T12:00:00.000Z",
      reason: "Partial return",
      lines: [
        { bucket: "mini", amountExVat: 50 },
        { bucket: "metals", amountExVat: 10 },
      ],
    },
  ],
};
const refundRows = sageRefundRowsForQuote(refundedQuote);
assert.equal(refundRows.length, 2);
assert.deepEqual(refundRows.map((row) => row.Net).sort((a, b) => a - b), [-50, -10]);
assert.equal(roundAccounting(refundRows.reduce((sum, row) => sum + row.Tax, 0)), -12);
assert.equal(quoteTotals(refundedQuote).totalExVat, 590);
assert.equal(quoteTotals(refundedQuote).totalIncVat, 708);
assert.equal(remainingRefundByBucket(refundedQuote).mini, roundAccounting(saleRows.find((row) => row.Nominal === 4000).Net - 50));

console.log("ok - accounting export helpers split website orders, VAT, and refunds for Sage");
