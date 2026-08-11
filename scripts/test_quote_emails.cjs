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
process.env.AWS_SES_FROM_NAME = "New M Machine Order";

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
  CUSTOMER_INVOICE_FROM_NAME,
  buildOwnerEnquiryEmail,
  buildOwnerQuoteEmail,
  ownerNotificationFromName,
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

const miniQuote = {
  ...quote,
  id: "Q-MINI-TEST",
  customer: {
    ...quote.customer,
    vehicleYear: "1967",
    vehicleModel: "Traveller",
  },
  items: [
    {
      key: "mini-floor-panel",
      catalogue: "mini",
      productId: "floor-panel",
      code: "14A1234",
      description: "Front floor panel",
      qty: 3,
      unit: "each",
      unitPriceExVat: 25,
      unitPriceIncVat: 30,
    },
  ],
};

const singleMiniQuote = {
  ...miniQuote,
  id: "Q-MINI-SINGLE",
  customer: {
    ...miniQuote.customer,
    address: "",
    arrangeOwnDelivery: true,
  },
  items: [
    {
      ...miniQuote.items[0],
      qty: 1,
    },
  ],
};

const addressWithCollectionFlagQuote = {
  ...quote,
  id: "Q-DELIVERY-SAFETY",
  customer: {
    ...quote.customer,
    address: "65 Stanhope Road North\nDarlington\nDL3 7AP",
    arrangeOwnDelivery: true,
  },
};

const metalsQuote = {
  ...quote,
  id: "Q-METALS-TEST",
  items: [
    {
      key: "metals-sheet",
      catalogue: "metals",
      productId: "sheet",
      code: "MS-SHEET",
      description: "Mild steel sheet",
      shape: "Sheet",
      metal: "Mild steel",
      spec: "CR4",
      size: "1.2 mm",
      qty: 1,
      unit: "sheet",
      unitPriceExVat: 12,
      unitPriceIncVat: 14.4,
    },
  ],
};

const featuredQuote = {
  ...quote,
  id: "Q-FW-TEST",
  items: [
    {
      key: "featured-shell",
      catalogue: "featured",
      productId: "shell",
      code: "FW-SHELL",
      description: "Restored Mini shell",
      qty: 1,
      unit: "each",
      unitPriceExVat: 5000,
      unitPriceIncVat: 6000,
    },
  ],
};

assert.deepEqual(ownerQuoteRecipients(quote), ["custom@example.test"]);
assert.deepEqual(ownerQuoteRecipients({
  ...quote,
  items: [
    { ...quote.items[0], catalogue: "mini" },
    { ...quote.items[0], catalogue: "metals" },
    { ...quote.items[0], catalogue: "featured" },
  ],
}), ["mini@example.test"]);
assert.deepEqual(ownerEnquiryRecipients(), ["enquiries@example.test"]);

const sesInput = buildSesEmailInput({
  to: ownerQuoteRecipients(quote),
  subject: "M-Machine test",
  html: "<p>Hello &amp; welcome</p>",
  replyTo: ownerQuoteRecipients(quote)[0],
  fromName: ownerNotificationFromName(quote),
});
assert.equal(sesInput.FromEmailAddress, "\"New Custom Work Order\" <orders@orders.m-machine.co.uk>");
assert.deepEqual(sesInput.Destination?.ToAddresses, ["custom@example.test"]);
assert.deepEqual(sesInput.ReplyToAddresses, ["custom@example.test"]);
assert.equal(sesInput.Content?.Simple?.Subject?.Charset, "UTF-8");
assert.match(sesInput.Content?.Simple?.Body?.Text?.Data || "", /Hello & welcome/);

const customerSesInput = buildSesEmailInput({
  to: quote.customer.email,
  subject: "M-Machine invoice",
  html: "<p>Invoice</p>",
  fromName: CUSTOMER_INVOICE_FROM_NAME,
});
assert.equal(customerSesInput.FromEmailAddress, "\"Your M Machine Order\" <orders@orders.m-machine.co.uk>");

const configuredFullFromInput = buildSesEmailInput(
  {
    to: quote.customer.email,
    subject: "M-Machine test",
    html: "<p>Hello</p>",
    fromName: "New Metals Order",
  },
  {
    AWS_SES_FROM_EMAIL: "\"Legacy Name\" <orders@orders.m-machine.co.uk>",
    AWS_SES_FROM_NAME: "Legacy Name",
  }
);
assert.equal(configuredFullFromInput.FromEmailAddress, "\"New Metals Order\" <orders@orders.m-machine.co.uk>");

assert.equal(ownerNotificationFromName(quote), "New Custom Work Order");
assert.equal(ownerNotificationFromName(miniQuote), "New Mini Panel Order");
assert.equal(ownerNotificationFromName(metalsQuote), "New Metals Order");
assert.equal(ownerNotificationFromName(featuredQuote), "New Featured Order");
assert.equal(
  ownerNotificationFromName({
    ...quote,
    items: [miniQuote.items[0], metalsQuote.items[0]],
  }),
  "New Mixed Order"
);

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
assert.doesNotMatch(ownerHtml, /<img\b/i);
assert.doesNotMatch(ownerHtml, /<link\b/i);
assert.doesNotMatch(ownerHtml, /<style\b/i);
assert.match(ownerHtml, /Alice Buyer/);
assert.match(ownerHtml, /alice@example\.test/);
assert.match(ownerHtml, /01325 000000/);
assert.match(ownerHtml, /Uploaded files/);
assert.doesNotMatch(ownerHtml, /Included details/);
assert.doesNotMatch(ownerHtml, /Qty 2\s*\/\s*Ref Custom\s*\/\s*Unit job/);
assert.doesNotMatch(ownerHtml, /Uploaded files:/);
assert.match(ownerHtml, /Open this order in dashboard/);
assert.match(ownerHtml, /https:\/\/example\.test\/dashboard\/orders\?quote=Q-CF-TEST/);
assert.match(ownerHtml, /https:\/\/example\.test\/api\/quote-files\/quote-uploads\/session-1\/drawing%201\.dxf/);
assert.doesNotMatch(ownerHtml, /Each ex VAT/);

const safeOwnerDeliveryHtml = buildOwnerQuoteEmail(addressWithCollectionFlagQuote);
assert.match(safeOwnerDeliveryHtml, /65 Stanhope Road North/);
assert.doesNotMatch(safeOwnerDeliveryHtml, /Customer will arrange delivery or collection/);

const miniOwnerHtml = buildOwnerQuoteEmail(miniQuote);
assert.match(miniOwnerHtml, /Mini panels/);
assert.match(miniOwnerHtml, /Vehicle details/);
assert.match(miniOwnerHtml, /Vehicle year:<\/strong> 1967/);
assert.match(miniOwnerHtml, /Model:<\/strong> Traveller/);
assert.match(miniOwnerHtml, /Items Requested/);
assert.match(miniOwnerHtml, /Front floor panel/);
assert.match(miniOwnerHtml, /\u00a375\.00/);
assert.doesNotMatch(miniOwnerHtml, /Unit each/);
assert.doesNotMatch(miniOwnerHtml, /Mini parts/);

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
assert.doesNotMatch(customerHtml, /<img\b/i);
assert.doesNotMatch(customerHtml, /<link\b/i);
assert.doesNotMatch(customerHtml, /<style\b/i);
assert.match(customerHtml, /Hello Alice Buyer/);
assert.match(customerHtml, /Order invoice/);
assert.match(customerHtml, /See your order summary below\./);
assert.doesNotMatch(customerHtml, /We have reviewed it and added any carriage or extra charges below/);
assert.match(customerHtml, /Your Delivery Address/);
assert.match(customerHtml, /1 Test Street<br>Darlington/);
assert.match(customerHtml, /Items/);
assert.match(customerHtml, /Q-CF-TEST/);
assert.match(customerHtml, /Custom Job/);
assert.match(customerHtml, /Price each ex VAT/);
assert.match(customerHtml, /Price ex VAT/);
assert.doesNotMatch(customerHtml, />Each ex VAT</);
assert.doesNotMatch(customerHtml, /Line ex VAT/);
assert.doesNotMatch(customerHtml, /Drawing status/);
assert.match(customerHtml, /Please approve before fabrication/);
assert.match(customerHtml, /Total inc VAT/);
assert.match(customerHtml, /GB123456789/);

const singleMiniCustomerHtml = buildCustomerInvoiceEmail(singleMiniQuote);
assert.match(singleMiniCustomerHtml, /Collection/);
assert.match(
  singleMiniCustomerHtml,
  /You selected collection\. Please contact us if you&#039;d prefer us to arrange delivery|You selected collection\. Please contact us if you'd prefer us to arrange delivery/
);
assert.match(singleMiniCustomerHtml, /14A1234/);
assert.doesNotMatch(singleMiniCustomerHtml, /14A1234\s*\/\s*each/);
assert.match(singleMiniCustomerHtml, /Price ex VAT/);
assert.doesNotMatch(singleMiniCustomerHtml, /Price each ex VAT/);
assert.doesNotMatch(singleMiniCustomerHtml, /Line ex VAT/);

const safeCustomerDeliveryHtml = buildCustomerInvoiceEmail(addressWithCollectionFlagQuote);
assert.match(safeCustomerDeliveryHtml, /Your Delivery Address/);
assert.match(safeCustomerDeliveryHtml, /65 Stanhope Road North<br>Darlington<br>DL3 7AP/);
assert.doesNotMatch(safeCustomerDeliveryHtml, /You selected collection/);

const noVatCustomerHtml = buildCustomerInvoiceEmail({
  ...singleMiniQuote,
  includeVat: false,
  websiteInvoiceNumber: "W1234",
});
assert.match(noVatCustomerHtml, /Invoice W1234/);
assert.match(noVatCustomerHtml, /Reference[\s\S]*W1234/);
assert.match(noVatCustomerHtml, />Price</);
assert.doesNotMatch(noVatCustomerHtml, /Price ex VAT/);
assert.match(noVatCustomerHtml, /VAT[\s\S]*Not applied/);
assert.match(noVatCustomerHtml, />Total</);
assert.doesNotMatch(noVatCustomerHtml, /Total inc VAT/);

const updatedCustomerHtml = buildCustomerInvoiceEmail({
  ...quote,
  status: "invoice_sent",
  invoiceSentAt: "2026-07-27T14:00:00.000Z",
  customerEmailSentAt: "2026-07-27T14:00:00.000Z",
});
assert.match(updatedCustomerHtml, /Updated invoice/);
assert.match(updatedCustomerHtml, /updated your invoice details/);

console.log("ok - quote and enquiry email templates include routed recipients, focused dashboard links, and clean invoice details");
