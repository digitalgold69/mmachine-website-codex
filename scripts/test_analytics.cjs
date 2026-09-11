const assert = require("node:assert/strict");
const path = require("node:path");
const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..") }, cache: false });
const analytics = jiti("../lib/analytics-client.ts");
const saved = new Map();
global.localStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
const scripts = [];
const deletions = [];
global.window = { location: { hostname: "m-machine.co.uk" } };
global.document = {
  title: "Contact | M-Machine",
  referrer: "https://www.google.com/search?q=private@example.test",
  createElement: () => ({}),
  head: { appendChild: script => scripts.push(script) },
  get cookie() { return "_ga=abc; _ga_SXX6XDKX7N=def; mmachine_session=keep; basket=keep"; },
  set cookie(value) { deletions.push(value); },
};

assert.equal(analytics.readAnalyticsConsent(), null);
analytics.trackPage("/contact", false);
assert.equal(scripts.length, 0, "No Google tag before consent");
analytics.saveAnalyticsConsent("rejected");
assert.equal(analytics.readAnalyticsConsent(), "rejected");
analytics.trackPage("/contact", false);
assert.equal(scripts.length, 0, "No Google tag after rejection");
saved.set(analytics.CONSENT_KEY, JSON.stringify({ choice: "accepted", at: Date.now() - 181 * 86400000 }));
assert.equal(analytics.readAnalyticsConsent(), null, "Expired consent must be requested again");
saved.set(analytics.CONSENT_KEY, "broken");
assert.equal(analytics.readAnalyticsConsent(), null);
analytics.saveAnalyticsConsent("accepted");
assert.equal(analytics.readAnalyticsConsent(), "accepted");
analytics.trackPage("/dashboard/orders", true);
assert.equal(scripts.length, 0, "Private dashboard must not load Google");
window.location.hostname = "mmachine-website-codex.muddy-silence-4f5b.workers.dev";
analytics.trackPage("/contact", true);
assert.equal(scripts.length, 0, "Preview host must not load Google");
window.location.hostname = "m-machine.co.uk";
analytics.trackPage("/contact", true);
assert.equal(scripts.length, 1);
assert.equal(scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-SXX6XDKX7N");
assert.equal(scripts[0].referrerPolicy, "no-referrer");
const events = () => window.dataLayer.map(args => Array.from(args));
assert.equal(events()[0][0], "consent");
assert.equal(events()[0][2].analytics_storage, "denied");
assert.equal(events()[0][2].ad_user_data, "denied");
assert.equal(events()[1][2].analytics_storage, "granted");
const config = events().find(event => event[0] === "config")[2];
assert.equal(config.send_page_view, false);
assert.equal(config.allow_google_signals, false);
assert.equal(config.page_referrer, "https://www.google.com");
assert.equal(analytics.referringOrigin("not a URL"), "");
assert.equal(analytics.referringOrigin("file:///private"), "");
analytics.trackPage("/contact", true);
assert.equal(events().filter(event => event[0] === "event").length, 1, "Repeated effect must not duplicate page view");
document.title = "Search for private@example.test";
analytics.trackPage("/search", true);
const search = events().filter(event => event[0] === "event").at(-1)[2];
assert.equal(search.page_location, "https://m-machine.co.uk/search");
assert.equal(search.page_title, "Search | M-Machine");
assert.ok(!JSON.stringify(events()).includes("private@example.test"));
analytics.stopAnalytics();
assert.equal(window["ga-disable-G-SXX6XDKX7N"], true);
analytics.clearAnalyticsCookies();
assert.equal(deletions.length, 6);
assert.ok(deletions.every(value => value.startsWith("_ga=") || value.startsWith("_ga_")));
assert.ok(deletions.every(value => value.includes("Max-Age=0")));
global.localStorage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
assert.equal(analytics.readAnalyticsConsent(), null);
assert.doesNotThrow(() => analytics.saveAnalyticsConsent("accepted"));
console.log("ok - analytics consent, private route exclusion, page views, withdrawal and storage failures");
