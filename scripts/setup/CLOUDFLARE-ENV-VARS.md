# Cloudflare Environment Variables

Set these in the Cloudflare Workers project before the production site is used.

Cloudflare dashboard path:

1. Workers & Pages
2. Open the M-Machine Worker
3. Settings
4. Variables and Secrets
5. Add the variables below

## Required

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Temporary Cloudflare URL first, then the live domain later |
| `OWNER_PASSWORD` | Password used on `/dashboard/login` |
| `AUTH_SECRET` | Fresh random 32+ character string |

## Required When Email Sending Goes Live

| Name | Value |
| --- | --- |
| `AWS_SES_REGION` | AWS Region where the SES identity is verified |
| `AWS_SES_ACCESS_KEY_ID` | IAM access key with `ses:SendEmail` |
| `AWS_SES_SECRET_ACCESS_KEY` | IAM secret key with `ses:SendEmail` |
| `AWS_SES_FROM_EMAIL` | `orders@orders.m-machine.co.uk` |
| `AWS_SES_FROM_NAME` | `orders@m-machine.co.uk` |
| `QUOTE_OWNER_EMAIL` | Fallback/general owner notification address |
| `QUOTE_CUSTOM_OWNER_EMAIL` | Custom-work request notification address |
| `QUOTE_MINI_OWNER_EMAIL` | Mini panel order notification address |
| `QUOTE_METALS_OWNER_EMAIL` | Metals order notification address |
| `QUOTE_FEATURED_OWNER_EMAIL` | Featured-work order notification address |
| `QUOTE_ENQUIRY_OWNER_EMAIL` | Optional website contact/enquiry notification address |

Email is sent through Amazon SES API v2. Sender defaults to
`"orders@m-machine.co.uk" <orders@orders.m-machine.co.uk>`. SES authenticates
the address inside the angle brackets, so `AWS_SES_FROM_EMAIL` must be an
address under the verified `orders.m-machine.co.uk` identity. Most inboxes show
the display name from `AWS_SES_FROM_NAME`, while expanded message details still
show the real authenticated sender address.

Manage the SES settings and recipient-routing addresses in Cloudflare Workers
Settings -> Variables and Secrets. The recipient-routing keys are also declared
in `wrangler.jsonc` with safe defaults so Cloudflare recreates them if they are
ever removed. You do not need to edit `wrangler.jsonc` for normal email address
changes. If Cloudflare prompts you to update the Wrangler config file to keep
local development in sync, that is optional for this project as long as the
deployed Worker has the variables in Cloudflare.

`AWS_SES_REGION` must match the AWS Region where the SES identity appears under
Verified identities. Use `eu-north-1` only if the identity is in Europe
(Stockholm).

Use comma or semicolon separators if an order type should notify more than one
address.

Deploy with `npm run cf:deploy` or otherwise pass `--keep-vars` to Wrangler.
`wrangler.jsonc` also sets `keep_vars: true`. Without that protection, a
deployment can replace dashboard-managed runtime variables with only the values
committed in `wrangler.jsonc`.

After signing in to the owner dashboard, open `/api/email-health` to confirm the
sanitized SES configuration. An authenticated POST to the same endpoint with
`{"route":"custom"}` sends a controlled test to that route's configured
recipient. Supported routes are `custom`, `mini`, `metals`, `featured`,
`enquiry`, and `fallback`.

## Generate AUTH_SECRET

Run this in PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

## Notes

- `NEXT_PUBLIC_SITE_URL` controls canonical URLs, Open Graph URLs, sitemap URLs, and SEO metadata.
- While testing on Cloudflare, set it to the Cloudflare placeholder URL.
- When the real domain is connected, update it to the final live domain and redeploy.
- Order requests and featured-work content are stored in Cloudflare D1.
- Featured-work images are stored in Cloudflare R2.
- Custom quote files are stored in the `QUOTE_FILES` R2 bucket.
