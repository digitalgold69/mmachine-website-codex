$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/digitalgold69/mmachine-website-codex.git"
$sourceSetupScript = Join-Path $PSScriptRoot "Setup-Owner-Machine.ps1"
$localSetupRoot = Join-Path $env:TEMP (
    "m-machine-owner-setup-" + [Guid]::NewGuid().ToString("N")
)
$localSetupScript = Join-Path $localSetupRoot "Setup-Owner-Machine.ps1"

function Read-GitHubToken {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "M-Machine GitHub access"
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.ClientSize = New-Object System.Drawing.Size(540, 170)
    $form.TopMost = $true

    $label = New-Object System.Windows.Forms.Label
    $label.Location = New-Object System.Drawing.Point(18, 16)
    $label.Size = New-Object System.Drawing.Size(500, 42)
    $label.Text = (
        "Paste the GitHub token below. It will be hidden and checked before " +
        "the installation changes any stored GitHub credentials."
    )
    $form.Controls.Add($label)

    $textBox = New-Object System.Windows.Forms.TextBox
    $textBox.Location = New-Object System.Drawing.Point(20, 66)
    $textBox.Size = New-Object System.Drawing.Size(500, 24)
    $textBox.UseSystemPasswordChar = $true
    $form.Controls.Add($textBox)

    $status = New-Object System.Windows.Forms.Label
    $status.Location = New-Object System.Drawing.Point(20, 96)
    $status.Size = New-Object System.Drawing.Size(330, 34)
    $status.ForeColor = [System.Drawing.Color]::Firebrick
    $form.Controls.Add($status)

    $okButton = New-Object System.Windows.Forms.Button
    $okButton.Text = "Continue"
    $okButton.Location = New-Object System.Drawing.Point(350, 112)
    $okButton.Size = New-Object System.Drawing.Size(80, 30)
    $form.Controls.Add($okButton)

    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Location = New-Object System.Drawing.Point(440, 112)
    $cancelButton.Size = New-Object System.Drawing.Size(80, 30)
    $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($cancelButton)

    $form.CancelButton = $cancelButton
    $script:acceptedToken = $null
    $okButton.Add_Click({
        $candidate = $textBox.Text.Trim()
        if (
            $candidate.Length -lt 30 -or
            $candidate -notmatch "^(github_pat_|ghp_)[A-Za-z0-9_]+$"
        ) {
            $status.Text = (
                "That does not look like a complete GitHub token. " +
                "Copy the full token and paste it again."
            )
            $textBox.SelectAll()
            $textBox.Focus()
            return
        }
        $script:acceptedToken = $candidate
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    })

    $form.Add_Shown({
        $textBox.Focus()
    })
    $result = $form.ShowDialog()
    $form.Dispose()

    if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
        throw "Setup was cancelled before a GitHub token was entered."
    }
    return $script:acceptedToken
}

function Confirm-InstallMachine {
    Write-Host ""
    Write-Host "IMPORTANT" -ForegroundColor Yellow
    Write-Host "This setup installs the daily sync on THIS Windows computer:"
    Write-Host ""
    Write-Host "  $env:COMPUTERNAME" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Running this setup from a network/server folder does not install it on the server."
    Write-Host "To make the server run the daily sync, log into the server first, then run this setup there."
    Write-Host ""
    Write-Host "Continue only if the computer name above is the machine that should run the daily M-Machine sync."
    Write-Host ""

    $answer = Read-Host "Type YES to continue"
    if ($answer -ne "YES") {
        throw "Setup cancelled before installation. Run it again on the machine that should run the daily sync."
    }
}

Write-Host ""
Write-Host "M-Machine owner setup" -ForegroundColor Cyan
Write-Host "This installs the website sync system to C:\mmachine on the current computer."
Write-Host ""
Write-Host "This installs from the separate Codex GitHub repo, leaving Claude's original repo alone."
Write-Host ""

try {
    Confirm-InstallMachine
    $token = Read-GitHubToken

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
    $script:acceptedToken = $null
    $token = $null
    Remove-Item -LiteralPath $localSetupRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Read-Host "Press Enter to close"
