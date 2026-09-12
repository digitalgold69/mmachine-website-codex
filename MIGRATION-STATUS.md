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

## Catalogue upload correction — 12 September 2026

Mini full and section PDFs now preserve original Excel print pages and drawings. The bundled original was re-exported from the currently uploaded Mini workbook, including current prices; products were not reset. The earlier generated-table override is ignored for Mini PDF delivery. Future original PDF overrides use catalogue-original.pdf keys.

Dashboard upload cards accept drag-and-drop and require explicit Mini Panels/Metals confirmation. Mini updates require the workbook and matching full 42-page PDF exported from Excel, in the existing page order. The API validates page count/drawing resources and workbook catalogue type before saving. Metals retains workbook-only upload with optional original PDF. Selecting files never publishes them; the owner must confirm and save.

Staff notification URLs use https://m-machine.co.uk. A valid session in the same browser is retained; a different browser or the old workers.dev session still requires login. Live contact enquiries currently go to hodltid@icloud.com, sent from orders@orders.m-machine.co.uk, with customer Reply-To. Recipient changes await the owner's intended address; no test mail was sent.
`nDeployed Worker version 66bf3c21-ab8a-4a2b-9185-eba605c18472. Build and tests passed. Live full Mini PDF SHA-256 matches the original export; section 120 was downloaded and visually checked for drawing and original table pages.

## Excel-only uploads and contact routing — 12 September 2026

This supersedes the paired-PDF upload workflow above. Both catalogue cards take one Excel workbook, via drop or browse, and a simple confirmation after Upload is clicked. No PDF selection or checkbox is required.

Mini uploads preserve original drawing pages and rebuild the two-column parts tables from workbook values, including drawing references, codes, descriptions and printed prices. Full PDFs contain a section page map so additional rows and pages cannot shift section downloads onto the wrong section. The website retains its existing zero-price-as-POA handling; the printed Mini PDF mirrors the workbook's zero/POA cells. Metals retains automatic Excel-to-PDF generation. Workbook/PDF generation completes before publishing the new override.

The Team Notifications selector now includes Contact form. Selected active team recipients replace the configured fallback, never receive a copy alongside it. Until any contact recipients are selected, the existing fallback remains active. Contact notification sender display name is M Machine Enquiry. Existing order routing is unchanged.

Migration 0013 widens the notification route constraint. All 11 existing preferences were backed up and preserved on the live database. No notification recipients were chosen on the owner's behalf and no test email was sent.
Deployed version 3e01ff5e-c1a5-4516-8384-dbd7c97735bb. Build and tests passed; final generated PDF checked against all 766 Mini rows with zero code/description/printed-price mismatches. Added-row pagination regression passed. Metals Excel parsed and generated a PDF successfully. Upload UI checked with one Excel file; no live catalogue replacement or enquiry email was submitted during verification.

## Upload consistency follow-up

Mini generated PDFs now use catalogueMoney for prices, matching website POA handling for blank/zero prices instead of retaining empty print cells. Regression tests cover replacement workbook rows, edits, missing prices, right-column insertion immediately after 21.14.24.00 in section 140 without adding a page, and overflow pagination. Upload drop labels now explicitly request the updated Mini/Metals catalogue Excel document.

Formatting limitation: the bundled pre-upload PDF is the original Excel export. Upload-generated Mini PDFs preserve drawing pages and rebuild tables in a consistent two-column template; Metals uses its existing generated table template. Neither generator reproduces every Excel print style, merged border or original typographic detail. Do not describe these as exact Excel exports or promise arbitrary workbook-layout changes are supported.
Deployed version 4c61b183-e706-47c3-8a4b-269a6da0b50f. Verified updated upload labels live and homepage HTTP 200. Section 140 added-row PDF was checked independently: two pages, correct row order, POA for missing prices.
