const assert = require("node:assert/strict");
const path = require("node:path");

const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.resolve(__dirname, ".."),
  },
  cache: false,
});

const {
  normaliseQuoteDelivery,
  quoteCustomerWillArrangeDelivery,
  quoteDeliveryAddress,
} = jiti("../lib/quote-delivery.ts");

assert.deepEqual(
  normaliseQuoteDelivery({
    deliveryMode: "delivery",
    arrangeOwnDelivery: true,
    address: "65 Stanhope Road North\nDarlington\nDL3 7AP",
  }),
  {
    address: "65 Stanhope Road North\nDarlington\nDL3 7AP",
    arrangeOwnDelivery: false,
  }
);

assert.deepEqual(
  normaliseQuoteDelivery({
    deliveryMode: "collection",
    arrangeOwnDelivery: false,
    address: "65 Stanhope Road North\nDarlington\nDL3 7AP",
  }),
  {
    address: "",
    arrangeOwnDelivery: true,
  }
);

assert.deepEqual(
  normaliseQuoteDelivery({
    arrangeOwnDelivery: true,
    address: "65 Stanhope Road North",
  }),
  {
    address: "65 Stanhope Road North",
    arrangeOwnDelivery: false,
  }
);

assert.deepEqual(
  normaliseQuoteDelivery({
    arrangeOwnDelivery: "on",
    address: "",
  }),
  {
    address: "",
    arrangeOwnDelivery: true,
  }
);

assert.equal(
  quoteCustomerWillArrangeDelivery({
    arrangeOwnDelivery: true,
    address: "65 Stanhope Road North",
  }),
  false
);
assert.equal(quoteDeliveryAddress({ address: "  65 Stanhope Road North  " }), "65 Stanhope Road North");

console.log("ok - quote delivery choices prefer explicit mode and never hide a supplied address");
