# Export-PDFs.ps1
#
# Converts refreshed catalogue workbooks to PDFs.
# Microsoft Excel is preferred on the owner's machine. LibreOffice is used as
# a tested fallback on machines where Excel is missing or not activated.
#
# Run:
#   powershell -ExecutionPolicy Bypass -File scripts\phase2\export_pdfs.ps1

param(
    [string]$Source = "final-deliverables\Metals catalogue 2023.xlsx",
    [string]$Output = "public\catalogue\metals-catalogue.pdf",
    [string[]]$HideSheets = @("_PriceLookup"),

    [string]$Source2 = "final-deliverables\Mini Catalogue Self Updating.xlsm",
    [string]$Output2 = "public\catalogue\mini-catalogue.pdf",
    [string[]]$HideSheets2 = @("_PriceLookup"),
    [string]$MiniMasterSource = "data-source\Mini Catalogue Self Updating.xlsm",
    [string]$MiniUpdateManifest = "final-deliverables\mini-catalogue-updates.json",

    [switch]$ForceLibreOffice
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
$libreOfficeMarker = Join-Path $projectRoot ".use-libreoffice-pdf"
$excelCompatibilityScript = Join-Path $scriptDir "excel_pdf_compat.ps1"
. $excelCompatibilityScript
$excelExportSucceeded = $false
$excelFailure = $null
if (
    $env:MMACHINE_FORCE_LIBREOFFICE -eq "1" -or
    (Test-Path $libreOfficeMarker)
) {
    $ForceLibreOffice = $true
}

function Get-LibreOfficeProgram {
    $roots = @(
        (Join-Path $env:ProgramFiles "LibreOffice\program"),
        (Join-Path ${env:ProgramFiles(x86)} "LibreOffice\program")
    )
    foreach ($root in $roots) {
        if ([string]::IsNullOrWhiteSpace($root)) { continue }
        $soffice = Join-Path $root "soffice.exe"
        $sofficeConsole = Join-Path $root "soffice.com"
        $python = Join-Path $root "python.exe"
        if ((Test-Path $soffice) -and (Test-Path $python)) {
            return @{
                Soffice = if (Test-Path $sofficeConsole) { $sofficeConsole } else { $soffice }
                Python = $python
            }
        }
    }
    return $null
}

function Export-CataloguesWithLibreOffice {
    $program = Get-LibreOfficeProgram
    if (-not $program) {
        throw "Microsoft Excel could not export the catalogue PDFs and LibreOffice is not installed. Install LibreOffice, then run M-Machine Sync again."
    }

    $metalsSource = Join-Path $projectRoot $Source
    $metalsOutput = Join-Path $projectRoot $Output
    $miniSource = Join-Path $projectRoot $Source2
    $miniOutput = Join-Path $projectRoot $Output2
    $fallbackScript = Join-Path $scriptDir "export_pdfs_libreoffice.py"
    $profileId = [Guid]::NewGuid().ToString("N")
    $profilePath = Join-Path $env:TEMP ("m-machine-libreoffice-" + $profileId)
    New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
    $profileUri = ([Uri]$profilePath).AbsoluteUri
    $temporaryMetalsOutput = Join-Path $profilePath "metals-catalogue.pdf"
    $temporaryMiniOutput = Join-Path $profilePath "mini-catalogue.pdf"
    $stdoutPath = Join-Path $profilePath "soffice-stdout.log"
    $stderrPath = Join-Path $profilePath "soffice-stderr.log"
    $port = Get-Random -Minimum 20000 -Maximum 45000
    $process = $null

    Write-Host "Microsoft Excel PDF export is unavailable; using LibreOffice fallback" -ForegroundColor Yellow
    try {
        $process = Start-Process `
            -FilePath $program.Soffice `
            -ArgumentList @(
                "--headless",
                "-env:UserInstallation=$profileUri",
                "--accept=socket,host=127.0.0.1,port=$port;urp;StarOffice.ServiceManager",
                "--norestore",
                "--nodefault",
                "--nofirststartwizard"
            ) `
            -WindowStyle Hidden `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -PassThru

        & $program.Python `
            $fallbackScript `
            $port `
            $metalsSource `
            $temporaryMetalsOutput `
            $miniSource `
            $temporaryMiniOutput
        if ($LASTEXITCODE -ne 0) {
            if (Test-Path $stderrPath) {
                Get-Content $stderrPath | Write-Host
            }
            throw "LibreOffice could not export the catalogue PDFs."
        }
        foreach ($pdf in @($temporaryMetalsOutput, $temporaryMiniOutput)) {
            if (-not (Test-Path $pdf)) {
                throw "LibreOffice did not create the expected PDF: $pdf"
            }
            if ((Get-Item $pdf).Length -lt 10000) {
                throw "LibreOffice created an incomplete PDF: $pdf"
            }
        }
        Move-Item -LiteralPath $temporaryMetalsOutput -Destination $metalsOutput -Force
        Move-Item -LiteralPath $temporaryMiniOutput -Destination $miniOutput -Force
        Write-Host "LibreOffice fallback wrote both catalogue PDFs" -ForegroundColor Green
    } finally {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -like "*$profileId*" } |
            ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
        Remove-Item -LiteralPath $profilePath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

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
    $openResult = Open-ExcelWorkbookCompatible `
        -Excel $Excel `
        -Path $SourcePath `
        -ReadOnly $false
    $wb = $openResult.Workbook
    Write-Host "  workbook opened ($($openResult.Method))"
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

        $pdfMethod = Invoke-ExcelWorkbookPdfExport `
            -Workbook $wb `
            -OutputPath $OutputPath `
            -MinimumBytes 10000
        Write-Host "  PDF written ($pdfMethod)"
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

if ($ForceLibreOffice) {
    Export-CataloguesWithLibreOffice
    exit 0
}

function Export-WithFreshExcel {
    param(
        [Parameter(Mandatory)] [string]$SourcePath,
        [Parameter(Mandatory)] [string]$OutputPath,
        [string[]]$SheetsToHide = @()
    )

    $excel = $null
    try {
        $excel = New-Object -ComObject Excel.Application
        Set-ExcelAutomationOptions -Excel $excel

        Export-CatalogueToPdf -Excel $excel `
            -SourcePath $SourcePath `
            -OutputPath $OutputPath `
            -SheetsToHide $SheetsToHide
    } finally {
        if ($excel) {
            try { $excel.Quit() } catch {}
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        }
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
    }
}

function Export-MiniCatalogueWithExcel {
    param(
        [Parameter(Mandatory)] [string]$MasterSourcePath,
        [Parameter(Mandatory)] [string]$CustomerOutputPath,
        [Parameter(Mandatory)] [string]$ManifestPath,
        [Parameter(Mandatory)] [string]$PdfOutputPath
    )

    foreach ($requiredPath in @($MasterSourcePath, $ManifestPath)) {
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            throw "Mini catalogue export needs this file: $requiredPath"
        }
    }

    $customerDirectory = Split-Path -Parent $CustomerOutputPath
    $pdfDirectory = Split-Path -Parent $PdfOutputPath
    New-Item -ItemType Directory -Path $customerDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path $pdfDirectory -Force | Out-Null

    $temporaryCustomer = Join-Path $customerDirectory (
        ".mini-catalogue-" + [Guid]::NewGuid().ToString("N") + ".xlsm"
    )
    $manifest = Get-Content -LiteralPath $ManifestPath -Raw |
        ConvertFrom-Json
    $excel = $null
    $workbook = $null
    $sheetCache = @{}
    $originalStates = @{}
    $completed = $false

    Write-Host (
        "Exporting $MasterSourcePath -> $PdfOutputPath " +
        "and $CustomerOutputPath ..."
    )

    try {
        $excel = New-Object -ComObject Excel.Application
        Set-ExcelAutomationOptions -Excel $excel
        $openResult = Open-ExcelWorkbookCompatible `
            -Excel $excel `
            -Path $MasterSourcePath `
            -ReadOnly $true
        $workbook = $openResult.Workbook
        Write-Host "  original Mini workbook opened ($($openResult.Method))"

        foreach ($update in $manifest.updates) {
            $sheetName = [string]$update.sheet
            if (-not $sheetCache.ContainsKey($sheetName)) {
                $sheetCache[$sheetName] = $workbook.Worksheets.Item($sheetName)
            }
            $sheetCache[$sheetName].Range([string]$update.cell).Value2 = $update.value
        }
        Write-Host "  applied $($manifest.updates.Count) current price cells"

        try {
            $links = $workbook.LinkSources(1) # xlLinkTypeExcelLinks
            if ($links) {
                foreach ($link in @($links)) {
                    $workbook.BreakLink([string]$link, 1)
                }
                Write-Host "  removed external Partsbook link"
            }
        } catch {
            Write-Host (
                "  warning: Excel could not enumerate external links: " +
                $_.Exception.Message
            ) -ForegroundColor Yellow
        }

        # SaveCopyAs lets Excel itself write the macro workbook while the
        # original master remains read-only and untouched.
        $workbook.SaveCopyAs($temporaryCustomer)
        if (
            -not (Test-Path -LiteralPath $temporaryCustomer) -or
            (Get-Item -LiteralPath $temporaryCustomer).Length -lt 100000
        ) {
            throw "Excel did not create a valid Mini customer workbook."
        }
        Write-Host "  Excel-native Mini customer workbook prepared"

        foreach ($sheet in @($workbook.Worksheets)) {
            try {
                if ($sheet.Visible -eq 0) { continue }
                $printArea = [string]$sheet.PageSetup.PrintArea
                if ([string]::IsNullOrWhiteSpace($printArea)) {
                    $originalStates[$sheet.Name] = $sheet.Visible
                    $sheet.Visible = 0
                }
            } catch {}
        }

        $pdfMethod = Invoke-ExcelWorkbookPdfExport `
            -Workbook $workbook `
            -OutputPath $PdfOutputPath `
            -MinimumBytes 10000
        Write-Host "  Mini PDF written ($pdfMethod)"
        $completed = $true
    } finally {
        if ($workbook) {
            foreach ($sheetName in $originalStates.Keys) {
                try {
                    $workbook.Worksheets.Item($sheetName).Visible = (
                        $originalStates[$sheetName]
                    )
                } catch {}
            }
        }
        foreach ($sheet in $sheetCache.Values) {
            try {
                [Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) |
                    Out-Null
            } catch {}
        }
        if ($workbook) {
            try { $workbook.Close($false) } catch {}
            try {
                [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) |
                    Out-Null
            } catch {}
        }
        if ($excel) {
            try { $excel.Quit() } catch {}
            try {
                [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) |
                    Out-Null
            } catch {}
        }
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()

        if ($completed) {
            Move-Item -LiteralPath $temporaryCustomer `
                -Destination $CustomerOutputPath -Force
            Write-Host "  Mini customer workbook updated"
        } else {
            Remove-Item -LiteralPath $temporaryCustomer `
                -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    try {
        # Old Excel editions can retain workbook-specific automation state.
        # Give each catalogue a clean Excel process so one export cannot poison
        # the next Workbooks.Open call.
        Export-WithFreshExcel `
            -SourcePath (Join-Path $projectRoot $Source) `
            -OutputPath (Join-Path $projectRoot $Output) `
            -SheetsToHide $HideSheets

        if ($Source2 -ne "") {
            Export-MiniCatalogueWithExcel `
                -MasterSourcePath (Join-Path $projectRoot $MiniMasterSource) `
                -CustomerOutputPath (Join-Path $projectRoot $Source2) `
                -ManifestPath (Join-Path $projectRoot $MiniUpdateManifest) `
                -PdfOutputPath (Join-Path $projectRoot $Output2)
        }
        $excelExportSucceeded = $true
    } catch {
        $excelFailure = $_
    }
} finally {
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

if (-not $excelExportSucceeded) {
    if ($excelFailure) {
        Write-Host "Excel export unavailable: $($excelFailure.Exception.Message)" -ForegroundColor Yellow
        if ($excelFailure.Exception.Message -match "license|activation|expired") {
            New-Item -ItemType File -Path $libreOfficeMarker -Force | Out-Null
        }
    }
    Export-CataloguesWithLibreOffice
}
