# Website analytics

GA4 web stream: `G-SXX6XDKX7N`, for `https://m-machine.co.uk`.

The owner confirmed Enhanced measurement is OFF on 11 September 2026. Keep it off:
the app sends page views on client navigation itself, excluding query strings and
using only the origin of an external referrer. Enabling automatic history or form
measurement would cause duplicate events or unwanted data collection.

`components/AnalyticsConsent.tsx` mounts only in the public site layout. The Google
tag loads only after analytics consent and only on `m-machine.co.uk`. Advertising
consent stays denied. The footer's Cookie settings button reopens the choices.
Rejecting after acceptance disables collection, clears GA cookies and reloads the
page to unload the tag. This does not delete previously collected data.

Consent choices expire after 180 days. Analytics cookies are configured for 180
days with Google's default renewal behaviour. Storage failures leave the site
usable and do not silently grant consent on the next visit.

Validation: `npm run test:analytics`, then `npm test` and a production build.
For a live check, accept analytics on the public site and check GA4 Realtime.
Google's automatic installation check may not load a tag behind a consent choice.

No order, invoice, form-field or customer data events are implemented. Page views
are the initial measurement scope; order requests are not purchases or revenue.

The launch domain is stored in Wrangler configuration and server URL fallbacks.
Deploy with the existing `npm run cf:deploy` script, which preserves runtime
variables and secrets. Existing Cloudflare zone redirect rules and mail DNS are
managed separately from this Worker deployment.
