# Owner-machine setup

One-time setup for the owner's Windows machine. After this, the website
updates itself daily — the owner just edits Excel files like she always has.

---

## What this does

Every day at 6 AM (configurable):

1. Regenerates the website's product data from `Metals.xlsx` and
   `PartsbookBenji2014.xlsx` (both in `data-source/`)
2. Regenerates the customer-facing catalogue and invoice files in
   `outgoing-to-owner/` with fresh prices from the masters
3. Exports the catalogue as a PDF (using **Excel itself** for perfect
   logo/layout fidelity) into `public/catalogue/metals-catalogue.pdf`
4. Commits everything to git and pushes to GitHub. Vercel auto-deploys
   the new prices and PDFs to the live site.

The owner just edits the master Excel files. The rest is automatic.

---

## Setup steps (Guy does these once on the owner's machine)

### Prerequisites

- Windows 10 or 11
- Microsoft Excel installed (any 2013+ version — the owner already has this)
- An internet connection

### Get a GitHub Personal Access Token

This lets the daily sync push commits without an interactive password prompt.

1. Go to https://github.com/settings/tokens
2. **Generate new token** → **classic**
3. Note: "M-Machine daily sync"
4. Expiration: choose "No expiration" (or a long one — you'll need to
   regenerate it before that date)
5. Scope: tick **`repo`** (full control of private repositories)
6. Generate, copy the token (starts with `ghp_...`). **You won't see it
   again** so paste it somewhere safe right away.

### Run the setup script

1. Download `Setup-Owner-Machine.ps1` to the owner's machine (e.g. via
   the GitHub web UI → Raw → Save As)

2. **Open PowerShell as Administrator**
   (Press Win, type "PowerShell", right-click → Run as administrator)

3. Run:
   ```
   Set-ExecutionPolicy -Scope Process Bypass -Force
   cd C:\Users\Owner\Downloads
   .\Setup-Owner-Machine.ps1 -RepoUrl "https://github.com/YOUR-ORG/mmachine-website.git" -GitHubToken "ghp_xxxxxxxx"
   ```

   Replace the URL with the actual repo URL and the token with the one
   you just generated.

4. The script:
   - Installs Node.js, Python, Git via winget (skips if already there)
   - Clones the repo to `C:\mmachine`
   - Runs `npm install` and `pip install openpyxl`
   - Registers a Windows Scheduled Task called "M-Machine Daily Sync"
     that runs `npm run daily-sync` at 6 AM daily
   - Triggers a manual test run to confirm everything works

5. Done. Walk away.

---

## Daily flow from the owner's perspective

1. Owner edits `C:\mmachine\data-source\Metals.xlsx` (or PartsbookBenji)
   any time during the day
2. Saves the file, closes Excel
3. Goes home
4. Next morning the website is updated. Customers see new prices.
5. Fresh catalogue and invoice files are sitting in
   `C:\mmachine\outgoing-to-owner\` ready to email if needed

That's it.

---

## What if she edits from her home laptop on a USB stick?

Two options:

**Option A (simpler):** When she comes back to the work machine, she
copies the edited file from the USB stick into
`C:\mmachine\data-source\` (overwriting the existing one). The next 6 AM
run picks it up.

**Option B (zero-effort, recommended):** Make `C:\mmachine\data-source\`
a OneDrive folder. She edits the file in OneDrive on either machine,
both stay in sync automatically. No USB stick.

To set up Option B:
1. Sign into OneDrive on both machines (the work machine and her home laptop)
2. Move the contents of `data-source\` into a OneDrive folder
3. Update the symlink: in PowerShell as admin,
   `New-Item -ItemType SymbolicLink -Path "C:\mmachine\data-source" -Target "$env:USERPROFILE\OneDrive\M-Machine\data-source"`
4. Copy the master Excel files into that OneDrive folder
5. Done — both machines see the same files

---

## How to tell if it's working

The scheduled task writes a log to `C:\mmachine\daily-sync.log`.
Open that file to see what happened the last time the task ran.

To run the sync manually any time without waiting for 6 AM:
```
cd C:\mmachine
npm run daily-sync
```

To check the scheduled task status:
```
Get-ScheduledTaskInfo -TaskName "M-Machine Daily Sync"
```

---

## Things that might go wrong

**"npm run daily-sync" fails with "git push" error**

The GitHub token may have expired or been revoked. Regenerate it on
GitHub, then update the credentials file:
```
"https://NEW-TOKEN@github.com" | Out-File -FilePath "$env:USERPROFILE\.git-credentials" -Encoding ASCII -NoNewline
```

**Excel COM error during PDF export**

The owner needs to be logged in to Windows when the task runs (Excel COM
requires an interactive desktop session). If she signs out at night, the
task will fail to generate PDFs. Solutions:
- Set Windows to never auto-sign-out (Power Options → Sleep settings)
- Run the task at a time when she's known to be at her desk

**The task doesn't run at 6 AM**

Check Windows Task Scheduler (taskschd.msc) → Task Scheduler Library →
look for "M-Machine Daily Sync". The "Last Run Time" and "Last Run Result"
columns tell you what happened.

**"Update Links" dialog still appears in Excel**

This shouldn't happen with the wired files, but if it does, the owner
should click "Don't Update". Then close and re-open the file — the
dialog should be gone for that file. If it persists, send the file
back to Guy to re-wire.
