# Cloudflare Deployment

This site is a full Next.js app, not a static-only site. It uses API routes for:

- owner login
- quote/order requests
- dashboard updates
- featured-work updates
- email sending

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
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OWNER_PASSWORD
AUTH_SECRET
GITHUB_TOKEN
GITHUB_REPO
```

Required when email sending goes live:

```text
QUOTE_OWNER_EMAIL
RESEND_API_KEY
QUOTE_FROM_EMAIL
```

Optional:

```text
GITHUB_BRANCH
```

`NEXT_PUBLIC_SITE_URL` should be the Cloudflare placeholder URL during testing. Change it to the real domain once the final domain is connected.

## GitHub Auto Deploy

Cloudflare Workers can be connected to the GitHub repository so pushes to `main` redeploy automatically.

Use:

```text
Build command: npm run build
Deploy command: npm run deploy
Non-production branch deploy command: npm run upload
```

Make sure the same environment variables are added to Cloudflare's build/runtime variables before enabling production traffic.

## Owner Daily Sync

The owner daily sync does not need to know whether the public site is hosted on Vercel or Cloudflare. It pushes refreshed generated files to GitHub. The hosting provider then redeploys from GitHub.
