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
    [string]$Source = "final-deliverables\Metals catalogue 2023.xlsx",
    [string]$Output = "public\catalogue\metals-catalogue.pdf",
    [string[]]$HideSheets = @("_PriceLookup", "_ReviewMe")
)

$ErrorActionPreference = "Stop"

# Resolve to absolute paths from the script's parent dir (project root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$srcAbs = Join-Path $projectRoot $Source
$outAbs = Join-Path $projectRoot $Output

if (-not (Test-Path $srcAbs)) {
    Write-Host "ERROR: source file not found: $srcAbs" -ForegroundColor Red
    Write-Host "  Run 'npm run sync-excel' first to generate the wired catalogue."
    exit 1
}

# Ensure the output directory exists
$outDir = Split-Path -Parent $outAbs
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

Write-Host "Opening $srcAbs in Excel..."
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AskToUpdateLinks = $false

try {
    $wb = $excel.Workbooks.Open($srcAbs, 0, $true)  # 0 = update links no, $true = read-only

    # Remember original sheet states so we can restore them
    $originalStates = @{}
    foreach ($sheetName in $HideSheets) {
        try {
            $sheet = $wb.Sheets.Item($sheetName)
            $originalStates[$sheetName] = $sheet.Visible
            # 0 = xlSheetHidden — owner can still unhide via right-click
            $sheet.Visible = 0
        } catch {
            Write-Host "  (sheet '$sheetName' not present — skipping hide)"
        }
    }

    Write-Host "Exporting to $outAbs..."
    # ExportAsFixedFormat: 0 = xlTypePDF, $true = open after publish (we say no)
    $wb.ExportAsFixedFormat(
        0,             # type = xlTypePDF
        $outAbs,       # filename
        0,             # quality = xlQualityStandard
        $true,         # include doc properties
        $false,        # ignore print areas - false means RESPECT print areas
        [Type]::Missing,
        [Type]::Missing,
        $false         # OpenAfterPublish
    )

    # Restore the original visibility (so the next run starts clean)
    foreach ($sheetName in $originalStates.Keys) {
        $wb.Sheets.Item($sheetName).Visible = $originalStates[$sheetName]
    }

    $wb.Close($false)  # don't save
    Write-Host "  ✓ PDF written"
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
