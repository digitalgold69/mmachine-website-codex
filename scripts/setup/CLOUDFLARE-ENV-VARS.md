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
| `QUOTE_OWNER_EMAIL` | Owner email address for new order requests |

Cloudflare-native delivery uses the `EMAIL` `send_email` binding in
`wrangler.jsonc`. Sender defaults to `M-Machine <sales@m-machine.co.uk>`;
override it with `QUOTE_FROM_EMAIL` if needed. The sender domain must be
onboarded to Cloudflare Email Service before native sending will deliver.

Keep this during the migration as a controlled fallback:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | Existing Resend API key |

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
