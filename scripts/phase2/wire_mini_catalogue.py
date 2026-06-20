#!/usr/bin/env python3
"""
Phase 2b — Wire Mini Catalogue Self Updating to a self-contained _PriceLookup.

The Mini Catalogue currently uses external-link VLOOKUPs into
PartsbookBenji2014.xlsx — that's the fragile pattern that breaks when the
files move or get emailed around. This script converts it to an internal
_PriceLookup table refreshed on each sync.

Strategy:
  1. Read PartsbookBenji2014.xlsx → 'Parts Data'. Extract (code, price) rows.
  2. Surgically:
     a. Add a hidden _PriceLookup sheet with columns A=code, B=price
     b. Find every formula referencing  '[1]Parts Data'!$A$3:$E$2700  in
        the B-sheets (120B, 130B, ..., 510B, APX1, APX2) and rewrite the
        target to  _PriceLookup!$A:$B
     c. Update the external-link rels so Excel doesn't prompt about a
        missing external file
  3. Repack as .xlsm (preserve VBA, images, print settings, etc.)
"""
import openpyxl
import re
import shutil
import sys
import warnings
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")

warnings.filterwarnings("ignore", message="DrawingML support is incomplete.*")
warnings.filterwarnings("ignore", message="Print area cannot be set.*")
warnings.filterwarnings("ignore", message="Cannot parse header or footer.*")
warnings.filterwarnings("ignore", message="Data Validation extension is not supported.*")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
PROJECT_ROOT = HERE.parent.parent
PARTSBOOK = str(PROJECT_ROOT / "data-source" / "PartsbookBenji2014.xlsx")
MINI_CAT_SRC = str(PROJECT_ROOT / "data-source" / "Mini Catalogue Self Updating.xlsm")
MINI_CAT = str(PROJECT_ROOT / "final-deliverables" / "Mini Catalogue Self Updating.xlsm")

from surgical_xlsx import (
    open_for_surgery, repack_zip, add_sheet, remove_sheet_if_present,
    remove_calc_chain_if_present, map_sheet_names_to_xml_files, edit_sheet_xml,
    cell_str, cell_num, cell_formula, col_letter, _read, _write,
)


# Old (fragile) external reference patterns — there are a few variants
EXTERNAL_PATTERNS = [
    r"'\[1\]Parts Data'!\$A\$3:\$E\$2700",
    r"'\[1\]Parts Data'!\$A\$3:\$E\$2400",  # older variant just in case
    r"'\[1\]Parts Data'!\$A:\$E",
]
INTERNAL_REPLACEMENT = "_PriceLookup!$A:$B"
PART_CODE_REGEX = re.compile(r"^[\d.]+\.\d{2}\.\d{2}\.\d{2}[A-Z]?$|^[A-Z0-9-]{4,}$")


def looks_like_part_code(value):
    value = str(value or "").strip()
    return (
        bool(value)
        and " " not in value
        and 3 <= len(value) <= 30
        and bool(PART_CODE_REGEX.match(value))
    )


def code_description_columns(ws):
    pairs = []
    for col in range(1, ws.max_column + 1):
        if str(ws.cell(1, col).value or "").strip().lower() == "code":
            pairs.append((col, col + 1))
    return pairs


def build_internal_formula_edits(ws, prices):
    edits = {}
    for code_col, _description_col in code_description_columns(ws):
        price_col = code_col + 2
        inc_vat_col = code_col + 3
        for row in range(2, ws.max_row + 1):
            raw_code = ws.cell(row, code_col).value
            if not looks_like_part_code(raw_code):
                continue
            code = str(raw_code).strip()
            code_ref = f"{col_letter(code_col)}{row}"
            price_ref = f"{col_letter(price_col)}{row}"
            inc_ref = f"{col_letter(inc_vat_col)}{row}"
            current_price = prices.get(code)
            cached_price = current_price if current_price is not None else " "
            cached_inc_vat = (
                round(float(current_price) * 1.2, 2)
                if isinstance(current_price, (int, float))
                else " "
            )
            price_formula = (
                f'IFERROR(VLOOKUP({code_ref},_PriceLookup!$A:$B,2,FALSE)," ")'
            )
            edits.setdefault(row, []).append(
                (price_ref, cell_formula(price_ref, price_formula, cached_price))
            )
            inc_formula = f'IFERROR(({price_ref}/100*20)+{price_ref}," ")'
            edits.setdefault(row, []).append(
                (inc_ref, cell_formula(inc_ref, inc_formula, cached_inc_vat))
            )
    return edits


def load_partsbook_codes():
    """Read PartsbookBenji.xlsx → 'Parts Data' and return a list of
    (code, price) pairs. Price may be numeric or a text marker like 'POA'.
    Skips heading rows and duplicates."""
    wb = openpyxl.load_workbook(PARTSBOOK, data_only=True)
    ws = wb["Parts Data"]
    rows = []
    seen = set()
    for r in range(2, ws.max_row + 1):
        code = ws.cell(r, 1).value
        price = ws.cell(r, 2).value
        if code is None: continue
        code_s = str(code).strip()
        if not code_s: continue
        if code_s in seen: continue   # PartsbookBenji has a few duplicates
        seen.add(code_s)
        # Preserve text values like "POA" (Price on application) — they
        # used to flow through the original external VLOOKUP and we want
        # the catalogue to behave the same way.
        rows.append((code_s, price))
    return rows


def build_pricelookup_xml(rows):
    """Build an XML for the _PriceLookup sheet. Two columns: code | price."""
    n_rows = len(rows) + 1
    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        f'<dimension ref="A1:B{n_rows}"/>',
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        '</sheetView></sheetViews>',
        '<sheetFormatPr defaultRowHeight="15"/>',
        '<cols>',
        '<col min="1" max="1" width="18" customWidth="1"/>',
        '<col min="2" max="2" width="14" customWidth="1"/>',
        '</cols>',
        '<sheetData>',
    ]
    parts.append('<row r="1">')
    parts.append(cell_str("A1", "Part No"))
    parts.append(cell_str("B1", "Price ex VAT"))
    parts.append('</row>')
    for ri, (code, price) in enumerate(rows, start=2):
        parts.append(f'<row r="{ri}">')
        parts.append(cell_str(f"A{ri}", code))
        if isinstance(price, (int, float)):
            parts.append(cell_num(f"B{ri}", price))
        elif price is not None and str(price).strip() != "":
            # Text price like "POA" — preserve as a string cell
            parts.append(cell_str(f"B{ri}", str(price)))
        parts.append('</row>')
    parts.append('</sheetData>')
    parts.append('<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" '
                 'header="0.3" footer="0.3"/>')
    parts.append('</worksheet>')
    return "\n".join(parts)


def rewrite_external_references_in_sheet(sheet_xml_path):
    """Replace every external 'Parts Data' reference with the internal
    _PriceLookup. Returns the count of rewritten formulas."""
    with open(sheet_xml_path, "r", encoding="utf-8") as f:
        xml = f.read()

    count = 0
    # XML-escapes the apostrophes; the file may have either form
    for pattern in EXTERNAL_PATTERNS:
        # Match the literal pattern (with apostrophes possibly escaped to &apos;
        # in some XML serializers). Build a regex that handles both.
        regex_text = pattern.replace("'", "(?:'|&apos;)")
        new_xml, n = re.subn(regex_text, INTERNAL_REPLACEMENT, xml)
        if n > 0:
            xml = new_xml
            count += n

    if count > 0:
        with open(sheet_xml_path, "w", encoding="utf-8") as f:
            f.write(xml)
    return count


def remove_external_link_rels(tempdir):
    """Strip the external-workbook reference from the workbook so Excel
    doesn't prompt about a missing file. The reference lives in:
       xl/workbook.xml         (<externalReferences>)
       xl/_rels/workbook.xml.rels
       xl/externalLinks/...    (the actual cached reference data)
    """
    # workbook.xml — drop the <externalReferences>...</externalReferences>
    # block AND any <externalReference r:id="rIdN"/> entries inside.
    workbook = _read(tempdir, "xl/workbook.xml")
    workbook = re.sub(
        r'<externalReferences>.*?</externalReferences>', "", workbook, flags=re.DOTALL
    )
    _write(tempdir, "xl/workbook.xml", workbook)

    # workbook.xml.rels — drop external-link Relationships
    # Use [^>]*? not [^/]*? — Type and Target attribute values contain slashes
    rels = _read(tempdir, "xl/_rels/workbook.xml.rels")
    rels = re.sub(
        r'<Relationship[^>]*?Type="[^"]*externalLink[^"]*"[^>]*?/>', "", rels
    )
    _write(tempdir, "xl/_rels/workbook.xml.rels", rels)

    # [Content_Types].xml — drop the externalLink override (PartName has slashes)
    ct = _read(tempdir, "[Content_Types].xml")
    ct = re.sub(
        r'<Override[^>]*?ContentType="[^"]*externalLink[^"]*"[^>]*?/>', "", ct
    )
    _write(tempdir, "[Content_Types].xml", ct)

    # And remove the externalLinks/ folder content (best-effort)
    el_dir = Path(tempdir) / "xl" / "externalLinks"
    if el_dir.exists():
        shutil.rmtree(el_dir, ignore_errors=True)
    el_rels_dir = Path(tempdir) / "xl" / "externalLinks" / "_rels"
    if el_rels_dir.exists():
        shutil.rmtree(el_rels_dir, ignore_errors=True)


def wire_mini_catalogue():
    print(f"  Source:  {MINI_CAT_SRC}")
    print(f"  Output:  {MINI_CAT}")

    rows = load_partsbook_codes()
    prices = dict(rows)
    print(f"  PartsbookBenji codes: {len(rows)}")
    source_wb = openpyxl.load_workbook(MINI_CAT_SRC, data_only=False, keep_vba=True)

    Path(MINI_CAT).parent.mkdir(parents=True, exist_ok=True)
    # Extract directly from the source (avoids permission error if destination is open)
    tempdir = open_for_surgery(MINI_CAT_SRC)
    try:
        remove_sheet_if_present(tempdir, "_PriceLookup")
        add_sheet(tempdir, "_PriceLookup", build_pricelookup_xml(rows), hidden=True)

        # Rewrite the existing formulas in place so all original formatting
        # and legacy workbook structure stay untouched. If a newly-added row
        # has no real formula, insert the two formulas just for that row.
        sheet_path_map = map_sheet_names_to_xml_files(tempdir)
        total_rewrites = 0
        sheets_touched = 0
        for sheet_name, xml_rel in sheet_path_map.items():
            if not (re.fullmatch(r"\d+B", sheet_name) or sheet_name in {"APX1", "APX2"}):
                continue
            sheet_path = Path(tempdir) / xml_rel
            rewritten = rewrite_external_references_in_sheet(str(sheet_path))
            edits = build_internal_formula_edits(source_wb[sheet_name], prices)
            if edits:
                _applied, missing = edit_sheet_xml(str(sheet_path), edits)
                if missing:
                    raise RuntimeError(
                        f"{sheet_name}: could not update formula rows {missing[:12]}"
                    )
            inserted = sum(len(row_edits) for row_edits in edits.values())
            if rewritten or inserted:
                sheets_touched += 1
                total_rewrites += rewritten + inserted

        print(f"  Refreshed {total_rewrites} formulas across {sheets_touched} catalogue pages")

        # Strip the external-link metadata so Excel doesn't prompt
        remove_external_link_rels(tempdir)

        # Every printable catalogue formula and the workbook sheet list have
        # changed. The source workbook's cached dependency chain points at the
        # old formulas/sheet layout; newer Excel rebuilds it, but Excel 2007 can
        # refuse to open the workbook. Let Excel generate a fresh chain.
        remove_calc_chain_if_present(tempdir)

        repack_zip(tempdir, MINI_CAT)
        tempdir = None
    finally:
        source_wb.close()
        if tempdir:
            shutil.rmtree(tempdir, ignore_errors=True)

    print("  OK External 'Parts Data' references replaced with internal _PriceLookup")
    print("  OK VBA, images, and print settings preserved")


if __name__ == "__main__":
    wire_mini_catalogue()
