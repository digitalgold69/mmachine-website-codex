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
#        Run M-Machine Sync Now
#        M-Machine Instructions.txt
#   5. Creates a daily Windows Scheduled Task at noon.
#
# Daily sync behaviour:
#   - Website data updates from Metals.xlsx and PartsbookBenji2014.xlsx.
#   - Customer catalogue files are rebuilt with fresh prices.
#   - Invoice templates keep the owner's normal workflow.
#   - Catalogue PDFs are exported and pushed to GitHub for deployment.
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
$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "never"
$env:GIT_ASKPASS = "echo"

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

function Set-GitNonInteractiveAuth {
    param([string]$Url, [string]$Token)

    $basicAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$Token"))

    git remote set-url origin $Url
    git config --local user.name "M-Machine Daily Sync"
    git config --local user.email "metals@m-machine.co.uk"

    # Force this repo to use the supplied token directly. This avoids Windows
    # Git Credential Manager asking the owner to choose a GitHub account.
    git config --local --unset-all credential.helper 2>$null
    git config --local credential.interactive never
    git config --local core.askPass ""
    git config --local --unset-all http.https://github.com/.extraheader 2>$null
    git config --local http.https://github.com/.extraheader "AUTHORIZATION: basic $basicAuth"
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

function Test-ExcelPdfExport {
    $excel = $null
    $workbook = $null
    $worksheet = $null
    $testRoot = Join-Path $env:TEMP (
        "m-machine-excel-test-" + [Guid]::NewGuid().ToString("N")
    )
    $testPdf = Join-Path $testRoot "license-test.pdf"
    $stage = "starting Microsoft Excel"
    $script:ExcelPdfTestVersion = "unknown"
    $script:ExcelPdfTestDetail = ""

    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

    try {
        $excel = New-Object -ComObject Excel.Application
        $script:ExcelPdfTestVersion = [string]$excel.Version
        $excel.Visible = $false
        $excel.DisplayAlerts = $false

        $stage = "creating a temporary workbook"
        $workbook = $excel.Workbooks.Add()
        $worksheet = $workbook.Worksheets.Item(1)
        $worksheet.Range("A1").Value2 = "M-Machine Excel PDF test"

        # Excel 2007's COM automation is less forgiving about omitted optional
        # arguments. Use the complete ExportAsFixedFormat signature and avoid
        # an unrelated SaveAs operation; the production sync exports existing
        # workbooks directly and does not need this test workbook saved.
        $stage = "exporting a PDF"
        $workbook.ExportAsFixedFormat(
            0,
            $testPdf,
            0,
            $true,
            $false,
            [Type]::Missing,
            [Type]::Missing,
            $false,
            [Type]::Missing
        )

        if (-not (Test-Path $testPdf)) {
            $script:ExcelPdfTestDetail = (
                "Excel $($script:ExcelPdfTestVersion) returned without creating the test PDF."
            )
            return $false
        }
        return ((Get-Item $testPdf).Length -gt 0)
    } catch {
        $script:ExcelPdfTestDetail = (
            "$stage failed in Excel $($script:ExcelPdfTestVersion): " +
            $_.Exception.Message
        )
        Write-Host "  Excel PDF test failed: $($script:ExcelPdfTestDetail)" -ForegroundColor Red
        return $false
    } finally {
        if ($worksheet) {
            [Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet) | Out-Null
        }
        if ($workbook) {
            try { $workbook.Close($false) } catch {}
            [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
        }
        if ($excel) {
            try { $excel.Quit() } catch {}
            [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
        }
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
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

Write-Host "  Checking Microsoft Excel PDF export ..."
if (Test-ExcelPdfExport) {
    Write-Host (
        "  Microsoft Excel $ExcelPdfTestVersion PDF export is working"
    ) -ForegroundColor Green
} else {
    Exit-WithMessage (
        "Microsoft Excel could not complete the PDF test. " +
        "$ExcelPdfTestDetail " +
        "Excel 2007 is supported when its Save as PDF/XPS feature is installed."
    )
}

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
    Set-GitNonInteractiveAuth -Url $RepoUrl -Token $GitHubToken
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
Set-GitNonInteractiveAuth -Url $RepoUrl -Token $GitHubToken
# Owner installations always use the activated Excel path. The optional
# LibreOffice marker is only for separate test machines.
Remove-Item -LiteralPath (Join-Path $InstallPath ".use-libreoffice-pdf") `
    -Force -ErrorAction SilentlyContinue
Write-Host "  Checking that the GitHub token can publish updates ..."
git push --dry-run origin HEAD:main
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Exit-WithMessage "The GitHub token cannot write to this repo. Create a fine-grained token for mmachine-website-codex with Contents set to Read and write."
}
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
$manualSyncButton = Join-Path $desktopPath "Run M-Machine Sync Now.lnk"
$ownerInstructions = Join-Path $desktopPath "M-Machine Instructions.txt"
$dataSourcePath = Join-Path $InstallPath "data-source"
$finalPath = Join-Path $InstallPath "final-deliverables"

Create-FolderLink -LinkPath $masterFolder -TargetPath $dataSourcePath -Purpose "put master Excel files here"
Create-FolderLink -LinkPath $customerFolder -TargetPath $finalPath -Purpose "open refreshed customer files here"

$SyncScriptPath = Join-Path $InstallPath "scripts\setup\daily-sync.ps1"
$SyncScriptContent = @"
param(
    [switch]`$Manual
)

`$ErrorActionPreference = "Stop"
`$InstallPath = "$InstallPath"
`$Log = "$InstallPath\daily-sync.log"

`$env:PYTHONIOENCODING = "utf-8:replace"
`$env:GIT_TERMINAL_PROMPT = "0"
`$env:GCM_INTERACTIVE = "never"
`$env:GIT_ASKPASS = "echo"

function Write-Log {
    param([string]`$Message)
    Add-Content -Path `$Log -Value "[`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] `$Message"
}

try {
    `$LockStream = [System.IO.File]::Open(
        "$InstallPath\daily-sync.lock",
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
} catch {
    Write-Log "Sync skipped because another M-Machine sync is already running"
    exit 2
}

if (`$Manual) {
    try {
        `$PopupShell = New-Object -ComObject WScript.Shell
        `$null = `$PopupShell.Popup(
            "M-Machine sync has started. You can carry on using the computer.",
            4,
            "M-Machine Sync",
            64
        )
        [Runtime.InteropServices.Marshal]::ReleaseComObject(`$PopupShell) | Out-Null
    } catch {}
}

function Invoke-LoggedCommand {
    param(
        [string]`$Name,
        [scriptblock]`$Command
    )

    Write-Log `$Name
    # Windows PowerShell 5 can treat harmless native stderr output, including
    # Git progress messages, as a terminating error. Log every line and use
    # the actual process exit code as the source of truth.
    `$PreviousErrorActionPreference = `$ErrorActionPreference
    `$ErrorActionPreference = "Continue"
    try {
        & `$Command 2>&1 | ForEach-Object {
            Add-Content -Path `$Log -Value ([string]`$_) -Encoding UTF8
        }
        `$CommandExitCode = `$LASTEXITCODE
    } finally {
        `$ErrorActionPreference = `$PreviousErrorActionPreference
    }
    if (`$CommandExitCode -ne 0) {
        Write-Log "`$Name failed with exit code `$CommandExitCode"
        exit `$CommandExitCode
    }
}

Set-Location `$InstallPath
Add-Content -Path `$Log -Value ""
Add-Content -Path `$Log -Value "=============================================="
Write-Log "Starting daily sync"
Add-Content -Path `$Log -Value "=============================================="

Invoke-LoggedCommand "Pulling latest website code" { git pull --rebase --autostash }
Invoke-LoggedCommand "Refreshing website data, catalogues, invoices, and PDFs" { npm run daily-sync }
Invoke-LoggedCommand "Staging generated website files" { git add lib/mini-data.ts lib/metals-data.ts lib/catalogue-versions.ts data-source/.metal-codes.json data-source/.metal-links.json data-source/.metal-catalogue-codes.json public/catalogue }

git diff --cached --quiet >> `$Log 2>&1
`$diffExit = `$LASTEXITCODE

if (`$diffExit -eq 1) {
    Invoke-LoggedCommand "Committing generated changes" { git commit -m "Daily sync `$((Get-Date).ToString('yyyy-MM-dd'))" }
    Invoke-LoggedCommand "Pushing to GitHub for website deployment" { git push origin HEAD:main }
} elseif (`$diffExit -eq 0) {
    Write-Log "No website changes to commit"
} else {
    Write-Log "git diff failed with exit code `$diffExit"
    exit `$diffExit
}

Write-Log "Daily sync done"
`$LockStream.Dispose()
"@
Set-Content -Path $SyncScriptPath -Value $SyncScriptContent -Encoding ASCII

$CompatBatPath = Join-Path $InstallPath "scripts\setup\daily-sync.bat"
$HiddenLauncherPath = Join-Path $InstallPath "scripts\setup\daily-sync.vbs"
$ManualLauncherPath = Join-Path $InstallPath "scripts\setup\manual-sync.vbs"
$HiddenLauncherContent = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$SyncScriptPath""", 0, False
"@
Set-Content -Path $HiddenLauncherPath -Value $HiddenLauncherContent -Encoding ASCII

$ManualLauncherContent = @"
Set shell = CreateObject("WScript.Shell")
exitCode = shell.Run("powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$SyncScriptPath"" -Manual", 0, True)
If exitCode = 0 Then
    shell.Popup "M-Machine sync finished successfully. Customer files and the website update have been prepared.", 8, "M-Machine Sync", 64
ElseIf exitCode = 2 Then
    shell.Popup "An M-Machine sync is already running. Wait for it to finish before starting a separate manual test.", 12, "M-Machine Sync", 48
Else
    Set fileSystem = CreateObject("Scripting.FileSystemObject")
    logText = ""
    If fileSystem.FileExists("C:\mmachine\daily-sync.log") Then
        Set logFile = fileSystem.OpenTextFile("C:\mmachine\daily-sync.log", 1, False)
        logText = logFile.ReadAll
        logFile.Close
    End If
    If InStr(1, logText, "LibreOffice is not installed", 1) > 0 Or InStr(1, logText, "Excel export unavailable", 1) > 0 Then
        shell.Popup "Microsoft Excel could not export the catalogue PDFs. Close Excel and try once more. If it still fails, please ask Guy to check it.", 15, "M-Machine Sync", 16
    Else
        shell.Popup "M-Machine sync stopped before publishing. Please check C:\mmachine\daily-sync.log.", 12, "M-Machine Sync", 16
    End If
End If
"@
Set-Content -Path $ManualLauncherPath -Value $ManualLauncherContent -Encoding ASCII

$CompatBatContent = @"
@echo off
wscript.exe //B //Nologo "$HiddenLauncherPath"
exit /b 0
"@
Set-Content -Path $CompatBatPath -Value $CompatBatContent -Encoding ASCII

$oldManualBat = Join-Path $desktopPath "Run M-Machine Sync Now.bat"
Remove-Item -Path $oldManualBat -Force -ErrorAction SilentlyContinue

$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($manualSyncButton)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "//Nologo `"$ManualLauncherPath`""
$shortcut.WorkingDirectory = $InstallPath
$shortcut.WindowStyle = 7
$shortcut.Description = "Run the M-Machine website and catalogue sync"
$shortcut.Save()

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

Run M-Machine Sync Now

Finished customer files appear in:

M-Machine Customer Files
"@
Set-Content -Path $ownerInstructions -Value $OwnerInstructionsContent -Encoding ASCII

$TaskName = "M-Machine Daily Sync"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B //Nologo `"$HiddenLauncherPath`""
$Trigger = New-ScheduledTaskTrigger -Daily -At $DailyRunTime
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Principal $Principal `
    -Settings $Settings `
    -Description "Daily noon sync for M-Machine: refresh website data, catalogue files, PDFs, and push to GitHub."

Write-Host "  Scheduled task registered: $TaskName at $DailyRunTime daily" -ForegroundColor Green
Write-Host "  Manual sync shortcut created: Run M-Machine Sync Now" -ForegroundColor Green
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
