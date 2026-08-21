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

console.log("ok - dashboard invoice print mode prints one flowing invoice document");
