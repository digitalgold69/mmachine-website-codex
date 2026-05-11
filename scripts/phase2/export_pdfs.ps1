# Export-PDFs.ps1 — convert the wired Excel files to PDFs using Excel itself.
#
# Why use Excel and not LibreOffice?
#   The owner's existing PDFs were made by Excel's PDF export. Excel renders
#   vector logos (EMF/WMF), print settings, and headers/footers exactly as
#   she sees them on screen. LibreOffice's headless export produces minor
#   logo-rendering artifacts on the M-Machine letterhead. So this script
#   uses Excel's COM automation interface for byte-perfect output.
#
# What it does:
#   1. Open final-deliverables\Metals catalogue 2023.xlsx in Excel
#   2. Hide the helper sheets (_PriceLookup, _ReviewMe) so they don't print
#   3. Export the visible sheets as one PDF
#   4. Save to public\catalogue\metals-catalogue.pdf for the website
#   5. Restore sheet visibility, close Excel
#
# Run: powershell -ExecutionPolicy Bypass -File scripts\phase2\export_pdfs.ps1
#
# Requires: Microsoft Excel installed (any 2013+ version)

param(
    # First file to export (metals).
    [string]$Source = "final-deliverables\Metals catalogue 2023.xlsx",
    [string]$Output = "public\catalogue\metals-catalogue.pdf",
    [string[]]$HideSheets = @("_PriceLookup", "_ReviewMe"),

    # Second file (mini). Set to "" to skip the second export.
    [string]$Source2 = "final-deliverables\Mini Catalogue Self Updating.xlsm",
    [string]$Output2 = "public\catalogue\mini-catalogue.pdf",
    [string[]]$HideSheets2 = @("_PriceLookup")
)

$ErrorActionPreference = "Stop"

# Resolve to absolute paths from the script's parent dir (project root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

function Export-CatalogueToPdf {
    param(
        [Parameter(Mandatory)] $Excel,
        [Parameter(Mandatory)] [string]$SourcePath,
        [Parameter(Mandatory)] [string]$OutputPath,
        [string[]]$SheetsToHide = @()
    )
    if (-not (Test-Path $SourcePath)) {
        Write-Host "  ! source file not found: $SourcePath — skipping" -ForegroundColor Yellow
        return
    }
    $outDir = Split-Path -Parent $OutputPath
    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    }
    Write-Host "Exporting $SourcePath -> $OutputPath ..."
    $wb = $Excel.Workbooks.Open($SourcePath, 0, $true)
    try {
        $originalStates = @{}
        foreach ($sn in $SheetsToHide) {
            try {
                $sheet = $wb.Sheets.Item($sn)
                $originalStates[$sn] = $sheet.Visible
                $sheet.Visible = 0
            } catch {
                Write-Host "  (sheet '$sn' not present — skipping hide)"
            }
        }
        $wb.ExportAsFixedFormat(
            0,
            $OutputPath,
            0,
            $true,
            $false,
            [Type]::Missing,
            [Type]::Missing,
            $false
        )
        foreach ($sn in $originalStates.Keys) {
            $wb.Sheets.Item($sn).Visible = $originalStates[$sn]
        }
    } finally {
        $wb.Close($false)
    }
    Write-Host "  ✓ PDF written"
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AskToUpdateLinks = $false

try {
    Export-CatalogueToPdf -Excel $excel `
        -SourcePath (Join-Path $projectRoot $Source) `
        -OutputPath (Join-Path $projectRoot $Output) `
        -SheetsToHide $HideSheets

    if ($Source2 -ne "") {
        Export-CatalogueToPdf -Excel $excel `
            -SourcePath (Join-Path $projectRoot $Source2) `
            -OutputPath (Join-Path $projectRoot $Output2) `
            -SheetsToHide $HideSheets2
    }
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
