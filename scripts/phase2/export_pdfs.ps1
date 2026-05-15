# Export-PDFs.ps1
#
# Converts refreshed catalogue workbooks to PDFs using Microsoft Excel.
# Excel is used because it preserves the owner's existing logo, page layout,
# headers, footers, and print areas more reliably than headless converters.
#
# Run:
#   powershell -ExecutionPolicy Bypass -File scripts\phase2\export_pdfs.ps1

param(
    [string]$Source = "final-deliverables\Metals catalogue 2023.xlsx",
    [string]$Output = "public\catalogue\metals-catalogue.pdf",
    [string[]]$HideSheets = @("_PriceLookup", "_ReviewMe"),

    [string]$Source2 = "final-deliverables\Mini Catalogue Self Updating.xlsm",
    [string]$Output2 = "public\catalogue\mini-catalogue.pdf",
    [string[]]$HideSheets2 = @("_PriceLookup")
)

$ErrorActionPreference = "Stop"

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
        Write-Host "  source file not found: $SourcePath - skipping" -ForegroundColor Yellow
        return
    }

    $outDir = Split-Path -Parent $OutputPath
    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    }

    Write-Host "Exporting $SourcePath -> $OutputPath ..."
    $wb = $Excel.Workbooks.Open($SourcePath, 0, $true)
    $originalStates = @{}

    try {
        foreach ($sn in $SheetsToHide) {
            try {
                $sheet = $wb.Sheets.Item($sn)
                $originalStates[$sn] = $sheet.Visible
                $sheet.Visible = 0
            } catch {
                Write-Host "  sheet '$sn' not present - skipping hide"
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
        Write-Host "  PDF written"
    } finally {
        foreach ($sn in $originalStates.Keys) {
            try {
                $wb.Sheets.Item($sn).Visible = $originalStates[$sn]
            } catch {
                Write-Host "  warning: could not restore visibility for $sn" -ForegroundColor Yellow
            }
        }
        $wb.Close($false)
    }
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
