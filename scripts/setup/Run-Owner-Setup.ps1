$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/digitalgold69/mmachine-website-codex.git"
$sourceSetupScript = Join-Path $PSScriptRoot "Setup-Owner-Machine.ps1"
$localSetupRoot = Join-Path $env:TEMP (
    "m-machine-owner-setup-" + [Guid]::NewGuid().ToString("N")
)
$localSetupScript = Join-Path $localSetupRoot "Setup-Owner-Machine.ps1"

Write-Host ""
Write-Host "M-Machine owner setup" -ForegroundColor Cyan
Write-Host "This installs the website sync system to C:\mmachine."
Write-Host ""
Write-Host "This installs from the separate Codex GitHub repo, leaving Claude's original repo alone."
Write-Host ""

$secureToken = Read-Host "Paste the NEW GitHub token, then press Enter" -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "No token was entered."
    }

    New-Item -ItemType Directory -Path $localSetupRoot -Force | Out-Null
    Copy-Item -LiteralPath $sourceSetupScript -Destination $localSetupScript -Force

    # Run the main setup from the computer's local temporary folder. This
    # keeps removable-drive speed, permissions, and accidental disconnection
    # out of the installation once the launcher has started.
    & $localSetupScript -RepoUrl $repoUrl -GitHubToken $token
    if ($LASTEXITCODE -ne 0) {
        throw "Owner setup stopped with error code $LASTEXITCODE."
    }

    Write-Host ""
    Write-Host "Setup completed successfully." -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($tokenPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    }
    $token = $null
    Remove-Item -LiteralPath $localSetupRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Read-Host "Press Enter to close"
