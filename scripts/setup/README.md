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
Setup performs a capability test using the same shared automation layer as the
daily PDF exporter. It does not rely on a hard-coded Excel version number.

The supported range is Excel 2007 through current Microsoft 365 desktop Excel,
provided that the installed edition can open `.xlsx`/`.xlsm` workbooks and save
as PDF. Excel 2007 also needs Microsoft's Save as PDF/XPS feature. LibreOffice
is not installed or configured by the owner setup.

The setup kit can be run directly from a USB drive. The launcher copies the
main setup script to the computer's local Windows temporary folder before it
runs. The test PDF also uses the local temporary folder, and the permanent
installation is created at `C:\mmachine`.

For USB setup, copy the setup kit files from `scripts\setup` to the USB stick
and run `Run Owner Setup.bat` from that folder. That launcher asks for the
GitHub token in a masked dialog and then runs the main setup script as
Administrator. The `daily-sync.*` and `manual-sync.vbs` files are generated on
the owner's computer during setup and do not need to be copied.

Setup verifies Python by running a real interpreter. It does not trust the
Windows Microsoft Store `python.exe` App Execution Alias. Existing Python
installations are discovered through the Python launcher, registry, standard
install folders, or `PATH`; the working interpreter is then added to the
owner's user `PATH` for future scheduled syncs.

The GitHub token is entered through a masked Windows dialog. The dialog rejects
obviously incomplete pasted values, and setup validates repository access
before replacing any stored Git credential. If a token is ever visible in a
photograph or screenshot, revoke it immediately and create a replacement token.

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

Recommended USB method:

1. Copy these files to a folder on the USB stick:

   ```text
   C:\mmachine\scripts\setup\Run Owner Setup.bat
   C:\mmachine\scripts\setup\Run-Owner-Setup.ps1
   C:\mmachine\scripts\setup\Setup-Owner-Machine.ps1
   C:\mmachine\scripts\setup\Update GitHub Token.bat
   C:\mmachine\scripts\setup\Update-GitHub-Token.ps1
   C:\mmachine\scripts\setup\Fix-Daily-Sync-Window.ps1
   C:\mmachine\scripts\setup\README.md
   C:\mmachine\scripts\setup\CLOUDFLARE-ENV-VARS.md
   ```

2. On the owner's computer, open that USB folder.
3. Double-click:

   ```text
   Run Owner Setup.bat
   ```

4. Paste the fresh GitHub token into the masked dialog.

The setup can be run again on an existing installation. It refreshes
`C:\mmachine`, recreates the desktop shortcuts and scheduled task, and
regenerates the daily sync runner. It does not delete the owner's master Excel
files in `M-Machine Master Files`.

Direct PowerShell method, if needed:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd C:\path\to\setup
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

## Daily sync publishing boundary

The scheduled sync pulls the latest GitHub code, regenerates catalogue data,
customer files, and PDFs, then commits only the generated catalogue outputs:

- `lib/mini-data.ts`
- `lib/metals-data.ts`
- `lib/featured-data.ts`
- `lib/catalogue-versions.ts`
- `data-source/.metal-codes.json`
- `data-source/.metal-links.json`
- `data-source/.metal-catalogue-codes.json`
- `public/catalogue`
- `public/featured`

Unexpected website-code changes are logged and left unstaged. They are not
included in the daily sync commit, but they also do not stop normal catalogue
pricing/PDF updates from publishing.
