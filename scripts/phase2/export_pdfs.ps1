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
    [string[]]$HideSheets = @("_PriceLookup"),

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
    $wb = $Excel.Workbooks.Open($SourcePath, 0, $false)
    $originalStates = @{}
    $exportSucceeded = $false

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

        foreach ($sheet in @($wb.Worksheets)) {
            try {
                if ($sheet.Visible -eq 0) { continue }
                if ($originalStates.ContainsKey($sheet.Name)) { continue }

                $printArea = [string]$sheet.PageSetup.PrintArea
                if ([string]::IsNullOrWhiteSpace($printArea)) {
                    $originalStates[$sheet.Name] = $sheet.Visible
                    $sheet.Visible = 0
                    Write-Host "  hiding non-print sheet '$($sheet.Name)'"
                }
            } catch {
                Write-Host "  warning: could not inspect sheet '$($sheet.Name)' for PDF export" -ForegroundColor Yellow
            }
        }

        $isMetalsCatalogue = $false
        try {
            $null = $wb.Worksheets.Item("Carriage Rates")
            $null = $wb.Worksheets.Item("Steel Tube")
            $isMetalsCatalogue = $true
        } catch {
            $isMetalsCatalogue = $false
        }

        if ($isMetalsCatalogue) {
            Write-Host "  applying metals catalogue PDF page layout"
            $dateCulture = [System.Globalization.CultureInfo]::GetCultureInfo("en-GB")
            $now = Get-Date
            $catalogueYear = $now.ToString("yyyy", $dateCulture)
            $catalogueMonth = $now.ToString("MMMM yyyy", $dateCulture)
            $catalogueHeader = "Metals Catalogue $catalogueYear"

            try {
                $wb.Worksheets.Item("Front sheet").Range("A19").Value2 = $catalogueMonth
            } catch {
                Write-Host "  warning: could not update metals cover date" -ForegroundColor Yellow
            }

            foreach ($sheet in @($wb.Worksheets)) {
                if ($sheet.Visible -eq 0) { continue }
                $printArea = [string]$sheet.PageSetup.PrintArea
                if ([string]::IsNullOrWhiteSpace($printArea)) { continue }

                $sheet.PageSetup.CenterHeader = $catalogueHeader

                if ($sheet.Name -eq "Carriage Rates") {
                    $sheet.PageSetup.PrintArea = '$A$1:$I$37'
                    continue
                }

                if ($sheet.Name -notin @("Front sheet", "T&Cs", "Conversion table")) {
                    $sheet.PageSetup.Zoom = 96
                }
            }
        }

        # The rebuilt catalogues contain fresh lookup tables, but Excel may
        # otherwise export old cached formula results. Calculate only sheets
        # that are actually printed; a full workbook rebuild can stall on
        # unrelated legacy external references in these old workbooks.
        Write-Host "  recalculating printable catalogue sheets"
        foreach ($sheet in @($wb.Worksheets)) {
            if ($sheet.Visible -eq 0) { continue }
            $printArea = [string]$sheet.PageSetup.PrintArea
            if ([string]::IsNullOrWhiteSpace($printArea)) { continue }
            try {
                $formulaCells = $sheet.UsedRange.SpecialCells(-4123) # xlCellTypeFormulas
                $formulaCells.Dirty()
            } catch {
                # This printable sheet has no formula cells.
            }
            $sheet.Calculate()
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
        $exportSucceeded = $true
    } finally {
        foreach ($sn in $originalStates.Keys) {
            try {
                $wb.Sheets.Item($sn).Visible = $originalStates[$sn]
            } catch {
                Write-Host "  warning: could not restore visibility for $sn" -ForegroundColor Yellow
            }
        }
        if ($exportSucceeded) {
            $wb.Save()
            Write-Host "  calculated catalogue workbook saved"
        }
        $wb.Close($false)
    }
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AskToUpdateLinks = $false
$excel.ScreenUpdating = $false
$excel.DisplayStatusBar = $false
$excel.EnableEvents = $false
$excel.Interactive = $false
$excel.UserControl = $false

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
