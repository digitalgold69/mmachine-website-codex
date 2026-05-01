#!/usr/bin/env python3
"""
Surgical xlsx/xlsm editing helpers.

Why this module exists:
  openpyxl loads a workbook into its own object model and re-saves it from
  scratch. Anything openpyxl doesn't model — printer settings, EMF images,
  some VBA forms, exotic page-layout settings — gets silently dropped.

Surgical editing instead treats the file as what it actually is: a zip of
XML files. We extract everything, modify ONLY the specific XML files we
need to change, and re-zip. Everything we don't touch stays byte-for-byte
identical to the original.
"""
import os
import re
import shutil
import tempfile
import zipfile
from xml.sax.saxutils import escape as xml_escape


def open_for_surgery(src_path):
    """Extract the xlsx/xlsm to a temp dir for in-place editing.
    Returns (tempdir, helpers) where helpers can modify the structure."""
    tempdir = tempfile.mkdtemp(prefix="xlsx_surgery_")
    with zipfile.ZipFile(src_path, "r") as zf:
        zf.extractall(tempdir)
    return tempdir


def repack_zip(tempdir, dst_path):
    """Re-zip the temp dir into a valid xlsx/xlsm at dst_path."""
    if os.path.exists(dst_path):
        try:
            os.remove(dst_path)
        except PermissionError:
            # File may be open in Excel — bubble a clearer error
            raise RuntimeError(
                f"Can't overwrite {dst_path} — close it in Excel first."
            )

    with zipfile.ZipFile(dst_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # [Content_Types].xml is a special name and zip libraries
        # don't strictly require it first, but we put it first anyway
        # to match Excel's own writer.
        ct = os.path.join(tempdir, "[Content_Types].xml")
        if os.path.exists(ct):
            zf.write(ct, "[Content_Types].xml")
        for root, _dirs, files in os.walk(tempdir):
            for fn in files:
                full = os.path.join(root, fn)
                arc = os.path.relpath(full, tempdir).replace(os.sep, "/")
                if arc == "[Content_Types].xml":
                    continue  # already written
                zf.write(full, arc)

    shutil.rmtree(tempdir)


def _read(tempdir, relpath):
    with open(os.path.join(tempdir, relpath), "r", encoding="utf-8") as f:
        return f.read()


def _write(tempdir, relpath, content):
    with open(os.path.join(tempdir, relpath), "w", encoding="utf-8") as f:
        f.write(content)


def add_sheet(tempdir, sheet_name, sheet_xml, hidden=False):
    """Add a new worksheet. Updates workbook.xml, the rels, and content types.
    Returns the rId assigned to the new sheet."""

    # 1. Find an unused worksheets/sheetN.xml filename
    sheets_dir = os.path.join(tempdir, "xl", "worksheets")
    existing = [f for f in os.listdir(sheets_dir)
                if re.fullmatch(r"sheet\d+\.xml", f)]
    max_n = max((int(re.match(r"sheet(\d+)\.xml", f).group(1)) for f in existing),
                default=0)
    new_filename = f"sheet{max_n + 1}.xml"
    _write(tempdir, f"xl/worksheets/{new_filename}", sheet_xml)

    # 2. Add a Relationship for the new sheet in xl/_rels/workbook.xml.rels
    rels = _read(tempdir, "xl/_rels/workbook.xml.rels")
    used_rids = [int(m) for m in re.findall(r'Id="rId(\d+)"', rels)]
    new_rid = max(used_rids) + 1
    new_rel = (
        f'<Relationship Id="rId{new_rid}" '
        f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        f'Target="worksheets/{new_filename}"/>'
    )
    rels = rels.replace("</Relationships>", new_rel + "</Relationships>")
    _write(tempdir, "xl/_rels/workbook.xml.rels", rels)

    # 3. Add a <sheet> entry inside <sheets> in xl/workbook.xml
    workbook = _read(tempdir, "xl/workbook.xml")
    sheet_ids = [int(m) for m in re.findall(r'sheetId="(\d+)"', workbook)]
    new_sheet_id = max(sheet_ids) + 1
    state_attr = ' state="hidden"' if hidden else ''
    new_sheet_entry = (
        f'<sheet name="{xml_escape(sheet_name)}" '
        f'sheetId="{new_sheet_id}"{state_attr} '
        f'r:id="rId{new_rid}"/>'
    )
    workbook = re.sub(r"</sheets>", new_sheet_entry + "</sheets>", workbook, count=1)
    _write(tempdir, "xl/workbook.xml", workbook)

    # 4. Add an Override in [Content_Types].xml
    ct = _read(tempdir, "[Content_Types].xml")
    new_override = (
        f'<Override PartName="/xl/worksheets/{new_filename}" '
        f'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    )
    ct = ct.replace("</Types>", new_override + "</Types>")
    _write(tempdir, "[Content_Types].xml", ct)

    return new_rid


def remove_sheet_if_present(tempdir, sheet_name):
    """If a sheet with the given name exists, remove it cleanly.
    Used to make wire scripts idempotent."""
    workbook = _read(tempdir, "xl/workbook.xml")
    m = re.search(
        rf'<sheet[^/]*name="{re.escape(sheet_name)}"[^/]*r:id="(rId\d+)"[^/]*/>',
        workbook,
    )
    if not m:
        return False
    sheet_tag = m.group(0)
    rid = m.group(1)

    # Remove from workbook.xml
    workbook = workbook.replace(sheet_tag, "")
    _write(tempdir, "xl/workbook.xml", workbook)

    # Find the target file in the rels and remove the relationship
    rels = _read(tempdir, "xl/_rels/workbook.xml.rels")
    rm = re.search(
        rf'<Relationship[^/]*Id="{re.escape(rid)}"[^/]*Target="([^"]+)"[^/]*/>',
        rels,
    )
    if rm:
        target_rel = rm.group(1)  # e.g. "worksheets/sheet8.xml"
        rels = rels.replace(rm.group(0), "")
        _write(tempdir, "xl/_rels/workbook.xml.rels", rels)

        # Delete the sheet xml file
        sheet_path = os.path.join(tempdir, "xl", target_rel)
        if os.path.exists(sheet_path):
            os.remove(sheet_path)

        # Remove the Override from content types
        ct = _read(tempdir, "[Content_Types].xml")
        ct = re.sub(
            rf'<Override[^/]*PartName="/xl/{re.escape(target_rel)}"[^/]*/>',
            "",
            ct,
        )
        _write(tempdir, "[Content_Types].xml", ct)
    return True


# ---------------------------------------------------------------------------
# Helpers for building sheet XML
# ---------------------------------------------------------------------------


def col_letter(idx):
    """1-indexed column letter: 1 -> 'A', 27 -> 'AA'."""
    out = ""
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        out = chr(ord("A") + rem) + out
    return out


def cell_str(ref, value):
    """Build a <c> element for a string value (uses inlineStr — no need to
    touch sharedStrings.xml)."""
    return (
        f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">'
        f'{xml_escape(str(value))}</t></is></c>'
    )


def cell_num(ref, value):
    """Build a <c> element for a number."""
    return f'<c r="{ref}"><v>{value}</v></c>'


def cell_for(ref, value):
    """Auto-pick string or number cell."""
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return cell_num(ref, value)
    return cell_str(ref, value)


# ---------------------------------------------------------------------------
# Helpers for editing existing sheets in place
# ---------------------------------------------------------------------------


def map_sheet_names_to_xml_files(tempdir):
    """Walk workbook.xml + workbook.xml.rels to figure out which xml file
    backs each named sheet. Returns dict {sheet_name: relative_path}."""
    workbook = _read(tempdir, "xl/workbook.xml")
    rels = _read(tempdir, "xl/_rels/workbook.xml.rels")

    # rId → target. The Type attribute holds a URL with slashes, so we use
    # [^>]*? (any chars except '>', non-greedy) instead of [^/]*.
    rid_to_target = {}
    for m in re.finditer(r'Id="(rId\d+)"[^>]*?Target="([^"]+)"', rels):
        rid_to_target[m.group(1)] = m.group(2)

    out = {}
    for m in re.finditer(
        r'<sheet[^/]*name="([^"]+)"[^/]*r:id="(rId\d+)"[^/]*/>', workbook
    ):
        name = m.group(1)
        rid = m.group(2)
        target = rid_to_target.get(rid)
        if target:
            # paths in workbook.xml.rels are relative to xl/, e.g. "worksheets/sheet3.xml"
            out[name] = "xl/" + target
    return out


_CELL_REGEX_TEMPLATE = (
    r'<c[ \t]+r="{ref}"(?:[ \t][^/>]*)?(?:/>|>.*?</c>)'
)


def _cell_pattern(ref):
    return re.compile(_CELL_REGEX_TEMPLATE.format(ref=re.escape(ref)), re.DOTALL)


def replace_cell_in_row(row_xml, ref, new_cell_xml):
    """Replace the first <c r="{ref}".../> or <c r="{ref}">...</c> in row_xml.
    If no cell with that ref exists, insert new_cell_xml before </row>."""
    pat = _cell_pattern(ref)
    if pat.search(row_xml):
        return pat.sub(new_cell_xml, row_xml, count=1)
    # No existing cell — insert before </row>
    return row_xml.replace("</row>", new_cell_xml + "</row>", 1)


_ROW_REGEX = re.compile(r'<row[ \t]+r="(\d+)"(?:[ \t][^>]*)?>.*?</row>', re.DOTALL)


def edit_sheet_xml(sheet_xml_path, row_edits):
    """Apply a batch of cell edits to a worksheet XML file.

    row_edits is a dict {row_idx: [(cell_ref, new_cell_xml), ...]}.
    Cells whose ref doesn't yet exist in that row will be appended.
    Returns (modified_count, missing_rows) — missing_rows is a list of row
    indices that the file didn't contain (caller can decide if that's OK).
    """
    with open(sheet_xml_path, "r", encoding="utf-8") as f:
        xml = f.read()

    seen_rows = set()

    def _apply(match):
        row_xml = match.group(0)
        row_num = int(match.group(1))
        seen_rows.add(row_num)
        edits = row_edits.get(row_num)
        if not edits:
            return row_xml
        for ref, new_cell_xml in edits:
            row_xml = replace_cell_in_row(row_xml, ref, new_cell_xml)
        return row_xml

    new_xml = _ROW_REGEX.sub(_apply, xml)

    missing_rows = [r for r in row_edits if r not in seen_rows]

    with open(sheet_xml_path, "w", encoding="utf-8") as f:
        f.write(new_xml)

    return len(seen_rows & set(row_edits)), missing_rows


def extend_sheet_dimension(sheet_xml_path, last_col_letter):
    """Bump the <dimension ref="A1:Hxx"/> so it includes the new column."""
    with open(sheet_xml_path, "r", encoding="utf-8") as f:
        xml = f.read()

    def _bump(m):
        start = m.group(1)
        end = m.group(2)
        # If end already at-or-past last_col_letter, leave alone
        end_col = re.match(r"([A-Z]+)\d+", end).group(1)
        if len(end_col) > len(last_col_letter) or end_col >= last_col_letter:
            return m.group(0)
        end_row = re.match(r"[A-Z]+(\d+)", end).group(1)
        return f'<dimension ref="{start}:{last_col_letter}{end_row}"/>'

    new_xml = re.sub(
        r'<dimension ref="([A-Z]+\d+):([A-Z]+\d+)"/>', _bump, xml, count=1
    )
    with open(sheet_xml_path, "w", encoding="utf-8") as f:
        f.write(new_xml)


def cell_formula(ref, formula):
    """Build a <c> element holding a formula. Strips a leading '='."""
    if formula.startswith("="):
        formula = formula[1:]
    return f'<c r="{ref}"><f>{xml_escape(formula)}</f></c>'


def hide_column_in_sheet(sheet_xml_path, col_idx):
    """Add a <col min/max="col_idx" hidden="1"/> entry to the worksheet's
    <cols> block. Idempotent: replaces an existing entry for that column."""
    with open(sheet_xml_path, "r", encoding="utf-8") as f:
        xml = f.read()

    new_col = (
        f'<col min="{col_idx}" max="{col_idx}" '
        f'width="9" hidden="1" customWidth="1"/>'
    )

    # If the sheet has a <cols>...</cols> block, append our col into it
    if "<cols>" in xml:
        # Remove any existing entry for this column
        xml = re.sub(
            rf'<col[^/]*?min="{col_idx}"[^/]*?/>', "", xml
        )
        xml = re.sub(
            rf'<col[^/]*?max="{col_idx}"[^/]*?/>', "", xml
        )
        xml = xml.replace("</cols>", new_col + "</cols>", 1)
    else:
        # No <cols> block — insert one after <sheetFormatPr.../>
        xml = re.sub(
            r'(<sheetFormatPr[^/]*/>)',
            r'\1<cols>' + new_col + '</cols>',
            xml,
            count=1,
        )

    with open(sheet_xml_path, "w", encoding="utf-8") as f:
        f.write(xml)
