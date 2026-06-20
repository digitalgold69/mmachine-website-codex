# Owner machine setup

This is the one-time setup for the owner's Windows computer.

The goal is deliberately simple:

1. The owner edits the master Excel files she already knows.
2. A daily sync refreshes the website and catalogue files.
3. The invoice templates stay original; the Mini invoice keeps using the Mini
   master file for part-code prices.

## What the setup script creates

- `C:\mmachine` - local repo clone
- Desktop folder: `M-Machine Master Files`
  - Points to `C:\mmachine\data-source`
  - The owner puts the Excel files here
- Desktop folder: `M-Machine Customer Files`
  - Points to `C:\mmachine\final-deliverables`
  - The owner opens refreshed catalogue files here
- Desktop shortcut: `Run M-Machine Sync Now`
  - Runs the update in the background without PowerShell
- Desktop note: `M-Machine Instructions.txt`
  - A short reminder of which folder and files to use
- Scheduled task: `M-Machine Daily Sync`
  - Runs daily at noon local UK time by default
  - Refreshes website data, catalogue Excel files, and PDFs
  - Pushes website/PDF updates to GitHub so the website host redeploys
  - Runs hidden and uses the supplied GitHub token directly, so no GitHub
    account picker should appear

The owner computer must have Microsoft Excel desktop installed and activated.
Setup checks that Excel can perform a real PDF export before continuing.
LibreOffice is not installed or configured by the owner setup.

## Files to copy into "M-Machine Master Files"

Required:

- `Metals.xlsx`
- `PartsbookBenji2014.xlsx`
- `Metals catalogue 2023.xlsx`
- `Mini Catalogue Self Updating.xlsm`

Optional but recommended:

- `Metals Invoice.xlsm`
- `Mini Invoice Template.xlsm`

The metals invoice is copied unchanged into "M-Machine Customer Files".

The Mini invoice keeps its original layout and macros, but the sync points its
existing Partsbook link at `C:\mmachine\data-source\PartsbookBenji2014.xlsx`.

## Run the setup script

Open PowerShell as Administrator, then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd C:\Users\Owner\Downloads
.\Setup-Owner-Machine.ps1 -RepoUrl "https://github.com/digitalgold69/mmachine-website-codex.git" -GitHubToken "YOUR_NEW_TOKEN"
```

Use a fresh GitHub token. If an old token was pasted into chat or logs, revoke
it and create a new one.

## Manual sync

After the Excel files are in the master folder, use the desktop shortcut:

`Run M-Machine Sync Now`

The log file is:

```text
C:\mmachine\daily-sync.log
```

For troubleshooting, the background runner is:

```text
C:\mmachine\scripts\setup\daily-sync.ps1
```
