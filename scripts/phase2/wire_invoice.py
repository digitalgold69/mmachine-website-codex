#!/usr/bin/env python3
"""
Phase 2 — Wire Metals Invoice.xlsm with a filterable _PriceLookup sheet.

Surgical-edit version: we treat the .xlsm file as a zip and only modify the
specific XML files we need to change. Everything else — the EMF logo, all
print settings, the VBA macros, the address book macros, headers/footers —
passes through byte-for-byte identical to the original.
"""
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
PROJECT_ROOT = HERE.parent.parent
INVOICE_SRC = str(PROJECT_ROOT / "data-source" / "Metals Invoice.xlsm")
INVOICE = str(PROJECT_ROOT / "final-deliverables" / "Metals Invoice.xlsm")

from build_lookup import build_lookup_rows
from surgical_xlsx import (
    open_for_surgery, repack_zip, add_sheet, remove_sheet_if_present,
    cell_str, cell_num, col_letter,
)


def build_pricelookup_sheet_xml(rows):
    """Build a complete worksheet XML for the _PriceLookup sheet.

    Layout:  Shape | Metal | Spec | Size | £ ex VAT | Unit | Source Sheet
    """
    headers = ["Shape", "Metal", "Spec", "Size", "£ ex VAT", "Unit", "Source Sheet"]
    n_rows = len(rows) + 1
    last_col = col_letter(len(headers))
    dim_ref = f"A1:{last_col}{n_rows}"

    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        f'<dimension ref="{dim_ref}"/>',
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        '</sheetView></sheetViews>',
        '<sheetFormatPr defaultRowHeight="15"/>',
        '<cols>',
        '<col min="1" max="1" width="16" customWidth="1"/>',
        '<col min="2" max="2" width="16" customWidth="1"/>',
        '<col min="3" max="3" width="16" customWidth="1"/>',
        '<col min="4" max="4" width="28" customWidth="1"/>',
        '<col min="5" max="5" width="12" customWidth="1"/>',
        '<col min="6" max="6" width="16" customWidth="1"/>',
        '<col min="7" max="7" width="18" customWidth="1"/>',
        '</cols>',
        '<sheetData>',
    ]

    # Header row
    parts.append('<row r="1">')
    for ci, h in enumerate(headers, 1):
        parts.append(cell_str(f"{col_letter(ci)}1", h))
    parts.append('</row>')

    # Data rows. The master tuple is:
    #   (key, shape, metal, spec, size, priceEx, unit, srcSheet, srcRow)
    # We expose:  shape, metal, spec, size, priceEx, unit, srcSheet
    for ri, row in enumerate(rows, start=2):
        parts.append(f'<row r="{ri}">')
        cells = [row[1], row[2], row[3], row[4], row[5], row[6], row[7]]
        for ci, val in enumerate(cells, 1):
            ref = f"{col_letter(ci)}{ri}"
            if val is None or val == "":
                continue
            if isinstance(val, (int, float)):
                parts.append(cell_num(ref, val))
            else:
                parts.append(cell_str(ref, val))
        parts.append('</row>')

    parts.append('</sheetData>')
    parts.append(f'<autoFilter ref="A1:{last_col}{n_rows}"/>')
    parts.append('<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" '
                 'header="0.3" footer="0.3"/>')
    parts.append('</worksheet>')
    return "\n".join(parts)


def wire_invoice():
    print(f"  Source:  {INVOICE_SRC}")
    print(f"  Output:  {INVOICE}")

    rows, _collisions = build_lookup_rows()
    print(f"  Master rows: {len(rows)}")

    # Extract directly from the source (read-only) so a stale lock on the
    # destination doesn't break the run. The destination is overwritten only
    # at the final repack_zip step.
    Path(INVOICE).parent.mkdir(parents=True, exist_ok=True)
    tempdir = open_for_surgery(INVOICE_SRC)
    try:
        # Be idempotent: clean up any prior _PriceLookup or _PriceFinder
        # if the source file already had them from an earlier run
        remove_sheet_if_present(tempdir, "_PriceLookup")
        remove_sheet_if_present(tempdir, "_PriceFinder")

        # Add the new _PriceLookup sheet
        sheet_xml = build_pricelookup_sheet_xml(rows)
        add_sheet(tempdir, "_PriceLookup", sheet_xml, hidden=False)

        # Repack as .xlsm
        repack_zip(tempdir, INVOICE)
        tempdir = None
    finally:
        if tempdir:
            shutil.rmtree(tempdir, ignore_errors=True)

    print(f"  ✓ Added _PriceLookup ({len(rows)} prices)")
    print(f"  ✓ EMF logo, print settings, VBA, address book — all preserved")


if __name__ == "__main__":
    wire_invoice()
