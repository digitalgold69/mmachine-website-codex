const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const wranglerPath = path.resolve(__dirname, "..", "wrangler.jsonc");
const config = JSON.parse(fs.readFileSync(wranglerPath, "utf8"));

assert.equal(config.keep_vars, true, "wrangler.jsonc must keep dashboard-managed Cloudflare variables");

const dashboardManagedRecipients = [
  "QUOTE_OWNER_EMAIL",
  "QUOTE_CUSTOM_OWNER_EMAIL",
  "QUOTE_MINI_OWNER_EMAIL",
  "QUOTE_METALS_OWNER_EMAIL",
  "QUOTE_FEATURED_OWNER_EMAIL",
  "QUOTE_ENQUIRY_OWNER_EMAIL",
];

const configuredVars = config.vars || {};
const overwrittenRecipients = dashboardManagedRecipients.filter((name) =>
  Object.prototype.hasOwnProperty.call(configuredVars, name)
);

assert.deepEqual(
  overwrittenRecipients,
  [],
  `Do not define ${overwrittenRecipients.join(", ")} in wrangler.jsonc; edit these in Cloudflare Variables and Secrets instead`
);

console.log("ok - wrangler config preserves dashboard-managed recipient variables");
