# Cloudflare Deployment

This site is a full Next.js app, not a static-only site. It uses API routes for:

- owner login
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

## Environment Variables

Copy the environment variables from the current deployment host into Cloudflare Workers.

Required:

```text
NEXT_PUBLIC_SITE_URL
OWNER_PASSWORD
AUTH_SECRET
```

Required when email sending goes live:

```text
AWS_SES_REGION                 region where the SES identity is verified
AWS_SES_ACCESS_KEY_ID          IAM access key with ses:SendEmail
AWS_SES_SECRET_ACCESS_KEY      IAM secret key with ses:SendEmail
AWS_SES_FROM_EMAIL             orders@m-machine.co.uk
QUOTE_OWNER_EMAIL              fallback/general owner notification address
QUOTE_CUSTOM_OWNER_EMAIL       custom-work request notifications
QUOTE_MINI_OWNER_EMAIL         mini panel order notifications
QUOTE_METALS_OWNER_EMAIL       metals order notifications
QUOTE_FEATURED_OWNER_EMAIL     featured-work order notifications
QUOTE_ENQUIRY_OWNER_EMAIL      optional website enquiry notifications
```

Use comma or semicolon separators if an order type should notify more than one
address.

Email is sent through Amazon SES API v2. Sender defaults to
`orders@m-machine.co.uk`; set `AWS_SES_FROM_EMAIL` explicitly so the deployed
environment matches that address. SES must verify either the parent domain
`m-machine.co.uk` or the exact email identity `orders@m-machine.co.uk` in
`AWS_SES_REGION`. A verified `orders.m-machine.co.uk` identity only covers
addresses at that subdomain, such as `sales@orders.m-machine.co.uk`.

`NEXT_PUBLIC_SITE_URL` should be the Cloudflare placeholder URL during testing. Change it to the real domain once the final domain is connected.

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
```

## GitHub Auto Deploy

Cloudflare Workers can be connected to the GitHub repository so pushes to `main` redeploy automatically.

Use:

```text
Build command: npm run cf:build
Deploy command: npx wrangler deploy
Non-production branch deploy command: npm run upload
```

`npm run cf:build` runs the OpenNext Cloudflare build. A plain `next build` is
not enough for Workers because it does not create the `.open-next` output used
by the deploy step.

Make sure the same environment variables are added to Cloudflare's build/runtime variables before enabling production traffic.

## Owner Daily Sync

The owner daily sync does not need to know whether the runtime order data is in D1. It pushes refreshed generated catalogue files to GitHub. The hosting provider then redeploys from GitHub.
