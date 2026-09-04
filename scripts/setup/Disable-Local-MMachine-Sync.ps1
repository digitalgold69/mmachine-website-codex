$ErrorActionPreference = "Stop"

$InstallPath = "C:\mmachine"
$TaskName = "M-Machine Daily Sync"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupPath = "C:\mmachine-disabled-$Stamp"

function Remove-DesktopItem {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer) {
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            [System.IO.Directory]::Delete($item.FullName, $false)
        } else {
            Remove-Item -LiteralPath $item.FullName -Force -Recurse
        }
    } else {
        Remove-Item -LiteralPath $item.FullName -Force
    }
}

Write-Host ""
Write-Host "Disable old M-Machine local sync" -ForegroundColor Cyan
Write-Host ""
Write-Host "This runs on computer: $env:COMPUTERNAME"
Write-Host ""
Write-Host "It will:"
Write-Host "  - remove the local daily scheduled sync task"
Write-Host "  - remove the local M-Machine desktop shortcuts/links"
Write-Host "  - move C:\mmachine to $BackupPath if it exists"
Write-Host ""
Write-Host "It does not permanently delete the old files."
Write-Host ""

$confirm = Read-Host "Type DISABLE to continue"
if ($confirm -ne "DISABLE") {
    Write-Host "Cancelled. Nothing was changed." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Removed scheduled task if it existed: $TaskName" -ForegroundColor Green

foreach ($itemName in @(
    "M-Machine Master Files",
    "M-Machine Customer Files",
    "Run M-Machine Sync Now.lnk",
    "Run M-Machine Sync Now.bat",
    "M-Machine Instructions.txt"
)) {
    $itemPath = Join-Path $DesktopPath $itemName
    if (Test-Path -LiteralPath $itemPath) {
        try {
            Remove-DesktopItem -Path $itemPath
            Write-Host "Removed desktop item: $itemName" -ForegroundColor Gray
        } catch {
            Write-Host "Could not remove desktop item: $itemName" -ForegroundColor Yellow
        }
    }
}

if (Test-Path -LiteralPath $InstallPath) {
    if (Test-Path -LiteralPath $BackupPath) {
        Write-Host "Backup path already exists, leaving C:\mmachine in place: $BackupPath" -ForegroundColor Yellow
    } elseif ($PSScriptRoot.StartsWith($InstallPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Host "C:\mmachine was not moved because this script is running from inside it." -ForegroundColor Yellow
        Write-Host "Run this helper from the setup kit/USB if you want it moved aside."
    } else {
        Move-Item -LiteralPath $InstallPath -Destination $BackupPath
        Write-Host "Moved old install to: $BackupPath" -ForegroundColor Green
    }
} else {
    Write-Host "No C:\mmachine folder found on this computer." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Old local sync is disabled on this computer." -ForegroundColor Green
Write-Host "Only run the new server setup while logged into the server itself."
Write-Host ""
Read-Host "Press Enter to close"
