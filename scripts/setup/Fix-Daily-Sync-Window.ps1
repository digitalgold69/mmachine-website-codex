# Fix-Daily-Sync-Window.ps1
# Repairs an existing install where the scheduled task still opens a console.

param(
    [string]$InstallPath = "C:\mmachine"
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Run this script as Administrator." -ForegroundColor Red
    exit 1
}

$TaskName = "M-Machine Daily Sync"
$SetupPath = Join-Path $InstallPath "scripts\setup"
$SyncScriptPath = Join-Path $SetupPath "daily-sync.ps1"
$HiddenLauncherPath = Join-Path $SetupPath "daily-sync.vbs"

if (-not (Test-Path $SyncScriptPath)) {
    Write-Host "Cannot find $SyncScriptPath. Check the install path." -ForegroundColor Red
    exit 1
}

$HiddenLauncherContent = @"
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$SyncScriptPath""", 0, False
"@
Set-Content -Path $HiddenLauncherPath -Value $HiddenLauncherContent -Encoding ASCII

$CompatBatPath = Join-Path $SetupPath "daily-sync.bat"
$CompatBatContent = @"
@echo off
wscript.exe //B //Nologo "$HiddenLauncherPath"
exit /b 0
"@
Set-Content -Path $CompatBatPath -Value $CompatBatContent -Encoding ASCII

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "//B //Nologo `"$HiddenLauncherPath`""
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Hidden

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $existing.Triggers `
    -Principal $existing.Principal `
    -Settings $settings `
    -Description "Daily noon sync for M-Machine: refresh website data, catalogue files, PDFs, and push to GitHub." `
    -Force | Out-Null

Write-Host "M-Machine Daily Sync now runs through a hidden launcher." -ForegroundColor Green
