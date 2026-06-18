param(
    [string]$InstallPath = "C:\mmachine",
    [string]$RepoUrl = "https://github.com/digitalgold69/mmachine-website-codex.git"
)

$ErrorActionPreference = "Stop"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "never"
$env:GIT_ASKPASS = "echo"

if (-not (Test-Path (Join-Path $InstallPath ".git"))) {
    Write-Host "Cannot find the M-Machine installation at $InstallPath." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

$secureToken = Read-Host "Paste the new GitHub token" -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "No token was entered."
    }

    $basicAuth = [Convert]::ToBase64String(
        [Text.Encoding]::ASCII.GetBytes("x-access-token:$token")
    )

    git -C $InstallPath remote set-url origin $RepoUrl
    git -C $InstallPath config --local credential.interactive never
    git -C $InstallPath config --local core.askPass ""
    git -C $InstallPath config --local --unset-all http.https://github.com/.extraheader 2>$null
    git -C $InstallPath config --local http.https://github.com/.extraheader "AUTHORIZATION: basic $basicAuth"

    Write-Host "Checking repository write access ..."
    git -C $InstallPath push --dry-run origin HEAD:main
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub rejected the token. It needs Contents: Read and write access to mmachine-website-codex."
    }

    Write-Host ""
    Write-Host "GitHub token updated successfully." -ForegroundColor Green
    Write-Host "Run M-Machine Sync Now can now publish website updates."
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($tokenPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    }
    $token = $null
    $basicAuth = $null
}

Read-Host "Press Enter to close"
