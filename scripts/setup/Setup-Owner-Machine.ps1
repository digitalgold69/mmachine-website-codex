# Setup-Owner-Machine.ps1
# ------------------------------------------------------------------------------
# One-time setup script for the M-Machine owner's Windows machine.
#
# What it does:
#   1. Installs Node.js, Python, and Git via winget.
#   2. Clones the mmachine-website repo to C:\mmachine.
#   3. Installs npm and Python dependencies.
#   4. Creates friendly desktop items:
#        M-Machine Master Files   -> C:\mmachine\data-source
#        M-Machine Customer Files -> C:\mmachine\final-deliverables
#        Run M-Machine Sync Now.bat
#        M-Machine Instructions.txt
#   5. Creates a daily Windows Scheduled Task at noon.
#
# Daily sync behaviour:
#   - Website data updates from Metals.xlsx and PartsbookBenji2014.xlsx.
#   - Customer catalogue files are rebuilt with fresh prices.
#   - Invoice templates keep the owner's normal workflow.
#   - Catalogue PDFs are exported and pushed to GitHub for Vercel.
#
# Important:
#   The Excel files are not stored in GitHub. After setup, copy the owner's
#   Excel files into the "M-Machine Master Files" desktop folder.
# ------------------------------------------------------------------------------

param(
    [string]$RepoUrl = "https://github.com/REPLACE-ME/mmachine-website.git",
    [string]$InstallPath = "C:\mmachine",
    [string]$DailyRunTime = "12:00",
    [string]$GitHubToken = "",
    [switch]$SkipInitialSync
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor Cyan
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Exit-WithMessage {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Get-RepoUrlWithToken {
    param([string]$Url, [string]$Token)
    return $Url -replace "^https://", "https://x-access-token:${Token}@"
}

function Get-RequiredExcelFiles {
    param([string]$Root)
    return @(
        (Join-Path $Root "data-source\Metals.xlsx"),
        (Join-Path $Root "data-source\Metals catalogue 2023.xlsx"),
        (Join-Path $Root "data-source\PartsbookBenji2014.xlsx"),
        (Join-Path $Root "data-source\Mini Catalogue Self Updating.xlsm")
    )
}

function Test-RequiredExcelFilesPresent {
    param([string]$Root)
    $missing = @()
    foreach ($file in Get-RequiredExcelFiles -Root $Root) {
        if (-not (Test-Path $file)) {
            $missing += $file
        }
    }
    return $missing
}

function Create-FolderLink {
    param([string]$LinkPath, [string]$TargetPath, [string]$Purpose)
    if (-not (Test-Path $TargetPath)) {
        New-Item -ItemType Directory -Force -Path $TargetPath | Out-Null
    }
    if (Test-Path $LinkPath) {
        Write-Host "  $($LinkPath | Split-Path -Leaf) already exists - skipping" -ForegroundColor Gray
        return
    }
    $result = cmd /c mklink /D `"$LinkPath`" `"$TargetPath`" 2>&1
    if (Test-Path $LinkPath) {
        Write-Host "  Created: $($LinkPath | Split-Path -Leaf) - $Purpose" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: could not create folder link: $result" -ForegroundColor Yellow
        Write-Host "  The system still works; use this folder manually: $TargetPath"
    }
}

# ------------------------------------------------------------------------------
# Step 0 - sanity checks
# ------------------------------------------------------------------------------

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Exit-WithMessage "Run PowerShell as Administrator, then run this script again."
}

if ($RepoUrl -like "*REPLACE-ME*") {
    Exit-WithMessage "Pass the real repo URL with -RepoUrl."
}

if ([string]::IsNullOrWhiteSpace($GitHubToken)) {
    Exit-WithMessage "-GitHubToken is required so the daily sync can push to GitHub."
}

# ------------------------------------------------------------------------------
# Step 1 - install tools
# ------------------------------------------------------------------------------

Write-Step "Step 1 of 5 - Install Node.js, Python, and Git"

if (-not (Test-CommandExists "winget")) {
    Exit-WithMessage "winget is missing. Install App Installer from the Microsoft Store first."
}

function Install-IfMissing {
    param(
        [string]$Command,
        [string]$WingetId,
        [string]$FriendlyName
    )
    if (Test-CommandExists $Command) {
        Write-Host "  $FriendlyName already installed - skipping" -ForegroundColor Gray
        return
    }
    Write-Host "  Installing $FriendlyName ..."
    winget install --id $WingetId --silent --accept-source-agreements --accept-package-agreements --scope machine
    if ($LASTEXITCODE -ne 0) {
        Exit-WithMessage "winget install of $FriendlyName failed."
    }
}

Install-IfMissing -Command "node" -WingetId "OpenJS.NodeJS.LTS" -FriendlyName "Node.js"
Install-IfMissing -Command "python" -WingetId "Python.Python.3.12" -FriendlyName "Python 3.12"
Install-IfMissing -Command "git" -WingetId "Git.Git" -FriendlyName "Git"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# ------------------------------------------------------------------------------
# Step 2 - clone or update repo
# ------------------------------------------------------------------------------

Write-Step "Step 2 of 5 - Clone or update the repo"

$RepoWithToken = Get-RepoUrlWithToken -Url $RepoUrl -Token $GitHubToken

if (Test-Path $InstallPath) {
    if (-not (Test-Path (Join-Path $InstallPath ".git"))) {
        Exit-WithMessage "$InstallPath already exists but is not a Git repo. Rename it first, then re-run."
    }
    Write-Host "  $InstallPath already exists - pulling latest changes"
    Push-Location $InstallPath
    git pull --rebase --autostash
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Exit-WithMessage "git pull failed. Check the repo and internet connection."
    }
    Pop-Location
} else {
    git clone $RepoWithToken $InstallPath
    if ($LASTEXITCODE -ne 0) {
        Exit-WithMessage "git clone failed. Check the repo URL and token."
    }
}

Push-Location $InstallPath
git remote set-url origin $RepoUrl
git config credential.helper store
"https://x-access-token:${GitHubToken}@github.com" | Out-File -FilePath "$env:USERPROFILE\.git-credentials" -Encoding ASCII -NoNewline
git config user.name "M-Machine Daily Sync"
git config user.email "metals@m-machine.co.uk"
Pop-Location

# ------------------------------------------------------------------------------
# Step 3 - install dependencies
# ------------------------------------------------------------------------------

Write-Step "Step 3 of 5 - Install project dependencies"

Push-Location $InstallPath
Write-Host "  Running npm install ..."
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Exit-WithMessage "npm install failed."
}

Write-Host "  Installing Python package: openpyxl ..."
python -m pip install --quiet openpyxl
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Exit-WithMessage "pip install openpyxl failed."
}
Pop-Location

# ------------------------------------------------------------------------------
# Step 4 - desktop folders and scheduled task
# ------------------------------------------------------------------------------

Write-Step "Step 4 of 5 - Create desktop folders and scheduled task"

$desktopPath = [Environment]::GetFolderPath("Desktop")
$masterFolder = Join-Path $desktopPath "M-Machine Master Files"
$customerFolder = Join-Path $desktopPath "M-Machine Customer Files"
$manualSyncButton = Join-Path $desktopPath "Run M-Machine Sync Now.bat"
$ownerInstructions = Join-Path $desktopPath "M-Machine Instructions.txt"
$dataSourcePath = Join-Path $InstallPath "data-source"
$finalPath = Join-Path $InstallPath "final-deliverables"

Create-FolderLink -LinkPath $masterFolder -TargetPath $dataSourcePath -Purpose "put master Excel files here"
Create-FolderLink -LinkPath $customerFolder -TargetPath $finalPath -Purpose "open refreshed customer files here"

$BatPath = Join-Path $InstallPath "scripts\setup\daily-sync.bat"
$BatContent = @"
@echo off
cd /d "$InstallPath"
set "LOG=$InstallPath\daily-sync.log"
set "PYTHONIOENCODING=utf-8:replace"
echo. >> "%LOG%"
echo ============================================== >> "%LOG%"
echo [%date% %time%] Starting daily sync >> "%LOG%"
echo ============================================== >> "%LOG%"

git pull --rebase --autostash >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [%date% %time%] git pull failed >> "%LOG%"
    exit /b %errorlevel%
)

call npm run daily-sync >> "%LOG%" 2>&1
if errorlevel 1 (
    echo [%date% %time%] daily-sync failed - skipping git push >> "%LOG%"
    exit /b %errorlevel%
)

git add lib/mini-data.ts lib/metals-data.ts data-source/.metal-codes.json public/catalogue >> "%LOG%" 2>&1

git diff --cached --quiet
if errorlevel 1 (
    echo [%date% %time%] Committing changes >> "%LOG%"
    git commit -m "Daily sync %date%" >> "%LOG%" 2>&1
    echo [%date% %time%] Pushing to GitHub >> "%LOG%"
    git push >> "%LOG%" 2>&1
) else (
    echo [%date% %time%] No website changes to commit >> "%LOG%"
)

echo [%date% %time%] Daily sync done >> "%LOG%"
"@
Set-Content -Path $BatPath -Value $BatContent -Encoding ASCII

$ManualSyncContent = @"
@echo off
title M-Machine Sync
call "$BatPath"
echo.
echo Sync finished. Check the M-Machine Customer Files folder.
echo.
pause
"@
Set-Content -Path $manualSyncButton -Value $ManualSyncContent -Encoding ASCII

$OwnerInstructionsContent = @"
M-MACHINE DAILY ROUTINE

Use this desktop folder:

M-Machine Master Files

Put the newest master Excel files in there. If Windows asks whether to replace
the old file, click Replace.

For normal price changes, the files that matter are:

Metals.xlsx
PartsbookBenji2014.xlsx

The other Excel files should stay in the folder too:

Metals catalogue 2023.xlsx
Mini Catalogue Self Updating.xlsm
Metals Invoice.xlsm
Mini Invoice Template.xlsm

Do not rename the files.
Close Excel after saving.

The computer runs the update automatically every day.
If you want to run it now, double-click:

Run M-Machine Sync Now.bat

Finished customer files appear in:

M-Machine Customer Files
"@
Set-Content -Path $ownerInstructions -Value $OwnerInstructionsContent -Encoding ASCII

$TaskName = "M-Machine Daily Sync"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BatPath`""
$Trigger = New-ScheduledTaskTrigger -Daily -At $DailyRunTime
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Principal $Principal `
    -Settings $Settings `
    -Description "Daily noon sync for M-Machine: refresh website data, catalogue files, PDFs, and push to GitHub."

Write-Host "  Scheduled task registered: $TaskName at $DailyRunTime daily" -ForegroundColor Green
Write-Host "  Manual sync button created: Run M-Machine Sync Now.bat" -ForegroundColor Green
Write-Host "  Instruction note created: M-Machine Instructions.txt" -ForegroundColor Green

# ------------------------------------------------------------------------------
# Step 5 - optional first test run
# ------------------------------------------------------------------------------

Write-Step "Step 5 of 5 - Initial sync check"

$missingExcel = Test-RequiredExcelFilesPresent -Root $InstallPath
if ($missingExcel.Count -gt 0) {
    Write-Host "  Setup is installed, but the first sync was skipped." -ForegroundColor Yellow
    Write-Host "  Copy these files into the desktop folder named 'M-Machine Master Files':"
    foreach ($file in $missingExcel) {
        Write-Host "    - $(Split-Path -Leaf $file)"
    }
    Write-Host ""
    Write-Host "  Optional but recommended, also copy:"
    Write-Host "    - Metals Invoice.xlsm"
    Write-Host "    - Mini Invoice Template.xlsm"
    Write-Host ""
    Write-Host "  Then run this in PowerShell:"
    Write-Host "    cd $InstallPath"
    Write-Host "    npm run daily-sync"
} elseif ($SkipInitialSync) {
    Write-Host "  Excel files are present. Initial sync skipped because -SkipInitialSync was set."
} else {
    Write-Host "  Excel files found. Triggering the scheduled task now..."
    Start-ScheduledTask -TaskName $TaskName

    $timeout = New-TimeSpan -Minutes 8
    $start = Get-Date
    do {
        Start-Sleep -Seconds 5
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        if ((Get-Date) - $start -gt $timeout) {
            Write-Host "  Sync still running after 8 minutes. Check $InstallPath\daily-sync.log later." -ForegroundColor Yellow
            break
        }
    } while ($info.LastTaskResult -eq 267009)

    if ($info.LastTaskResult -eq 0) {
        Write-Host "  Test sync succeeded. Log: $InstallPath\daily-sync.log" -ForegroundColor Green
    } else {
        Write-Host "  Test sync finished with code $($info.LastTaskResult). Check $InstallPath\daily-sync.log" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  Setup complete."
Write-Host "==============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Daily routine:"
Write-Host "  1. Owner edits Metals.xlsx or PartsbookBenji2014.xlsx."
Write-Host "  2. Owner saves and closes Excel."
Write-Host "  3. Daily sync refreshes website data, catalogue files, and PDFs."
Write-Host "  4. Metals invoice stays unchanged; Mini invoice keeps using Partsbook prices."
Write-Host ""
Write-Host "Master folder:   $masterFolder"
Write-Host "Customer folder: $customerFolder"
Write-Host "Manual sync:     $manualSyncButton"
Write-Host "Log file:        $InstallPath\daily-sync.log"
