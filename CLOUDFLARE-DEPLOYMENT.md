# Cloudflare Deployment

This site is a full Next.js app, not a static-only site. It uses API routes for:

- dashboard team authentication
- quote/order requests
- dashboard updates
- featured-work updates
- email sending

Runtime content is stored in Cloudflare:

- quote/order requests: D1 database binding `DB`
- featured-work rows: D1 database binding `DB`
- featured-work images: R2 bucket binding `FEATURED_IMAGES`

Deploy it to Cloudflare Workers using the OpenNext adapter.

## Placeholder URL

Cloudflare Workers provides a temporary URL on the `workers.dev` domain after deployment, for example:

```text
https://mmachine-website-codex.<your-account>.workers.dev
```

Use that while the client reviews the working version. Later, attach the live domain in Cloudflare.

## Local Test

```powershell
npm run cf:preview
```

This builds the app and runs it locally in the Cloudflare Workers runtime.

## Manual Deploy

```powershell
npx wrangler login
npm run cf:deploy
```

`npm run cf:deploy` passes `--keep-vars` through to Wrangler, and
`wrangler.jsonc` also sets `keep_vars: true`, so runtime variables and secrets
set in the Cloudflare dashboard are preserved.

## Environment Variables

Copy the environment variables from the current deployment host into Cloudflare Workers.

Required:

```text
NEXT_PUBLIC_SITE_URL
AUTH_SECRET
QUOTE_UPLOAD_SECRET             optional; AUTH_SECRET is used if omitted
```

Dashboard access is managed from the dashboard Team tab. The first
administrator is seeded as `hodltid@icloud.com` and must change the temporary
password on first sign-in. Do not configure the old `OWNER_PASSWORD`; it is no
longer used for dashboard authentication.

Required when email sending goes live:

```text
AWS_SES_REGION                 region where the SES identity is verified
AWS_SES_ACCESS_KEY_ID          IAM access key with ses:SendEmail
AWS_SES_SECRET_ACCESS_KEY      IAM secret key with ses:SendEmail
AWS_SES_FROM_EMAIL             orders@orders.m-machine.co.uk
AWS_SES_FROM_NAME              New M Machine Order
QUOTE_OWNER_EMAIL              fallback/general owner notification address
QUOTE_CUSTOM_OWNER_EMAIL       custom-work request notifications
QUOTE_MINI_OWNER_EMAIL         mini panel order notifications
QUOTE_METALS_OWNER_EMAIL       metals order notifications
QUOTE_FEATURED_OWNER_EMAIL     featured-work order notifications
QUOTE_ENQUIRY_OWNER_EMAIL      optional website enquiry notifications
```

Use comma or semicolon separators if an order type should notify more than one
address.

Email is sent through Amazon SES API v2. Staff order notifications set a
message-specific display name such as `New Mini Panel Order`; customer invoice
emails use `Your M Machine Order`. SES authenticates the address inside the
angle brackets, so `AWS_SES_FROM_EMAIL` must be an address under a verified SES
identity in the configured region.

Manage the SES settings and recipient-routing addresses in Cloudflare Workers
Settings -> Variables and Secrets. Do not put the `QUOTE_*_EMAIL` recipient
values in `wrangler.jsonc`; values in `wrangler.jsonc` are deploy-time values
and can overwrite edits made in Cloudflare. If Cloudflare prompts you to update
the Wrangler config file to keep local development in sync, do not copy
recipient email values into `wrangler.jsonc` for this project.

`AWS_SES_REGION` must match the AWS Region where the SES identity appears under
Verified identities. Use `eu-north-1` only if the identity is in Europe
(Stockholm).

`NEXT_PUBLIC_SITE_URL` should be the Cloudflare placeholder URL during testing. Change it to the real domain once the final domain is connected.

After signing in to the owner dashboard, open `/api/email-health` to check the
sanitized SES configuration. Send a controlled authenticated POST to the same
endpoint with:

```powershell
Invoke-WebRequest -Method Post -Uri "https://<site>/api/email-health" -ContentType "application/json" -Body '{"route":"custom"}' -WebSession $session
```

Supported routes are `custom`, `mini`, `metals`, `featured`, `enquiry`, and
`fallback`.

## Cloudflare Storage

Create these before deploying the D1/R2 version:

```text
D1 database name: mmachine-runtime
D1 binding: DB
R2 bucket name: mmachine-featured-images
R2 binding: FEATURED_IMAGES
R2 bucket name: mmachine-quote-files
R2 binding: QUOTE_FILES
```

After creating the D1 database, put its `database_id` into `wrangler.jsonc`.

Run the D1 schema once:

```powershell
npx wrangler d1 execute mmachine-runtime --remote --file migrations/0001_mmachine_runtime.sql
npx wrangler d1 execute mmachine-runtime --remote --file migrations/0002_remove_demo_featured_work.sql
npx wrangler d1 execute mmachine-runtime --remote --file migrations/0003_request_limits.sql
npx wrangler d1 execute mmachine-runtime --remote --file migrations/0004_featured_work_prices.sql
npx wrangler d1 execute mmachine-runtime --remote --file migrations/0005_team_auth.sql
npx wrangler d1 execute mmachine-runtime --remote --file migrations/0006_team_notification_preferences.sql
npx wrangler d1 execute mmachine-runtime --remote --file migrations/0007_team_two_factor_requirement.sql
npx wrangler d1 execute mmachine-runtime --remote --file migrations/0008_quote_accounting_exports.sql
```

## GitHub Auto Deploy

Cloudflare Workers can be connected to the GitHub repository so pushes to `main` redeploy automatically.

Use:

```text
Build command: npm run cf:build
Deploy command: npm run deploy
Non-production branch deploy command: npm run upload
```

`npm run cf:build` runs the OpenNext Cloudflare build. A plain `next build` is
not enough for Workers because it does not create the `.open-next` output used
by the deploy step.

Make sure the same environment variables are added to Cloudflare's build/runtime variables before enabling production traffic.

## Owner Daily Sync

The owner daily sync does not need to know whether the runtime order data is in D1. It pushes refreshed generated catalogue files to GitHub. The hosting provider then redeploys from GitHub.
