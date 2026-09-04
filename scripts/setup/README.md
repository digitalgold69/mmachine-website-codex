# Owner/server machine setup

This is the one-time setup for the Windows computer that will run the daily
M-Machine sync. That can be the owner's PC or the office server.

Important: running the setup kit from a server/network folder on the owner's PC
still installs it on the owner's PC. To install it on the server, first log into
the server itself, then run the setup there.

The goal is deliberately simple:

1. The owner edits the master Excel files she already knows.
2. A daily sync refreshes the website and catalogue files.
3. The invoice templates stay original; the Mini invoice keeps using the Mini
   master file for part-code prices.

## What the setup script creates

- `C:\mmachine` - repo clone on the computer running the sync
- Desktop folder: `M-Machine Master Files`
  - Points to `C:\mmachine\data-source`
  - The owner puts the two daily master files here
  - Supporting/template workbooks live in its `More Files` subfolder
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

The computer running the sync must have Microsoft Excel desktop installed and
activated.
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
Administrator. It also prints the current computer name before setup continues.
If you are trying to install on the server, stop unless that name is the server.
The `daily-sync.*` and `manual-sync.vbs` files are generated on the sync
computer during setup and do not need to be copied.

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

Daily master files the owner normally edits/replaces:

- `Metals.xlsx`
- `PartsbookBenji2014.xlsx`

Supporting files that should live in `M-Machine Master Files\More Files`:

- `Metals Catalogue.xlsx`
- `Mini Catalogue Self Updating.xlsm`
- `Mini Invoice Template.xlsm`

Optional:

- `Metals Invoice.xlsm`

The metals invoice is copied unchanged into "M-Machine Customer Files".

The Mini invoice keeps its original layout and macros, but the sync embeds fresh
Partsbook prices into the customer copy on every run.

## Moving from owner PC to server

Use this route when the owner PC already has a working local install, but the
server should run the daily sync instead.

1. On the owner PC, run `Disable Old Local Sync.bat` from the setup kit.
   - This removes the local scheduled task and desktop shortcuts.
   - It moves `C:\mmachine` to a dated backup folder instead of deleting it.
2. Log into the server itself, for example with Remote Desktop.
3. Confirm Microsoft Excel opens normally on the server and can save/export a
   workbook as PDF.
4. Run `Run Owner Setup.bat` on the server.
5. When the setup prints the computer name, confirm it is the server.
6. Put the master workbooks into the server's `M-Machine Master Files` shortcut.
7. Share the server master/customer folders or ask the IT/server maintainer to
   share them.
8. Add shortcuts to those shared server folders on the office computers.

Only one computer should have the `M-Machine Daily Sync` scheduled task active.
After moving to the server, leave the owner PC local sync disabled.

## Run the setup script

Recommended USB method:

1. Copy these files to a folder on the USB stick:

   ```text
   C:\mmachine\scripts\setup\Run Owner Setup.bat
   C:\mmachine\scripts\setup\Run-Owner-Setup.ps1
   C:\mmachine\scripts\setup\Setup-Owner-Machine.ps1
   C:\mmachine\scripts\setup\Disable Old Local Sync.bat
   C:\mmachine\scripts\setup\Disable-Local-MMachine-Sync.ps1
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

## Metals source of truth

The website metals catalogue uses `Metals Catalogue.xlsx` to decide which metal
rows exist and where they sit in the catalogue. The old filename
`Metals catalogue 2023.xlsx` is still accepted, but `Metals Catalogue.xlsx` is
the clearer name to use going forward.

`Metals.xlsx` is the live price source. If a catalogue row no longer has a
matching numeric price in `Metals.xlsx`, the website shows that row as `POA`
rather than keeping an old catalogue price.

To fully remove a metal from the website, remove it from the metals catalogue
workbook. Removing or blanking only the price in `Metals.xlsx` leaves the row
visible as `POA`.

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
