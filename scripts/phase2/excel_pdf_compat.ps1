# Shared Microsoft Excel PDF automation helpers.
#
# These functions deliberately test capabilities instead of branching on an
# Excel version number. Desktop Excel releases differ in how strictly their
# COM layer handles omitted optional arguments, so PDF export is attempted
# using compatible call shapes and the output file is always verified.

function Set-ExcelAutomationOptions {
    param(
        [Parameter(Mandatory)] $Excel
    )

    foreach ($setting in @(
        @{ Name = "Visible"; Value = $false },
        @{ Name = "DisplayAlerts"; Value = $false },
        @{ Name = "AskToUpdateLinks"; Value = $false },
        @{ Name = "ScreenUpdating"; Value = $false },
        @{ Name = "DisplayStatusBar"; Value = $false },
        @{ Name = "EnableEvents"; Value = $false },
        @{ Name = "Interactive"; Value = $false },
        @{ Name = "UserControl"; Value = $false }
    )) {
        try {
            $Excel.($setting.Name) = $setting.Value
        } catch {
            # Some older Excel editions do not expose every optional setting.
        }
    }

    # Microsoft documents that programmatically opened workbooks otherwise
    # use the current macro-security setting. Force-disable macros for the
    # unattended catalogue export; the sync only needs formulas and layouts.
    try {
        $Excel.AutomationSecurity = 3 # msoAutomationSecurityForceDisable
    } catch {
        # Continue on editions that do not expose AutomationSecurity through COM.
    }
}

function Test-ExcelPdfFile {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [long]$MinimumBytes = 100
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }

    try {
        return ((Get-Item -LiteralPath $Path).Length -ge $MinimumBytes)
    } catch {
        return $false
    }
}

function Open-ExcelWorkbookCompatible {
    param(
        [Parameter(Mandatory)] $Excel,
        [Parameter(Mandatory)] [string]$Path,
        [bool]$ReadOnly = $false
    )

    $attempts = @(
        @{
            Name = "complete Workbooks.Open call"
            Run = {
                $Excel.Workbooks.Open(
                    $Path,
                    0,
                    $ReadOnly,
                    [Type]::Missing,
                    [Type]::Missing,
                    [Type]::Missing,
                    $true,
                    [Type]::Missing,
                    [Type]::Missing,
                    $false,
                    $false,
                    [Type]::Missing,
                    $false,
                    $true,
                    0
                )
            }
        },
        @{
            Name = "legacy Workbooks.Open call"
            Run = {
                $Excel.Workbooks.Open(
                    $Path,
                    0,
                    $ReadOnly,
                    [Type]::Missing,
                    [Type]::Missing,
                    [Type]::Missing,
                    $true,
                    [Type]::Missing,
                    [Type]::Missing,
                    $false,
                    $false,
                    [Type]::Missing,
                    $false,
                    $true
                )
            }
        },
        @{
            Name = "short Workbooks.Open call"
            Run = {
                $Excel.Workbooks.Open($Path, 0, $ReadOnly)
            }
        },
        @{
            Name = "minimal Workbooks.Open call"
            Run = {
                $Excel.Workbooks.Open($Path)
            }
        }
    )

    $errors = @()
    foreach ($attempt in $attempts) {
        try {
            $workbook = & $attempt.Run
            if ($workbook) {
                return [pscustomobject]@{
                    Workbook = $workbook
                    Method = $attempt.Name
                }
            }
            $errors += "$($attempt.Name): Excel returned no workbook"
        } catch {
            $errors += "$($attempt.Name): $($_.Exception.Message)"
        }
    }

    throw (
        "Excel could not open '$Path' using any supported automation call. " +
        ($errors -join " | ")
    )
}

function Invoke-ExcelWorkbookPdfExport {
    param(
        [Parameter(Mandatory)] $Workbook,
        [Parameter(Mandatory)] [string]$OutputPath,
        [long]$MinimumBytes = 100
    )

    $outputDirectory = Split-Path -Parent $OutputPath
    if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $attempts = @(
        @{
            Name = "complete optional-argument call"
            Run = {
                $Workbook.ExportAsFixedFormat(
                    0,
                    $OutputPath,
                    0,
                    $true,
                    $false,
                    [Type]::Missing,
                    [Type]::Missing,
                    $false,
                    [Type]::Missing
                )
            }
        },
        @{
            Name = "legacy optional-argument call"
            Run = {
                $Workbook.ExportAsFixedFormat(
                    0,
                    $OutputPath,
                    0,
                    $true,
                    $false,
                    [Type]::Missing,
                    [Type]::Missing,
                    $false
                )
            }
        },
        @{
            Name = "minimal required-argument call"
            Run = {
                $Workbook.ExportAsFixedFormat(0, $OutputPath)
            }
        }
    )

    $errors = @()
    foreach ($attempt in $attempts) {
        Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue
        try {
            & $attempt.Run
            if (Test-ExcelPdfFile -Path $OutputPath -MinimumBytes $MinimumBytes) {
                return $attempt.Name
            }
            $errors += "$($attempt.Name): Excel returned without creating a valid PDF"
        } catch {
            $errors += "$($attempt.Name): $($_.Exception.Message)"
        }
    }

    throw (
        "Excel could not export a valid PDF using any supported automation call. " +
        ($errors -join " | ")
    )
}

function Test-ExcelPdfCapability {
    $excel = $null
    $workbook = $null
    $worksheet = $null
    $testRoot = Join-Path $env:TEMP (
        "m-machine-excel-test-" + [Guid]::NewGuid().ToString("N")
    )
    $testPdf = Join-Path $testRoot "excel-pdf-test.pdf"
    $stage = "starting Microsoft Excel"
    $version = "unknown"

    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

    try {
        $excel = New-Object -ComObject Excel.Application
        try { $version = [string]$excel.Version } catch {}
        Set-ExcelAutomationOptions -Excel $excel

        $stage = "creating a temporary workbook"
        $workbook = $excel.Workbooks.Add()
        $worksheet = $workbook.Worksheets.Item(1)
        $worksheet.Range("A1").Value2 = "M-Machine Excel PDF test"

        $stage = "exporting a local test PDF"
        $method = Invoke-ExcelWorkbookPdfExport `
            -Workbook $workbook `
            -OutputPath $testPdf

        return [pscustomobject]@{
            Success = $true
            Version = $version
            Method = $method
            Detail = ""
        }
    } catch {
        return [pscustomobject]@{
            Success = $false
            Version = $version
            Method = ""
            Detail = "$stage failed in Excel $version`: $($_.Exception.Message)"
        }
    } finally {
        if ($worksheet) {
            [Runtime.InteropServices.Marshal]::ReleaseComObject($worksheet) | Out-Null
        }
        if ($workbook) {
            try { $workbook.Close($false) } catch {}
            [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
        }
        if ($excel) {
            try { $excel.Quit() } catch {}
            [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
        }
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
