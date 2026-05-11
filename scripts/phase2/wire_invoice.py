#!/usr/bin/env python3
"""
Phase 2 — Wire Metals Invoice.xlsm with single-field CODE lookup in the
existing SPECIFICATION column (column E) + 3-field fallback + filterable
price reference.

Workflow on the Invoice sheet (matches the Mini Invoice's "type in the
existing field" pattern, no new columns added):

  EITHER  type a Code into the SPECIFICATION column (E), e.g.
          HE30-5/8"x5/8"x1/16" — and METAL (D), SIZE (F), price (G),
          unit (H) all auto-fill via VLOOKUP into _PriceLookup
  OR      type METAL/SPEC/SIZE manually in D/E/F (legacy workflow) —
          then G/H still auto-fill via the 3-field composite key

No new column. Same form layout, same print output. The owner's
re-training is one sentence: "If you know the code, type it in the
SPECIFICATION column and everything else fills in for you."

Surgical-edit version: zip-level XML edits only. EMF logo, print
settings, VBA macros, address book, AND cell borders/fonts/fills are
all preserved byte-for-byte.
"""
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
PROJECT_ROOT = HERE.parent.parent
INVOICE_SRC = str(PROJECT_ROOT / "data-source" / "Metals Invoice.xlsm")
INVOICE = str(PROJECT_ROOT / "final-deliverables" / "Metals Invoice.xlsm")

from build_lookup import build_lookup_rows, normalise
from surgical_xlsx import (
    open_for_surgery, repack_zip, add_sheet, remove_sheet_if_present,
    map_sheet_names_to_xml_files, edit_sheet_xml, cell_str, cell_num,
    cell_formula, col_letter,
)


def lookup_key(metal, spec, size):
    """Match the Excel formula's runtime key construction."""
    def lt(v):
        if v is None: return ""
        return normalise(v)
    return f"{lt(metal)}|{lt(spec)}|{lt(size)}"


def build_pricelookup_sheet_xml(rows):
    """Build _PriceLookup with both lookup keys at the front so VLOOKUP works.

    Layout:
      A: Code  (e.g. HE30-5/8"x5/8"x1/16")    primary lookup
      B: Key   (metal|spec|size composite)    fallback lookup
      C: Shape
      D: Metal
      E: Spec
      F: Size
      G: £ ex VAT
      H: Unit
      I: Source Sheet
    """
    headers = ["Code", "Key", "Shape", "Metal", "Spec", "Size",
               "£ ex VAT", "Unit", "Source Sheet"]
    last_col = col_letter(len(headers))

    # Dedupe by composite key — keep the first occurrence for stable lookups
    seen_keys = set()
    output_rows = []
    for row in rows:
        # row tuple: (key, shape, metal, spec, size, priceEx, unit, srcSheet, srcRow, code)
        _orig_key, shape, metal, spec, size, priceEx, unit, srcSheet, _srcRow, code = row[:10]
        key3 = lookup_key(metal, spec, size)
        if key3 in seen_keys: continue
        seen_keys.add(key3)
        output_rows.append((code, key3, shape, metal, spec, size, priceEx, unit, srcSheet))

    n_rows = len(output_rows) + 1

    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        f'<dimension ref="A1:{last_col}{n_rows}"/>',
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        '</sheetView></sheetViews>',
        '<sheetFormatPr defaultRowHeight="15"/>',
        '<cols>',
        '<col min="1" max="1" width="32" customWidth="1"/>',  # Code
        '<col min="2" max="2" width="44" hidden="1"/>',         # Key (hidden)
        '<col min="3" max="3" width="14" customWidth="1"/>',  # Shape
        '<col min="4" max="4" width="16" customWidth="1"/>',  # Metal
        '<col min="5" max="5" width="14" customWidth="1"/>',  # Spec
        '<col min="6" max="6" width="28" customWidth="1"/>',  # Size
        '<col min="7" max="7" width="12" customWidth="1"/>',  # £ ex VAT
        '<col min="8" max="8" width="16" customWidth="1"/>',  # Unit
        '<col min="9" max="9" width="18" customWidth="1"/>',  # Source Sheet
        '</cols>',
        '<sheetData>',
    ]

    parts.append('<row r="1">')
    for ci, h in enumerate(headers, 1):
        parts.append(cell_str(f"{col_letter(ci)}1", h))
    parts.append('</row>')

    for ri, (code, key3, shape, metal, spec, size, priceEx, unit, srcSheet) in enumerate(output_rows, start=2):
        parts.append(f'<row r="{ri}">')
        if code: parts.append(cell_str(f"A{ri}", code))
        parts.append(cell_str(f"B{ri}", key3))
        if shape: parts.append(cell_str(f"C{ri}", str(shape)))
        if metal: parts.append(cell_str(f"D{ri}", str(metal)))
        if spec:  parts.append(cell_str(f"E{ri}", str(spec)))
        if size:  parts.append(cell_str(f"F{ri}", str(size)))
        if isinstance(priceEx, (int, float)):
            parts.append(cell_num(f"G{ri}", priceEx))
        elif priceEx is not None and str(priceEx).strip() != "":
            parts.append(cell_str(f"G{ri}", str(priceEx)))
        if unit: parts.append(cell_str(f"H{ri}", str(unit)))
        if srcSheet: parts.append(cell_str(f"I{ri}", str(srcSheet)))
        parts.append('</row>')

    parts.append('</sheetData>')
    parts.append(f'<autoFilter ref="C1:{last_col}{n_rows}"/>')
    parts.append('<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" '
                 'header="0.3" footer="0.3"/>')
    parts.append('</worksheet>')
    return "\n".join(parts)


_LINE_ITEM_REGEX = re.compile(
    r'<c r="I(\d+)"[^>]*>\s*<f[^>]*>SUM\(\(G\d+\*Z1%\)\+G\d+\)</f>',
    re.IGNORECASE,
)


def find_line_item_rows(sheet_xml: str):
    return sorted({int(m.group(1)) for m in _LINE_ITEM_REGEX.finditer(sheet_xml)})


def add_invoice_lookup_formulas(sheet_xml_path: Path):
    """Wire formulas on each line-item row so the owner can either
    (a) type a Code in SPECIFICATION (column E) and have everything
    else auto-fill, or (b) type METAL/SPEC/SIZE manually as before."""
    with open(sheet_xml_path, "r", encoding="utf-8") as f:
        xml = f.read()

    rows = find_line_item_rows(xml)
    if not rows: return 0

    edits: dict = {}

    for r in rows:
        # The 3-field composite key — used by the fallback lookup when
        # the SPECIFICATION column contains a real spec (not a code).
        key3_expr = (
            f'LOWER(TRIM(D{r}))&"|"&LOWER(TRIM(E{r}))&"|"&LOWER(TRIM(F{r}))'
        )

        # _PriceLookup layout: A=Code, B=Key3, C=Shape, D=Metal, E=Spec, F=Size,
        #                     G=£, H=Unit, I=Source Sheet
        #
        # The owner types in column E. If what she typed is a recognized
        # CODE (column A of _PriceLookup), auto-fill metal/size/price/unit.
        # Otherwise (legacy 3-field workflow), G/H fall back to the
        # composite-key lookup using whatever's in D/E/F.

        # D (Metal): only auto-fill if E contains a code that maps to a row
        # in _PriceLookup. Otherwise leave alone so the owner's manually-typed
        # value persists.
        d_formula = (
            f'IFERROR(VLOOKUP(E{r},_PriceLookup!$A:$D,4,FALSE),"")'
        )
        # F (Size): same pattern, but the row keeps blank when not a code.
        f_formula = (
            f'IFERROR(VLOOKUP(E{r},_PriceLookup!$A:$F,6,FALSE),"")'
        )

        # G (price): code lookup first; if that misses, fall back to 3-field key.
        g_formula = (
            f'IFERROR(VLOOKUP(E{r},_PriceLookup!$A:$G,7,FALSE),'
            f'IFERROR(VLOOKUP({key3_expr},_PriceLookup!$B:$G,6,FALSE),""))'
        )
        # H (unit of measure): same pattern.
        h_formula = (
            f'IFERROR(VLOOKUP(E{r},_PriceLookup!$A:$H,8,FALSE),'
            f'IFERROR(VLOOKUP({key3_expr},_PriceLookup!$B:$H,7,FALSE),""))'
        )

        # Inc-VAT and cost — wrap so blank G doesn't propagate #VALUE!
        i_formula = f'IFERROR(SUM((G{r}*Z1%)+G{r}),"")'
        j_formula = f'IFERROR(SUM(G{r}*C{r}),"")'

        # NOTE: we intentionally do NOT add a formula on E itself — that's
        # the owner's INPUT column. Touching it would block her from typing.
        edits[r] = [
            (f"D{r}", cell_formula(f"D{r}", d_formula)),
            (f"F{r}", cell_formula(f"F{r}", f_formula)),
            (f"G{r}", cell_formula(f"G{r}", g_formula)),
            (f"H{r}", cell_formula(f"H{r}", h_formula)),
            (f"I{r}", cell_formula(f"I{r}", i_formula)),
            (f"J{r}", cell_formula(f"J{r}", j_formula)),
        ]

    edit_sheet_xml(str(sheet_xml_path), edits)
    return len(rows)


def wire_invoice():
    print(f"  Source:  {INVOICE_SRC}")
    print(f"  Output:  {INVOICE}")

    rows, _collisions = build_lookup_rows()
    print(f"  Master rows: {len(rows)}")

    Path(INVOICE).parent.mkdir(parents=True, exist_ok=True)
    tempdir = open_for_surgery(INVOICE_SRC)
    try:
        remove_sheet_if_present(tempdir, "_PriceLookup")
        remove_sheet_if_present(tempdir, "_PriceFinder")

        sheet_xml = build_pricelookup_sheet_xml(rows)
        add_sheet(tempdir, "_PriceLookup", sheet_xml, hidden=False)

        sheet_path_map = map_sheet_names_to_xml_files(tempdir)
        invoice_rel = sheet_path_map.get("Invoice")
        if invoice_rel:
            invoice_path = Path(tempdir) / invoice_rel
            n = add_invoice_lookup_formulas(invoice_path)
            print(f"  ✓ Code + auto-fill formulas added to {n} line-item rows")
        else:
            print(f"  ! Invoice sheet not found in workbook XML — skipping auto-fill")

        repack_zip(tempdir, INVOICE)
        tempdir = None
    finally:
        if tempdir:
            shutil.rmtree(tempdir, ignore_errors=True)

    print(f"  ✓ _PriceLookup tab: filterable price reference (Code + Key + details)")
    print(f"  ✓ EMF logo, print settings, VBA, address book — all preserved")


if __name__ == "__main__":
    wire_invoice()
