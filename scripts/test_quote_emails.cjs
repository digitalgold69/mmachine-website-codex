const assert = require("node:assert/strict");
const path = require("node:path");

process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
process.env.VAT_REGISTRATION_NUMBER = "GB123456789";
process.env.QUOTE_OWNER_EMAIL = "fallback@example.test";
process.env.QUOTE_CUSTOM_OWNER_EMAIL = "custom@example.test";
process.env.QUOTE_MINI_OWNER_EMAIL = "mini@example.test";
process.env.QUOTE_METALS_OWNER_EMAIL = "metals@example.test; metals-backup@example.test";
process.env.QUOTE_FEATURED_OWNER_EMAIL = "featured@example.test";
process.env.QUOTE_ENQUIRY_OWNER_EMAIL = "enquiries@example.test";
process.env.AWS_SES_REGION = "eu-west-2";
process.env.AWS_SES_ACCESS_KEY_ID = "AKIATEST";
process.env.AWS_SES_SECRET_ACCESS_KEY = "test-secret";
process.env.AWS_SES_FROM_EMAIL = "orders@orders.m-machine.co.uk";
process.env.AWS_SES_FROM_NAME = "orders@m-machine.co.uk";

const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.resolve(__dirname, ".."),
  },
  cache: false,
});

const {
  buildSesEmailInput,
  buildEmailSetupStatus,
  buildCustomerInvoiceEmail,
  buildOwnerEnquiryEmail,
  buildOwnerQuoteEmail,
  ownerEnquiryRecipients,
  ownerQuoteRecipients,
} = jiti("../lib/quote-email.ts");

const quote = {
  id: "Q-CF-TEST",
  submittedAt: "2026-07-27T12:00:00.000Z",
  updatedAt: "2026-07-27T12:00:00.000Z",
  status: "new",
  customer: {
    name: "Alice Buyer",
    email: "alice@example.test",
    phone: "01325 000000",
    company: "Alice Works",
    address: "1 Test Street\nDarlington",
    arrangeOwnDelivery: false,
    message: "Laser cut bracket with countersunk holes.",
  },
  items: [
    {
      key: "custom-Q-CF-TEST",
      catalogue: "custom",
      productId: "Q-CF-TEST",
      code: "CUSTOM",
      description: "Laser cut bracket",
      qty: 2,
      unit: "job",
      unitPriceExVat: 50,
      unitPriceIncVat: null,
      custom: {
        projectName: "Laser cut bracket",
        material: "Mild steel",
        thickness: "3 mm",
        services: ["Laser cutting", "Folding"],
        finish: "Deburred",
        quantity: "2",
        units: "parts",
        tolerance: "+/- 0.2 mm",
        deadline: "Next week",
        budget: "Under 150",
        drawingStatus: "cad",
        files: [
          {
            key: "quote-uploads/session-1/drawing 1.dxf",
            name: "drawing 1.dxf",
            size: 2048,
            type: "application/dxf",
            extension: "dxf",
            uploadedAt: "2026-07-27T12:00:00.000Z",
          },
        ],
      },
    },
  ],
  ownerNotes: "",
  customerMessage: "Please approve before fabrication.",
  carriageExVat: 12,
  extraChargesExVat: 3,
  quotedAt: null,
  invoiceSentAt: null,
  paidAt: null,
  customerEmailSentAt: null,
  ownerEmailSentAt: null,
};

assert.deepEqual(ownerQuoteRecipients(quote), ["custom@example.test"]);
assert.deepEqual(ownerQuoteRecipients({
  ...quote,
  items: [
    { ...quote.items[0], catalogue: "mini" },
    { ...quote.items[0], catalogue: "metals" },
    { ...quote.items[0], catalogue: "featured" },
  ],
}), ["mini@example.test", "metals@example.test", "metals-backup@example.test", "featured@example.test"]);
assert.deepEqual(ownerEnquiryRecipients(), ["enquiries@example.test"]);

const sesInput = buildSesEmailInput({
  to: ownerQuoteRecipients(quote),
  subject: "M-Machine test",
  html: "<p>Hello &amp; welcome</p>",
  replyTo: ownerQuoteRecipients(quote)[0],
});
assert.equal(sesInput.FromEmailAddress, "\"orders@m-machine.co.uk\" <orders@orders.m-machine.co.uk>");
assert.deepEqual(sesInput.Destination?.ToAddresses, ["custom@example.test"]);
assert.deepEqual(sesInput.ReplyToAddresses, ["custom@example.test"]);
assert.equal(sesInput.Content?.Simple?.Subject?.Charset, "UTF-8");
assert.match(sesInput.Content?.Simple?.Body?.Text?.Data || "", /Hello & welcome/);

const setup = buildEmailSetupStatus();
assert.equal(setup.configured, true);
assert.equal(setup.region, "eu-west-2");
assert.equal(setup.senderEmailAddress, "orders@orders.m-machine.co.uk");
assert.deepEqual(setup.recipients.custom, ["custom@example.test"]);
assert.deepEqual(setup.recipients.mini, ["mini@example.test"]);
assert.deepEqual(setup.recipients.metals, ["metals@example.test", "metals-backup@example.test"]);
assert.deepEqual(setup.recipients.featured, ["featured@example.test"]);
assert.deepEqual(setup.recipients.enquiry, ["enquiries@example.test"]);

const ownerHtml = buildOwnerQuoteEmail(quote);
assert.match(ownerHtml, /Alice Buyer/);
assert.match(ownerHtml, /alice@example\.test/);
assert.match(ownerHtml, /01325 000000/);
assert.match(ownerHtml, /Mild steel/);
assert.match(ownerHtml, /Laser cutting, Folding/);
assert.match(ownerHtml, /Included details/);
assert.match(ownerHtml, /Open this order in dashboard/);
assert.match(ownerHtml, /https:\/\/example\.test\/dashboard\/orders\?quote=Q-CF-TEST/);
assert.match(ownerHtml, /https:\/\/example\.test\/api\/quote-files\/quote-uploads\/session-1\/drawing%201\.dxf/);
assert.doesNotMatch(ownerHtml, /Each ex VAT/);

const enquiryHtml = buildOwnerEnquiryEmail({
  name: "Bob Enquirer",
  email: "bob@example.test",
  phone: "01325 111111",
  type: "Mini panels",
  message: "Do you still carry this panel?",
  product: "Mini rear panel",
  sku: "RP-120",
  category: "Classic Mini",
  pageUrl: "https://example.test/products/mini-rear-panel",
});
assert.match(enquiryHtml, /Bob Enquirer/);
assert.match(enquiryHtml, /Product enquiry/);
assert.match(enquiryHtml, /Mini rear panel/);
assert.match(enquiryHtml, /RP-120/);
assert.match(enquiryHtml, /https:\/\/example\.test\/products\/mini-rear-panel/);

const customerHtml = buildCustomerInvoiceEmail(quote);
assert.match(customerHtml, /Hello Alice Buyer/);
assert.match(customerHtml, /Order invoice/);
assert.match(customerHtml, /Items/);
assert.match(customerHtml, /Q-CF-TEST/);
assert.match(customerHtml, /Please approve before fabrication/);
assert.match(customerHtml, /Total inc VAT/);
assert.match(customerHtml, /GB123456789/);

const updatedCustomerHtml = buildCustomerInvoiceEmail({
  ...quote,
  status: "invoice_sent",
  invoiceSentAt: "2026-07-27T14:00:00.000Z",
  customerEmailSentAt: "2026-07-27T14:00:00.000Z",
});
assert.match(updatedCustomerHtml, /Updated invoice/);
assert.match(updatedCustomerHtml, /updated your invoice details/);

console.log("ok - quote and enquiry email templates include routed recipients, focused dashboard links, and clean invoice details");
