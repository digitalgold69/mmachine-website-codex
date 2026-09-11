# Domain migration, 11 September 2026

Production: https://m-machine.co.uk (Cloudflare Worker).

## Preview WordPress site

The old IONOS origin at 217.160.0.98 was queried read-only using the original preview.m-machine.co.uk Host header. WordPress REST API pagination headers reported 4 published pages, 0 published posts and 22 media entries, all on one page each. This is the published inventory at audit time; it does not prove every historic URL or external backlink is known.

- Existing Cloudflare rule redirects preview.m-machine.co.uk to the same path on m-machine.co.uk.
- config/legacy-preview-redirects.json adds 62 permanent (301) path mappings for changed page addresses, attachment pages, historic PDF URLs and image sizes.
- Old catalogue page and PDF URLs lead to /catalogue/mini-catalogue.pdf, the current catalogue endpoint.
- 21 original images are preserved under public/wp-content/uploads. Thumbnail URLs redirect to their original image.
- Changed preview URLs currently take two permanent redirect hops: hostname change followed by path mapping. Future Cloudflare rule consolidation can make these one hop; do not remove the application mappings because existing links can also use the main hostname.
- Unknown URLs remain genuine 404s rather than being redirected indiscriminately to the homepage.
- After deployment, 86 live HTTP checks passed: all mapped URLs, the homepage, original images, a trailing-slash URL and a query-string URL reached their expected destinations with HTTP 200 through permanent redirects. Worker version: 4a7b8e20-ff7f-402b-a52a-5ead110f648c.

## Metals site

DNS and hosting remain at IONOS. Host-scoped .htaccess mappings redirect the known homepage, catalogue pages, catalogue PDFs, enquiries and articles to their new equivalents. The old weight calculator and links page were deliberately retired; both returned 410 on 11 September.

User confirmed Search Console Change of Address accepted ("this site is currently moving") and new sitemap status Success. The unused metals Cloudflare zone is not authoritative. Preserve the old domain, hosting and HTTPS to keep redirects operating.

## Workers development hostname and authentication

next.config.js redirects mmachine-website-codex.muddy-silence-4f5b.workers.dev to production. An explicit root rule avoids OpenNext emitting the literal :path* placeholder for an empty path.

Staff accounts remain in the same D1 database. Session cookies are HttpOnly, Secure in production, SameSite=Lax and host-only. A normal cross-domain redirect cannot transfer the workers.dev login cookie. No authentication bridge was introduced: existing staff sign in once using their existing credentials at the production domain. Do not put existing session tokens into redirect URLs or broaden cookie scope.

## Remaining verification limits

Search Console historic URL/backlink exports may identify URLs absent from the current WordPress published inventory. GA4 Realtime receipt, Business Profile URL update and end-to-end mailbox/website-email delivery require account-side confirmation; do not infer these from DNS checks alone.
