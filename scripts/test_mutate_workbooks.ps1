param(
    [Parameter(Mandatory)]
    [string]$Root
)

$ErrorActionPreference = "Stop"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AskToUpdateLinks = $false

function Open-Book([string]$RelativePath) {
    $path = Join-Path $Root $RelativePath
    return $excel.Workbooks.Open($path, 0, $false)
}

try {
    # Mini master: change one, remove one, add one.
    $wb = Open-Book "data-source\PartsbookBenji2014.xlsx"
    $ws = $wb.Worksheets.Item("Parts Data")
    $last = $ws.Cells($ws.Rows.Count, 1).End(-4162).Row
    for ($row = 2; $row -le $last; $row++) {
        $code = [Convert]::ToString($ws.Cells.Item($row, 1).Value2)
        if ($code -eq "11.14.00.87") {
            $ws.Cells($row, 2).Value2 = 50
        } elseif ($code -eq "11.14.00.88") {
            $ws.Range("A$row:B$row").ClearContents()
        }
    }
    $addRow = $last + 1
    $ws.Cells($addRow, 1).Value2 = "SYNC-TEST-MINI"
    $ws.Cells($addRow, 2).Value2 = 12.34
    $wb.Save()
    $wb.Close($false)

    # Mini catalogue: mirror the removal and addition.
    $wb = Open-Book "data-source\Mini Catalogue Self Updating.xlsm"
    foreach ($sheet in @($wb.Worksheets)) {
        $used = $sheet.UsedRange
        $found = $used.Find("11.14.00.88")
        if ($null -ne $found) {
            $row = $found.Row
            $col = $found.Column
            $sheet.Range($sheet.Cells($row, $col), $sheet.Cells($row, $col + 3)).ClearContents()
        }
    }
    $ws = $wb.Worksheets.Item("130B")
    $row = $ws.Cells($ws.Rows.Count, 1).End(-4162).Row + 1
    $ws.Cells($row, 1).Value2 = "SYNC-TEST-MINI"
    $ws.Cells($row, 2).Value2 = "Disposable sync test Mini panel"
    $ws.Cells($row, 3).Formula = "=IFERROR(VLOOKUP(A$row,'[1]Parts Data'!`$A`$3:`$E`$2700,2,FALSE),"" "")"
    $ws.Cells($row, 4).Formula = "=IFERROR((C$row/100*20)+C$row,"" "")"
    $wb.Save()
    $wb.Close($false)

    # Metals master: change one, remove one, add one.
    $wb = Open-Book "data-source\Metals.xlsx"
    foreach ($sheet in @($wb.Worksheets)) {
        $last = $sheet.Cells($sheet.Rows.Count, 4).End(-4162).Row
        for ($row = 2; $row -le $last; $row++) {
            if (
                [Convert]::ToString($sheet.Cells.Item($row, 2).Value2) -eq "Steel Ang" -and
                [Convert]::ToString($sheet.Cells.Item($row, 3).Value2) -eq "Bright" -and
                [Convert]::ToString($sheet.Cells.Item($row, 4).Value2) -eq "16mm x 16mm x 3mm"
            ) {
                $sheet.Cells($row, 5).Value2 = 30
            }
        }
    }
    $wb.Worksheets.Item("Alu 6").Range("A17:G17").ClearContents()
    $ws = $wb.Worksheets.Item("Steels 26")
    $row = $ws.Cells($ws.Rows.Count, 4).End(-4162).Row + 1
    $ws.Cells($row, 1).Value2 = "Angle"
    $ws.Cells($row, 2).Value2 = "Steel Ang"
    $ws.Cells($row, 3).Value2 = "Bright"
    $ws.Cells($row, 4).Value2 = "99mm x 77mm x 3mm"
    $ws.Cells($row, 5).Value2 = 19.87
    $ws.Cells($row, 6).Value2 = "foot/300mm"
    $wb.Save()
    $wb.Close($false)

    # Metals catalogue: mirror the removal and addition.
    $wb = Open-Book "data-source\Metals catalogue 2023.xlsx"
    $ws = $wb.Worksheets.Item("Alu Diameter")
    $last = $ws.Cells($ws.Rows.Count, 4).End(-4162).Row
    for ($row = 2; $row -le $last; $row++) {
        if (
            [Convert]::ToString($ws.Cells.Item($row, 2).Value2) -eq "Aluminium" -and
            [Convert]::ToString($ws.Cells.Item($row, 3).Value2) -eq "HE30" -and
            [Convert]::ToString($ws.Cells.Item($row, 4).Value2) -eq '3/4" D'
        ) {
            $ws.Range("A$row:K$row").ClearContents()
            break
        }
    }
    $ws = $wb.Worksheets.Item("Steel Angle n box")
    $row = $ws.Cells($ws.Rows.Count, 4).End(-4162).Row + 1
    $ws.Cells($row, 1).Value2 = "Angle"
    $ws.Cells($row, 2).Value2 = "Steel"
    $ws.Cells($row, 3).Value2 = "Bright"
    $ws.Cells($row, 4).Value2 = "99mm x 77mm x 3mm"
    $ws.Cells($row, 5).Value2 = 19.87
    $ws.Cells($row, 6).Value2 = "foot/300mm"
    $wb.Save()
    $wb.Close($false)
} catch {
    Write-Host $_.InvocationInfo.PositionMessage
    throw
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
