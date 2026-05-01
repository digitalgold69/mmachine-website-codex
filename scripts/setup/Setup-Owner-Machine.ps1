# Setup-Owner-Machine.ps1
# ------------------------------------------------------------------------------
# One-time setup script for the M-Machine owner's Windows machine.
#
# What it does:
#   1. Installs Node.js, Python, and Git via winget (Microsoft's package manager,
#      built into Windows 10/11). Skips anything already installed.
#   2. Clones the mmachine-website git repo to C:\mmachine
#   3. Installs the npm and pip dependencies
#   4. Creates a daily Windows Scheduled Task that runs `npm run daily-sync`
#      at 6 AM. The task: (a) regenerates the website data from Excel, (b)
#      regenerates the customer-facing catalogue/invoice files, (c) exports
#      catalogue PDFs via Excel COM, (d) commits and pushes to GitHub so
#      Vercel auto-deploys.
#
# How to run (as Guy, on the owner's machine):
#   1. Open PowerShell *as Administrator*  (right-click PowerShell → Run as admin)
#   2. cd to wherever this script lives, e.g.  cd C:\Users\Owner\Downloads
#   3. Run:  Set-ExecutionPolicy -Scope Process Bypass -Force
#   4. Run:  .\Setup-Owner-Machine.ps1
#
# After it finishes, the owner literally never has to think about it again.
# She edits Metals.xlsx or PartsbookBenji2014.xlsx in C:\mmachine\data-source,
# and the next morning the website reflects her changes.
# ------------------------------------------------------------------------------

param(
    # GitHub repo URL (HTTPS form). Set this to the actual repo before running.
    [string]$RepoUrl = "https://github.com/REPLACE-ME/mmachine-website.git",

    # Where to clone the repo on the owner's machine
    [string]$InstallPath = "C:\mmachine",

    # Time to run the daily sync (24-hour format, owner's local time)
    [string]$DailyRunTime = "06:00",

    # GitHub Personal Access Token — needed for `git push` to work non-interactively.
    # Get one at github.com → Settings → Developer settings → Personal access tokens.
    # Scope needs to be: `repo` (full control of private repos) at minimum.
    [string]$GitHubToken = ""
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "━━━ $Message ━━━" -ForegroundColor Cyan
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# ------------------------------------------------------------------------------
# Step 0 — sanity checks
# ------------------------------------------------------------------------------

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script needs to run as Administrator." -ForegroundColor Red
    Write-Host "  Right-click PowerShell, choose 'Run as administrator', and re-run."
    exit 1
}

if ($RepoUrl -like "*REPLACE-ME*") {
    Write-Host "ERROR: Edit this script and set the -RepoUrl parameter to the real GitHub repo URL." -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($GitHubToken)) {
    Write-Host "ERROR: -GitHubToken is required (otherwise git push won't work non-interactively)." -ForegroundColor Red
    Write-Host "  Get one at: https://github.com/settings/tokens   Scope: 'repo'"
    Write-Host "  Then re-run with:  .\Setup-Owner-Machine.ps1 -GitHubToken 'ghp_xxx...'"
    exit 1
}

# ------------------------------------------------------------------------------
# Step 1 — install Node, Python, Git via winget
# ------------------------------------------------------------------------------

Write-Step "Step 1 of 5 — Install Node.js, Python, Git via winget"

# winget ships with Windows 10/11 by default. If it's missing we bail.
if (-not (Test-CommandExists "winget")) {
    Write-Host "ERROR: winget is not installed. Install 'App Installer' from the Microsoft Store first." -ForegroundColor Red
    exit 1
}

function Install-IfMissing {
    param(
        [string]$Command,
        [string]$WingetId,
        [string]$FriendlyName
    )
    if (Test-CommandExists $Command) {
        Write-Host "  $FriendlyName already installed — skipping" -ForegroundColor Gray
        return
    }
    Write-Host "  Installing $FriendlyName ..."
    winget install --id $WingetId --silent --accept-source-agreements --accept-package-agreements --scope machine
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: winget install of $FriendlyName failed." -ForegroundColor Red
        exit 1
    }
}

Install-IfMissing -Command "node"   -WingetId "OpenJS.NodeJS.LTS"   -FriendlyName "Node.js"
Install-IfMissing -Command "python" -WingetId "Python.Python.3.12"  -FriendlyName "Python 3.12"
Install-IfMissing -Command "git"    -WingetId "Git.Git"             -FriendlyName "Git"

# Refresh the PATH so the rest of this script can find the new tools
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# ------------------------------------------------------------------------------
# Step 2 — clone the repo
# ------------------------------------------------------------------------------

Write-Step "Step 2 of 5 — Clone the repo to $InstallPath"

if (Test-Path $InstallPath) {
    Write-Host "  $InstallPath already exists — pulling latest changes instead of re-cloning"
    Push-Location $InstallPath
    git pull --ff-only
    Pop-Location
} else {
    # Embed the GitHub token in the URL for the clone — non-interactive auth
    $RepoWithToken = $RepoUrl -replace "https://", "https://${GitHubToken}@"
    git clone $RepoWithToken $InstallPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: git clone failed. Check the repo URL and token." -ForegroundColor Red
        exit 1
    }
}

# Configure git to remember the credentials so the daily push works
Push-Location $InstallPath
git config credential.helper store
"https://${GitHubToken}@github.com" | Out-File -FilePath "$env:USERPROFILE\.git-credentials" -Encoding ASCII -NoNewline
git config user.name "M-Machine Daily Sync"
git config user.email "metals@m-machine.co.uk"
Pop-Location

# ------------------------------------------------------------------------------
# Step 3 — install dependencies
# ------------------------------------------------------------------------------

Write-Step "Step 3 of 5 — Install npm and pip dependencies"

Push-Location $InstallPath
Write-Host "  Running npm install ..."
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed." -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "  Running pip install openpyxl ..."
python -m pip install --quiet openpyxl
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pip install failed." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# ------------------------------------------------------------------------------
# Step 4 — create the daily scheduled task
# ------------------------------------------------------------------------------

Write-Step "Step 4 of 5 — Register the daily scheduled task"

# We wrap the npm command in a .bat script so the task can run it cleanly.
$BatPath = Join-Path $InstallPath "scripts\setup\daily-sync.bat"
$BatContent = @"
@echo off
cd /d $InstallPath
set LOG=$InstallPath\daily-sync.log
echo. >> "%LOG%"
echo ============================================== >> "%LOG%"
echo [%date% %time%] Starting daily sync >> "%LOG%"
echo ============================================== >> "%LOG%"

REM Step 1-3: regenerate website data, customer files, PDFs
call npm run daily-sync >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [%date% %time%] daily-sync failed — skipping git push >> "%LOG%"
    exit /b %errorlevel%
)

REM Step 4: stage the auto-generated files
git add lib outgoing-to-owner public/catalogue >> "%LOG%" 2>&1

REM Step 5: only commit if something actually changed
git diff --cached --quiet
if errorlevel 1 (
    echo [%date% %time%] Committing changes >> "%LOG%"
    git commit -m "Daily sync %date%" >> "%LOG%" 2>&1
    echo [%date% %time%] Pushing to GitHub >> "%LOG%"
    git push >> "%LOG%" 2>&1
) else (
    echo [%date% %time%] No changes to commit >> "%LOG%"
)

echo [%date% %time%] Daily sync done >> "%LOG%"
"@
Set-Content -Path $BatPath -Value $BatContent -Encoding ASCII

$TaskName = "M-Machine Daily Sync"

# Remove any previous version
Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false -ErrorAction SilentlyContinue

# Build the task. We run it as the currently-logged-in user so Excel COM
# (which needs an interactive desktop session) works. Run only when user is
# logged in — otherwise Excel can't launch.
$Action  = New-ScheduledTaskAction  -Execute "cmd.exe" -Argument "/c `"$BatPath`""
$Trigger = New-ScheduledTaskTrigger -Daily -At $DailyRunTime
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Principal $Principal `
    -Settings $Settings `
    -Description "Daily 6 AM: regenerates website data from Metals.xlsx + PartsbookBenji, regenerates customer-facing catalogue & invoice files, exports PDFs, pushes to GitHub for auto-deploy."

Write-Host "  ✓ Scheduled task registered: '$TaskName' at $DailyRunTime daily" -ForegroundColor Green

# ------------------------------------------------------------------------------
# Step 5 — first test run
# ------------------------------------------------------------------------------

Write-Step "Step 5 of 5 — Test run (so we know everything works before tomorrow)"

Write-Host "  Triggering the scheduled task manually..."
Start-ScheduledTask -TaskName $TaskName

# Give it up to 5 minutes to complete
$timeout = New-TimeSpan -Minutes 5
$start = Get-Date
do {
    Start-Sleep -Seconds 5
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    if ((Get-Date) - $start -gt $timeout) {
        Write-Host "  ! Test run still going after 5 min — check $InstallPath\daily-sync.log later" -ForegroundColor Yellow
        break
    }
} while ($info.LastTaskResult -eq 267009)  # 267009 = "still running"

if ($info.LastTaskResult -eq 0) {
    Write-Host "  ✓ Test run succeeded. Log: $InstallPath\daily-sync.log" -ForegroundColor Green
} else {
    Write-Host "  ! Test run finished with code $($info.LastTaskResult). Check $InstallPath\daily-sync.log" -ForegroundColor Yellow
}

# ------------------------------------------------------------------------------
# Done
# ------------------------------------------------------------------------------

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  Setup complete." -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "What happens now:"
Write-Host "  • Every day at $DailyRunTime, the daily sync runs automatically"
Write-Host "  • Owner edits files in $InstallPath\data-source\"
Write-Host "  • The next morning the website reflects her changes"
Write-Host "  • Fresh catalogue/invoice files appear in $InstallPath\outgoing-to-owner\"
Write-Host "  • Catalogue PDFs go to $InstallPath\public\catalogue\ and the website"
Write-Host ""
Write-Host "To run the sync manually any time:"
Write-Host "  cd $InstallPath"
Write-Host "  npm run daily-sync"
Write-Host ""
Write-Host "Log file: $InstallPath\daily-sync.log"
Write-Host ""
