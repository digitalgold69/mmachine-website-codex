# Vercel Environment Variables

Set these once in the Codex Vercel project.

Go to:

1. https://vercel.com/dashboard
2. Open the Codex M-Machine project
3. Settings
4. Environment Variables
5. Add the variables below for Production, Preview and Development
6. Redeploy after saving them

## Required

| Name | Value |
| --- | --- |
| `OWNER_PASSWORD` | The password the owner uses on `/dashboard/login` |
| `AUTH_SECRET` | A fresh random 32+ character string |
| `GITHUB_TOKEN` | Fine-grained GitHub token with Contents: Read and write on `mmachine-website-codex` |
| `GITHUB_REPO` | `digitalgold69/mmachine-website-codex` |
| `QUOTE_OWNER_EMAIL` | Owner email address for new quote requests, e.g. `sales@m-machine.co.uk` |
| `RESEND_API_KEY` | Resend API key for sending owner and buyer emails |
| `QUOTE_FROM_EMAIL` | Verified Resend sender, e.g. `M-Machine <sales@your-verified-domain.co.uk>` |

`GITHUB_BRANCH` is optional and defaults to `main`.

## Generate AUTH_SECRET

Run this in PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

## Important Privacy Note

Quote requests contain customer names, emails, phone numbers and order details.
The current quote-request storage uses GitHub so the owner dashboard can read
and update requests without a separate database.

Before using quote requests with real customers, make the Codex GitHub repo
private or move quote storage to a private database.

## What These Variables Power

- Owner login
- Featured-work editor
- Quote request cart submissions
- Owner quote dashboard
- Email notification to the owner
- Emailing the edited quote back to the buyer
