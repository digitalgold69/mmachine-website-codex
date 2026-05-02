# Vercel environment variables — one-time setup

Three pages on the site now require server-side env vars to work:

1. The owner login page (`/dashboard/login`)
2. The featured-work editor (`/dashboard/featured`) — saving via the API
3. The featured-work editor — reading the live JSON from GitHub

You set these once in Vercel's project settings. After they're set, the next
deploy picks them up.

---

## How to set them

1. Go to https://vercel.com/dashboard
2. Click into the **mmachine-website** project
3. **Settings** (top tab) → **Environment Variables** (left sidebar)
4. For each row in the table below, click **Add Another**, paste the name
   and value, leave the environment as **Production, Preview, Development**
   (the default), then **Save**
5. After all four are set, hit **Redeploy** on your latest deployment so the
   new variables take effect

---

## The four variables

| Name | What to put in it | Example |
| --- | --- | --- |
| `OWNER_PASSWORD` | The password the owner types into the login form. Pick anything memorable but not guessable. **Tell the owner this password directly — never email it.** | `Workshop1980` |
| `AUTH_SECRET` | A random 32+ character string used to sign session cookies. Generate one fresh — don't reuse anything you've seen. Treat like a password. | A 40-char random string |
| `GITHUB_TOKEN` | A GitHub Personal Access Token with **Contents: Read & write** on this repo. Same one you generated for the daily-sync setup script — you can reuse it. | `github_pat_xxxxx...` |
| `GITHUB_REPO` | Your GitHub repo in `owner/repo` form. | `guy/mmachine-website` |

`GITHUB_BRANCH` is optional and defaults to `main` — only set it if you push from a different branch.

### Generating AUTH_SECRET

Open PowerShell and run:

```
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

That spits out a 40-character alphanumeric string. Copy it, paste it into Vercel.

---

## What happens once these are set

- The owner visits `https://mmachine-website.vercel.app/dashboard/login`
- Types the `OWNER_PASSWORD` value, hits sign in
- Lands on `/dashboard/featured`
- Adds/edits/deletes jobs via the form, uploads photos directly from her computer
- Each save commits the change to the repo via the GitHub API
- Vercel auto-deploys — within ~30-60 seconds the public site reflects the change
- A green "Saved" banner confirms each save with a reminder that the public update takes a moment

She never edits a JSON file. She never sees a terminal. She clicks buttons.
