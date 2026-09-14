const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const ordersClient = fs.readFileSync(
  path.join(projectRoot, "app/dashboard/(protected)/orders/OrdersClient.tsx"),
  "utf8"
);
const globalsCss = fs.readFileSync(path.join(projectRoot, "app/globals.css"), "utf8");

assert.match(
  ordersClient,
  /createPortal/,
  "invoice print sheet must be portalled to document.body so print CSS can hide the dashboard shell"
);
assert.match(
  ordersClient,
  /document\.body\.classList\.add\("printing-invoice"\)/,
  "print button must enable invoice-only print mode before calling window.print"
);
assert.match(
  ordersClient,
  /className = "invoice-print-root"/,
  "invoice print portal must use the print root targeted by print CSS"
);
assert.match(
  globalsCss,
  /body\.printing-invoice > :not\(\.invoice-print-root\)\s*\{\s*display: none !important;/,
  "invoice print CSS must remove the dashboard from print layout, not merely hide it"
);
assert.match(
  globalsCss,
  /body\.printing-invoice \.invoice-print-sheet[\s\S]*position: static !important;/,
  "invoice print sheet must stay in normal print flow so long invoices continue onto later pages"
);
assert.doesNotMatch(
  globalsCss,
  /body \*\s*\{\s*visibility: hidden !important;/,
  "dashboard print CSS must not leave hidden dashboard content consuming extra printed pages"
);
assert.match(
  ordersClient,
  /<div className="invoice-print-summary-row mb-4 grid grid-cols-3 gap-2">[\s\S]+Invoice state[\s\S]+Customer[\s\S]+Delivery/,
  "invoice print summary should keep state, customer and delivery in one compact row"
);
assert.match(
  ordersClient,
  /invoice-print-state-grid[\s\S]+grid grid-cols-\[minmax\(0,1fr\)_auto\][\s\S]+justify-self-end text-right/,
  "invoice print state card should right-align status and paid-by/payment values"
);
assert.match(
  ordersClient,
  /<dd className="mt-0\.5 whitespace-nowrap font-semibold text-racing">\{left\.value\}<\/dd>/,
  "invoice print reference and paid/submitted values should not be truncated"
);
assert.match(
  globalsCss,
  /body\.printing-invoice \.invoice-print-summary-row[\s\S]*grid-template-columns: minmax\(0, 0\.95fr\) minmax\(0, 1\.05fr\) minmax\(0, 1\.15fr\) !important;/,
  "invoice print CSS must force the summary cards into one row during print preview"
);
assert.match(
  globalsCss,
  /body\.printing-invoice \.invoice-print-summary-card[\s\S]*overflow-wrap: anywhere !important;/,
  "invoice print summary cards must wrap long emails and addresses instead of overlapping"
);
assert.match(
  ordersClient,
  /src="\/brand\/m-machine-butterfly\.png"/,
  "invoice print header should include the M Machine butterfly logo"
);

console.log("ok - dashboard invoice print mode prints one flowing invoice document");
