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
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `OWNER_PASSWORD` | Password used on `/dashboard/login` |
| `AUTH_SECRET` | Fresh random 32+ character string |
| `GITHUB_TOKEN` | Fine-grained GitHub token with Contents: Read and write on `mmachine-website-codex` |
| `GITHUB_REPO` | `digitalgold69/mmachine-website-codex` |

## Required When Email Sending Goes Live

| Name | Value |
| --- | --- |
| `QUOTE_OWNER_EMAIL` | Owner email address for new order requests |
| `RESEND_API_KEY` | Resend API key |
| `QUOTE_FROM_EMAIL` | Verified Resend sender, for example `M-Machine <sales@your-domain.co.uk>` |

`GITHUB_BRANCH` is optional and defaults to `main`.

## Generate AUTH_SECRET

Run this in PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

## Notes

- `NEXT_PUBLIC_SITE_URL` controls canonical URLs, Open Graph URLs, sitemap URLs, and SEO metadata.
- While testing on Cloudflare, set it to the Cloudflare placeholder URL.
- When the real domain is connected, update it to the final live domain and redeploy.
